import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  ExtensionRegistryManifest,
  ExtensionRegistryExtension,
  ExtensionRegistryVersion,
  getLatestVersion,
  validateRegistryManifest,
} from "@jamra/extension-registry";

export interface RegistrySourceConfig {
  id?: string;
  url: string;
  label?: string;
  priority?: number;
}

export interface RegistrySource extends RegistrySourceConfig {
  id: string;
  manifestUrl: string;
}

export interface CachedRegistryManifest {
  source: RegistrySource;
  manifest: ExtensionRegistryManifest;
  fetchedAt: number;
}

export interface MarketplaceExtensionRecord {
  registry: RegistrySource;
  extension: ExtensionRegistryExtension;
  latestVersion?: ExtensionRegistryVersion;
}

export interface ResolveExtensionOptions {
  version?: string;
  includeDeprecated?: boolean;
}

export interface ResolvedExtensionVersion {
  registry: CachedRegistryManifest;
  extension: ExtensionRegistryExtension;
  version: ExtensionRegistryVersion;
}

export interface DownloadedExtensionAsset {
  filePath: string;
  cleanup: () => Promise<void>;
}

interface ExtensionRegistryServiceOptions {
  refreshIntervalMs?: number;
  fetchImpl?: typeof fetch;
  onError?: (error: unknown, source: RegistrySourceConfig) => void;
}

const HTTP_SCHEME = /^(https?):/i;
const FILE_SCHEME = /^file:/i;

export class ExtensionRegistryService {
  private readonly refreshIntervalMs: number;
  private readonly fetch: typeof fetch;
  private readonly onError?: (
    error: unknown,
    source: RegistrySourceConfig,
  ) => void;
  private readonly cacheByUrl = new Map<string, CachedRegistryManifest>();
  private readonly cacheById = new Map<string, CachedRegistryManifest>();
  private readonly inflight = new Map<
    string,
    Promise<CachedRegistryManifest>
  >();

  constructor(
    private readonly sources: RegistrySourceConfig[],
    options: ExtensionRegistryServiceOptions = {},
  ) {
    this.refreshIntervalMs = options.refreshIntervalMs ?? 5 * 60 * 1000;
    this.fetch = options.fetchImpl ?? fetch;
    this.onError = options.onError;
  }

  async listRegistries(force = false): Promise<CachedRegistryManifest[]> {
    const results: CachedRegistryManifest[] = [];

    for (const source of this.sources
      .slice()
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))) {
      try {
        const manifest = await this.loadSource(source, force);
        results.push(manifest);
      } catch (error) {
        this.handleError(error, source);
      }
    }

    return results;
  }

  async listMarketplaceExtensions(
    force = false,
  ): Promise<MarketplaceExtensionRecord[]> {
    const registries = await this.listRegistries(force);
    const records: MarketplaceExtensionRecord[] = [];

    for (const registry of registries) {
      for (const extension of registry.manifest.extensions) {
        records.push({
          registry: registry.source,
          extension,
          latestVersion: getLatestVersion(extension),
        });
      }
    }

    return records;
  }

  async resolveExtension(
    registryId: string,
    extensionId: string,
    options: ResolveExtensionOptions = {},
  ): Promise<ResolvedExtensionVersion | undefined> {
    const registry = await this.ensureRegistryById(registryId);
    if (!registry) return undefined;

    const extension = registry.manifest.extensions.find(
      (item: ExtensionRegistryExtension) => item.id === extensionId,
    );
    if (!extension) return undefined;

    const includeDeprecated = options.includeDeprecated ?? false;
    const version = options.version
      ? extension.versions.find(
          (candidate: ExtensionRegistryVersion) =>
            candidate.version === options.version,
        )
      : getLatestVersion(extension, { includeDeprecated });

    if (!version) return undefined;

    return { registry, extension, version };
  }

  async refreshRegistry(
    registryId: string,
  ): Promise<CachedRegistryManifest | undefined> {
    const registry = await this.ensureRegistryById(registryId, true);
    if (!registry) return undefined;
    return registry;
  }

  async downloadVersionAsset(
    resolved: ResolvedExtensionVersion,
  ): Promise<DownloadedExtensionAsset> {
    const { version } = resolved;
    const url = version.downloadUrl;
    const expectedChecksum = version.checksum.value;

    let buffer: Buffer;
    let resolvedPath: string | undefined;

    if (HTTP_SCHEME.test(url)) {
      const response = await this.fetch(url, {
        headers: { accept: "application/javascript, application/octet-stream" },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          `Failed to download extension asset ${url}: ${response.status} ${response.statusText}`,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      resolvedPath = this.resolveFilePath(url);
      buffer = await fs.readFile(resolvedPath);
    }

    const computedChecksum = createHash("sha256").update(buffer).digest("hex");
    if (computedChecksum !== expectedChecksum) {
      throw new Error(
        `Checksum mismatch for extension asset ${url}. Expected ${expectedChecksum} but calculated ${computedChecksum}.`,
      );
    }

    if (resolvedPath) {
      // Local files can be used directly without copying.
      return {
        filePath: resolvedPath,
        cleanup: async () => {
          /* no-op for local assets */
        },
      };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jamra-ext-"));
    const extension = this.deriveExtensionFromUrl(url) ?? ".js";
    const targetPath = path.join(tempDir, `extension${extension}`);
    await fs.writeFile(targetPath, buffer);

    const cleanup = async () => {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
        // Ignore cleanup errors.
      });
    };

    return { filePath: targetPath, cleanup };
  }

  private async ensureRegistryById(
    registryId: string,
    force = false,
  ): Promise<CachedRegistryManifest | undefined> {
    const cached = this.cacheById.get(registryId);
    if (cached && !force && !this.isExpired(cached)) {
      return cached;
    }

    const source = this.sources.find((entry) => entry.id === registryId);
    if (source) {
      try {
        return await this.loadSource(source, force);
      } catch (error) {
        this.handleError(error, source);
        return undefined;
      }
    }

    for (const candidate of this.sources) {
      try {
        const manifest = await this.loadSource(candidate, force);
        if (manifest.source.id === registryId) {
          return manifest;
        }
      } catch (error) {
        this.handleError(error, candidate);
      }
    }

    return undefined;
  }

  private async loadSource(
    source: RegistrySourceConfig,
    force = false,
  ): Promise<CachedRegistryManifest> {
    const cached = this.cacheByUrl.get(source.url);
    if (cached && !force && !this.isExpired(cached)) {
      return cached;
    }

    const inflightKey = `${source.url}:${force ? "force" : "cache"}`;
    const existing = this.inflight.get(inflightKey);
    if (existing) {
      return existing;
    }

    const promise = this.fetchManifestFromSource(source)
      .then((manifest) => {
        const resolvedSource: RegistrySource = {
          ...source,
          id: source.id ?? manifest.registry.id,
          label: source.label ?? manifest.registry.name,
          manifestUrl: source.url,
        };

        const cachedEntry: CachedRegistryManifest = {
          source: resolvedSource,
          manifest,
          fetchedAt: Date.now(),
        };

        this.cacheByUrl.set(source.url, cachedEntry);
        this.cacheById.set(resolvedSource.id, cachedEntry);

        return cachedEntry;
      })
      .finally(() => {
        this.inflight.delete(inflightKey);
      });

    this.inflight.set(inflightKey, promise);
    return promise;
  }

  private async fetchManifestFromSource(
    source: RegistrySourceConfig,
  ): Promise<ExtensionRegistryManifest> {
    let payload: unknown;

    if (HTTP_SCHEME.test(source.url)) {
      const response = await this.fetch(source.url, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch registry ${source.url}: ${response.status} ${response.statusText}`,
        );
      }
      payload = await response.json();
    } else {
      const filePath = this.resolveFilePath(source.url);
      const raw = await fs.readFile(filePath, "utf8");
      payload = JSON.parse(raw);
    }

    const validation = validateRegistryManifest(payload);
    if (!validation.valid || !validation.manifest) {
      const message =
        validation.errors.join("; ") || "Unknown validation error";
      throw new Error(
        `Invalid registry manifest from ${source.url}: ${message}`,
      );
    }

    if (source.id && source.id !== validation.manifest.registry.id) {
      console.warn(
        `Registry source ${source.url} declared id ${source.id}, but manifest reports ${validation.manifest.registry.id}. Using manifest id.`,
      );
    }

    return validation.manifest;
  }

  private resolveFilePath(reference: string): string {
    if (FILE_SCHEME.test(reference)) {
      return fileURLToPath(reference);
    }
    if (path.isAbsolute(reference)) {
      return reference;
    }
    return path.resolve(process.cwd(), reference);
  }

  private deriveExtensionFromUrl(reference: string): string | undefined {
    if (HTTP_SCHEME.test(reference)) {
      try {
        const url = new URL(reference);
        return path.extname(url.pathname) || undefined;
      } catch {
        return undefined;
      }
    }

    const resolved = this.resolveFilePath(reference);
    const ext = path.extname(resolved);
    return ext || undefined;
  }

  private isExpired(entry: CachedRegistryManifest): boolean {
    return Date.now() - entry.fetchedAt > this.refreshIntervalMs;
  }

  private handleError(error: unknown, source: RegistrySourceConfig) {
    if (this.onError) {
      this.onError(error, source);
      return;
    }
    console.warn(`Extension registry ${source.url} failed:`, error);
  }
}

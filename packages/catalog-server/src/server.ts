import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import cors from "cors";
import type { Server } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionFilters, MangaDetails } from "@jamra/extension-sdk";
import {
  CatalogDatabase,
  CatalogRepository,
  type ExtensionListOptions,
  type StoredExtensionSourceMetadata,
  type StoredExtensionUpdateDetails,
  type StoredExtensionUpdateState,
} from "@jamra/catalog-db";
import { CatalogService } from "@jamra/catalog-service";
import { ExtensionHost, importExtension } from "@jamra/extension-host";
import { compareVersions } from "@jamra/extension-registry";
import {
  ExtensionManager,
  type InstallExtensionOptions,
} from "./extensions/extensionManager.js";
import { ExtensionStorage } from "./extensions/storage.js";
import {
  ExtensionRegistryService,
  type RegistrySourceConfig,
  type ResolvedExtensionVersion,
} from "./extensions/registryService.js";
import {
  OfflineStorageManager,
  OfflineRepository,
  DownloadWorker,
} from "@jamra/offline-storage";
import {
  CoverCacheManager,
  type CoverCacheSettings,
} from "./services/coverCacheManager.js";

export interface CatalogServerOptions {
  port?: number;
  extensionPath?: string;
  extensionId?: string;
  disableCors?: boolean;
}

export interface CatalogServerInstance {
  port: number;
  extensionId?: string;
  loadedExtensions: string[];
  server: Server;
  close: () => Promise<void>;
}

const DEFAULT_PORT = Number(process.env.JAMRA_API_PORT ?? 4545);

function resolveExtensionPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }

  return path.resolve(
    process.cwd(),
    "packages/example-extension/dist/index.js"
  );
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function coerceSettings(
  payload: unknown
): Record<string, unknown> | null | undefined {
  if (payload === undefined) return undefined;
  if (payload === null) return null;
  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new Error("Invalid settings payload; expected an object or null.");
}

function arraysEqual(a?: string[], b?: string[]): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sanitizeCoverUrls(urls: Iterable<string | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of urls) {
    if (!raw) continue;
    if (!/^https?:\/\//i.test(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    ordered.push(raw);
  }
  return ordered;
}

function mergeCoverUrlOrder(
  preferred: string[] | undefined,
  provided: string[] | undefined,
): string[] {
  if (!preferred?.length) {
    return sanitizeCoverUrls(provided ?? []);
  }

  const merged = [...preferred, ...(provided ?? [])];
  return sanitizeCoverUrls(merged);
}

function resolveExtensionErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  const message = error.message.toLowerCase();
  if (message.includes("persistent extension storage")) return 503;
  if (message.includes("not installed")) return 404;
  if (
    message.includes("not found") ||
    message.includes("missing") ||
    message.includes("invalid")
  ) {
    return 400;
  }
  return 500;
}

function parseRegistryEnv(value: string): RegistrySourceConfig[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry, index) => {
      const parts = entry
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        throw new Error(
          `Invalid registry entry at position ${index + 1}: ${entry}`
        );
      }

      let id: string | undefined;
      let url: string;
      let label: string | undefined;

      if (parts.length === 1) {
        url = parts[0];
      } else {
        [id, url, label] = parts;
      }

      return {
        id: id && id.length > 0 ? id : undefined,
        url,
        label,
        priority: index,
      } satisfies RegistrySourceConfig;
    });
}

function parseRegistryJson(json: string): RegistrySourceConfig[] {
  try {
    const payload = JSON.parse(json) as Array<
      RegistrySourceConfig & { url: string }
    >;
    return payload
      .filter((entry) => typeof entry?.url === "string" && entry.url.length > 0)
      .map((entry, index) => ({
        id: entry.id,
        url: entry.url,
        label: entry.label,
        priority: entry.priority ?? index,
      }));
  } catch (error) {
    throw new Error(
      `JAMRA_EXTENSION_REGISTRIES_JSON is invalid JSON: ${String(error)}`
    );
  }
}

function resolveRegistrySources(): RegistrySourceConfig[] {
  const jsonEnv = process.env.JAMRA_EXTENSION_REGISTRIES_JSON;
  if (jsonEnv && jsonEnv.trim().length > 0) {
    const parsed = parseRegistryJson(jsonEnv.trim());
    if (parsed.length > 0) {
      return parsed;
    }
  }

  const textEnv = process.env.JAMRA_EXTENSION_REGISTRIES;
  if (textEnv && textEnv.trim().length > 0) {
    const parsed = parseRegistryEnv(textEnv.trim());
    if (parsed.length > 0) {
      return parsed;
    }
  }

  const officialManifestPath = fileURLToPath(
    new URL("./extensions/registries/official.json", import.meta.url)
  );

  return [
    {
      id: "jamra-official",
      url: officialManifestPath,
      label: "JAMRA Official Registry",
      priority: 0,
    },
  ];
}

function buildSourceMetadata(
  resolved: ResolvedExtensionVersion
): StoredExtensionSourceMetadata {
  return {
    registryId: resolved.registry.source.id,
    manifestUrl: resolved.registry.source.manifestUrl,
    downloadUrl: resolved.version.downloadUrl,
    checksum: resolved.version.checksum.value,
    signature: resolved.version.signature,
    version: resolved.version.version,
  };
}

function buildUpdateDetails(
  resolved: ResolvedExtensionVersion
): StoredExtensionUpdateDetails {
  return {
    version: resolved.version.version,
    downloadUrl: resolved.version.downloadUrl,
    checksum: resolved.version.checksum.value,
    releaseNotes: resolved.version.releaseNotes,
    publishedAt: resolved.version.publishedAt,
    manifestUrl: resolved.registry.source.manifestUrl,
    minHostVersion: resolved.version.minHostVersion,
    minSdkVersion: resolved.version.minSdkVersion,
    compatibilityNotes: resolved.version.compatibilityNotes,
    signature: resolved.version.signature,
    registryId: resolved.registry.source.id,
  };
}

export async function startCatalogServer(
  options: CatalogServerOptions = {}
): Promise<CatalogServerInstance> {
  const port = options.port ?? DEFAULT_PORT;
  const app = express();

  if (!options.disableCors) {
    app.use(cors({ origin: true }));
  }

  app.use(express.json());

  let bootstrapExtensionPath: string | undefined;
  try {
    bootstrapExtensionPath = resolveExtensionPath(
      options.extensionPath ?? process.env.JAMRA_EXTENSION_PATH
    );
  } catch (error) {
    console.warn("Failed to resolve bootstrap extension path.", error);
  }
  const usingCustomBootstrap =
    options.extensionPath !== undefined ||
    process.env.JAMRA_EXTENSION_PATH !== undefined;

  let database: CatalogDatabase | undefined;

  if (process.env.JAMRA_DISABLE_SQLITE !== "1") {
    try {
      database = new CatalogDatabase();
      // Force initialization to surface native binding issues early.
      database.connect();
    } catch (error) {
      console.warn(
        "Failed to initialize SQLite catalog store. Falling back to in-memory cache."
      );
      console.warn(String(error));
      database = undefined;
    }
  }

  const host = new ExtensionHost({
    database,
  });

  const repository = database ? new CatalogRepository(database.db) : undefined;
  const coverCacheSettings = repository?.getAppSetting<CoverCacheSettings>(
    "coverCacheSettings",
  );
  const coverCacheManager = repository
    ? new CoverCacheManager(repository, coverCacheSettings ?? undefined)
    : undefined;

  if (coverCacheManager) {
    try {
      coverCacheManager.purgeExpired();
    } catch (error) {
      console.warn("Failed to purge expired cover cache entries", error);
    }
  }

  const enrichMangaDetails = async (
    extensionId: string,
    details: MangaDetails,
  ): Promise<void> => {
    const providedUrls = sanitizeCoverUrls([
      ...(details.coverUrls ?? []),
      details.coverUrl,
    ]);

    const storedOrder = repository?.getMangaCoverUrls(extensionId, details.id);
    let mergedUrls = providedUrls;
    if (storedOrder && storedOrder.length > 0) {
      mergedUrls = mergeCoverUrlOrder(storedOrder, providedUrls);
    }

    if (mergedUrls.length > 0) {
      details.coverUrls = mergedUrls;
      details.coverUrl = mergedUrls[0];
      if (
        repository &&
        (!storedOrder || !arraysEqual(storedOrder, mergedUrls))
      ) {
        repository.updateMangaCoverUrls(extensionId, details.id, mergedUrls);
      }
    }

    if (coverCacheManager) {
      try {
        const cached = await coverCacheManager.getCachedCover(
          extensionId,
          details.id,
        );

        if (cached) {
          details.cachedCover = {
            dataUrl: cached.dataUrl,
            sourceUrl: cached.sourceUrl,
            updatedAt: new Date(cached.updatedAt).toISOString(),
            expiresAt: cached.expiresAt
              ? new Date(cached.expiresAt).toISOString()
              : undefined,
            mimeType: cached.mimeType,
            bytes: cached.bytes,
          };
        } else {
          const urlsForCache = details.coverUrls?.length
            ? details.coverUrls
            : details.coverUrl
            ? [details.coverUrl]
            : [];

          if (urlsForCache.length > 0) {
            void coverCacheManager
              .ensureCachedCover(extensionId, details.id, urlsForCache, {
                title: details.title,
                slug: details.slug,
                urls: urlsForCache,
              })
              .catch((error) => {
                console.warn(
                  `Failed to prefetch cover for ${details.id}`,
                  error,
                );
              });
          }
        }
      } catch (error) {
        console.warn(`Failed to resolve cached cover for ${details.id}`, error);
      }
    }
  };
  const storage = database
    ? new ExtensionStorage(path.join(path.dirname(database.path), "extensions"))
    : undefined;

  // Initialize offline storage system
  const dataDir = database
    ? path.join(path.dirname(database.path), "offline")
    : path.join(process.cwd(), ".jamra-data", "offline");

  let offlineStorageManager: OfflineStorageManager | undefined;
  let offlineRepository: OfflineRepository | undefined;
  let downloadWorker: DownloadWorker | undefined;

  const extensionManager = new ExtensionManager(host, repository, storage);

  await extensionManager.initialize();

  const registrySources = resolveRegistrySources();
  const registryService = new ExtensionRegistryService(registrySources, {
    onError: (error, source) => {
      console.warn(`Extension registry ${source.url} failed`, error);
    },
  });

  void registryService.listRegistries().catch((error) => {
    console.warn("Initial registry fetch failed", error);
  });

  if (repository && storage) {
    const explicitId = options.extensionId ?? process.env.JAMRA_EXTENSION_ID;
    let installed = extensionManager.listExtensions();

    const bootstrapExists = Boolean(
      bootstrapExtensionPath && fs.existsSync(bootstrapExtensionPath)
    );

    if (bootstrapExists) {
      try {
        const bootstrapModule = await importExtension(bootstrapExtensionPath!);
        const bootstrapId = bootstrapModule.manifest.id;
        const existing = installed.find(
          (extension) => extension.id === bootstrapId
        );

        const needsInstall =
          !existing ||
          !existing.entryPath ||
          !fs.existsSync(existing.entryPath);
        const shouldRefresh = Boolean(
          usingCustomBootstrap && existing && !needsInstall,
        );

        if (needsInstall || shouldRefresh) {
          try {
            await extensionManager.installFromFile(bootstrapExtensionPath!, {
              enabled: existing?.enabled ?? true,
              settings: existing?.settings ?? null,
            });
            installed = extensionManager.listExtensions();
          } catch (error) {
            console.warn(
              `Failed to install bootstrap extension from ${bootstrapExtensionPath}.`,
              error
            );
          }
        }

        if (explicitId && bootstrapId !== explicitId) {
          console.warn(
            `Bootstrap extension id ${bootstrapId} did not match expected ${explicitId}.`
          );
        }
      } catch (error) {
        console.warn(
          `Unable to read bootstrap extension at ${bootstrapExtensionPath}.`,
          error
        );
      }
    } else if (bootstrapExtensionPath) {
      console.warn(
        `Bootstrap extension not found at ${bootstrapExtensionPath}.`
      );
    }

    if (installed.length === 0 && bootstrapExists) {
      try {
        const installedExtension = await extensionManager.installFromFile(
          bootstrapExtensionPath!,
          {
            enabled: true,
          }
        );
        installed = extensionManager.listExtensions();
        if (explicitId && installedExtension.id !== explicitId) {
          console.warn(
            `Bootstrap extension id ${installedExtension.id} did not match expected ${explicitId}.`
          );
        }
      } catch (error) {
        console.warn(
          `Failed to bootstrap extension from ${bootstrapExtensionPath}.`,
          error
        );
      }
    }

    if (explicitId) {
      try {
        await extensionManager.enableExtension(explicitId);
      } catch (error) {
        console.warn(`Unable to force-enable extension ${explicitId}:`, error);
      }
    }
  }

  let activeExtensionId = extensionManager.getDefaultExtensionId();

  const service = new CatalogService(host, { database });

  // Initialize and start offline storage system
  if (database) {
    try {
      offlineRepository = new OfflineRepository(database.db);
      offlineStorageManager = new OfflineStorageManager(
        dataDir,
        offlineRepository,
        service
      );
      downloadWorker = new DownloadWorker(
        dataDir,
        offlineRepository,
        service,
        { concurrency: 3, pollingInterval: 1000 }
      );
      await downloadWorker.start();
      console.log("Offline storage system initialized");
    } catch (error) {
      console.warn("Failed to initialize offline storage system:", error);
    }
  }

  const handleError = (
    res: Response,
    error: unknown,
    message: string,
    status = 500
  ) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(message, detail);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    res.status(status).json({ error: message, detail });
  };

  const resolveExtensionId = (req: Request): string | undefined => {
    const requested = getQueryParam(req, "extensionId")?.trim();
    if (requested) {
      return requested;
    }
    return activeExtensionId;
  };

  const ensureExtensionLoaded = (
    req: Request,
    res: Response
  ): string | undefined => {
    const extensionId = resolveExtensionId(req);
    if (!extensionId) {
      res.status(404).json({ error: "No extensions are enabled." });
      return undefined;
    }
    if (!host.isLoaded(extensionId)) {
      res
        .status(404)
        .json({ error: `Extension ${extensionId} is not enabled.` });
      return undefined;
    }
    return extensionId;
  };

  app.get("/api/health", (_req, res) => {
    const loaded = host.listLoadedExtensions().map((entry) => entry.id);
    res.json({
      status: "ok",
      extensionId: activeExtensionId ?? null,
      loadedExtensions: loaded,
    });
  });

  app.get("/api/extensions", (req, res) => {
    try {
      const options: ExtensionListOptions = {};

      const search = getQueryParam(req, "search");
      if (search) options.search = search;

      const status = getQueryParam(req, "status");
      if (status === "enabled" || status === "disabled") {
        options.status = status;
      }

      const sort = getQueryParam(req, "sort");
      if (
        sort === "name" ||
        sort === "installedAt" ||
        sort === "author" ||
        sort === "language"
      ) {
        options.sort = sort;
      }

      const order = getQueryParam(req, "order");
      if (order === "asc" || order === "desc") {
        options.order = order;
      }

      const extensions = extensionManager.listExtensions(options);
      res.json({ extensions });
    } catch (error) {
      handleError(res, error, "Failed to list extensions");
    }
  });

  app.get("/api/extension-marketplace", async (_req, res) => {
    try {
      const [registries, extensions] = await Promise.all([
        registryService.listRegistries(),
        registryService.listMarketplaceExtensions(),
      ]);

      res.json({
        registries: registries.map((entry) => ({
          id: entry.source.id,
          label: entry.source.label ?? entry.manifest.registry.name,
          name: entry.manifest.registry.name,
          description: entry.manifest.registry.description ?? null,
          homepage: entry.manifest.registry.homepage ?? null,
          supportUrl: entry.manifest.registry.supportUrl ?? null,
          manifestUrl: entry.source.manifestUrl,
          generatedAt: entry.manifest.generatedAt ?? null,
          fetchedAt: entry.fetchedAt,
          extensionCount: entry.manifest.extensions.length,
          maintainers: entry.manifest.registry.maintainers ?? [],
        })),
        extensions: extensions.map((record) => ({
          registryId: record.registry.id,
          registryLabel: record.registry.label ?? record.registry.id,
          manifestUrl: record.registry.manifestUrl,
          id: record.extension.id,
          name: record.extension.name,
          summary: record.extension.summary,
          description: record.extension.description ?? null,
          homepage: record.extension.homepage ?? null,
          repository: record.extension.repository ?? null,
          icon: record.extension.icon ?? null,
          tags: record.extension.tags ?? [],
          categories: record.extension.categories ?? [],
          author: record.extension.author,
          maintainers: record.extension.maintainers ?? [],
          versions: record.extension.versions,
          latestVersion: record.latestVersion ?? null,
        })),
      });
    } catch (error) {
      handleError(res, error, "Failed to query extension marketplace");
    }
  });

  app.post("/api/extensions", async (req, res) => {
    const { filePath, source, enabled, settings } = req.body ?? {};

    let parsedSettings: Record<string, unknown> | null | undefined;
    try {
      parsedSettings = coerceSettings(settings);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (source && typeof source === "object") {
      const registryId =
        typeof source.registryId === "string" ? source.registryId.trim() : "";
      const extensionId =
        typeof source.extensionId === "string" ? source.extensionId.trim() : "";
      const version =
        typeof source.version === "string" ? source.version.trim() : undefined;

      if (!registryId || !extensionId) {
        res.status(400).json({
          error:
            "source.registryId and source.extensionId are required to install from a registry.",
        });
        return;
      }

      let resolved: ResolvedExtensionVersion | undefined;
      try {
        resolved = await registryService.resolveExtension(
          registryId,
          extensionId,
          { version }
        );
      } catch (error) {
        handleError(res, error, "Failed to resolve registry extension");
        return;
      }

      if (!resolved) {
        res.status(404).json({
          error: `Extension ${extensionId} not found in registry ${registryId}.`,
        });
        return;
      }

      let asset: Awaited<
        ReturnType<ExtensionRegistryService["downloadVersionAsset"]>
      >;
      try {
        asset = await registryService.downloadVersionAsset(resolved);
      } catch (error) {
        handleError(res, error, "Failed to download extension asset");
        return;
      }

      const now = Date.now();
      const updateState: StoredExtensionUpdateState = {
        latest: buildUpdateDetails(resolved),
        lastCheckedAt: now,
        acknowledgedVersion: resolved.version.version,
        acknowledgedAt: now,
      };

      const installOptions: InstallExtensionOptions = {
        sourceMetadata: buildSourceMetadata(resolved),
        updateState,
      };

      if (typeof enabled === "boolean") {
        installOptions.enabled = enabled;
      }

      if (parsedSettings !== undefined) {
        installOptions.settings = parsedSettings;
      }

      try {
        const extension = await extensionManager.installFromFile(
          asset.filePath,
          installOptions
        );
        if (extension.enabled && extension.loaded) {
          activeExtensionId = extension.id;
        } else if (!activeExtensionId) {
          activeExtensionId = extensionManager.getDefaultExtensionId();
        }
        res.status(201).json({ extension });
      } catch (error) {
        handleError(
          res,
          error,
          "Failed to install extension",
          resolveExtensionErrorStatus(error)
        );
      } finally {
        await asset.cleanup();
      }

      return;
    }

    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      res.status(400).json({ error: "filePath or source is required." });
      return;
    }

    const installOptions: InstallExtensionOptions = {};
    if (typeof enabled === "boolean") {
      installOptions.enabled = enabled;
    }
    if (parsedSettings !== undefined) {
      installOptions.settings = parsedSettings;
    }

    try {
      const extension = await extensionManager.installFromFile(
        filePath,
        installOptions
      );
      if (extension.enabled && extension.loaded) {
        activeExtensionId = extension.id;
      } else if (!activeExtensionId) {
        activeExtensionId = extensionManager.getDefaultExtensionId();
      }
      res.status(201).json({ extension });
    } catch (error) {
      handleError(
        res,
        error,
        "Failed to install extension",
        resolveExtensionErrorStatus(error)
      );
    }
  });

  app.post("/api/extensions/:id/enable", async (req, res) => {
    const id = req.params.id;
    const { settings } = req.body ?? {};

    let parsedSettings: Record<string, unknown> | null | undefined;
    try {
      parsedSettings = coerceSettings(settings);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    try {
      const extension = await extensionManager.enableExtension(
        id,
        parsedSettings
      );
      activeExtensionId = extension.id;
      res.json({ extension });
    } catch (error) {
      // Get extension name for better error messaging
      const extInfo = extensionManager.getExtension(id);
      const extName = extInfo?.manifest.name || id;

      handleError(
        res,
        error,
        `Failed to enable ${extName} extension`,
        resolveExtensionErrorStatus(error)
      );
    }
  });

  app.post("/api/extensions/:id/disable", async (req, res) => {
    const id = req.params.id;

    try {
      const extension = await extensionManager.disableExtension(id);
      if (extension && extension.id === activeExtensionId) {
        activeExtensionId = extensionManager.getDefaultExtensionId();
      }
      res.json({ extension });
    } catch (error) {
      handleError(
        res,
        error,
        "Failed to disable extension",
        resolveExtensionErrorStatus(error)
      );
    }
  });

  app.post("/api/extensions/:id/check-updates", async (req, res) => {
    const id = req.params.id;

    try {
      const extension = extensionManager.getExtension(id);
      if (!extension) {
        res.status(404).json({ error: `Extension ${id} is not installed.` });
        return;
      }

      const registryId = extension.source?.registryId;
      if (!registryId) {
        res.status(400).json({
          error:
            "Extension is not linked to a registry and cannot participate in update checks.",
        });
        return;
      }

      const resolved = await registryService.resolveExtension(
        registryId,
        extension.id
      );
      if (!resolved) {
        res.status(404).json({
          error: `Extension ${extension.id} could not be found in registry ${registryId}.`,
        });
        return;
      }

      const updateDetails = buildUpdateDetails(resolved);
      const now = Date.now();
      const updateState: StoredExtensionUpdateState = {
        latest: updateDetails,
        lastCheckedAt: now,
      };

      if (compareVersions(updateDetails.version, extension.version) <= 0) {
        updateState.acknowledgedVersion = extension.version;
        updateState.acknowledgedAt = now;
      } else if (
        extension.updateState?.acknowledgedVersion === updateDetails.version &&
        extension.updateState.acknowledgedAt
      ) {
        updateState.acknowledgedVersion =
          extension.updateState.acknowledgedVersion;
        updateState.acknowledgedAt = extension.updateState.acknowledgedAt;
      }

      extensionManager.updateExtensionUpdateState(id, updateState);
      const updated = extensionManager.getExtension(id)!;
      res.json({ extension: updated });
    } catch (error) {
      handleError(res, error, "Failed to check for extension updates");
    }
  });

  app.post("/api/extensions/:id/acknowledge-update", async (req, res) => {
    const id = req.params.id;
    const { version } = req.body ?? {};

    if (typeof version !== "string" || version.trim().length === 0) {
      res
        .status(400)
        .json({ error: "version is required to acknowledge an update." });
      return;
    }

    try {
      const extension = extensionManager.getExtension(id);
      if (!extension) {
        res.status(404).json({ error: `Extension ${id} is not installed.` });
        return;
      }

      if (
        !extension.updateState?.latest ||
        extension.updateState.latest.version !== version
      ) {
        res.status(400).json({
          error: `Version ${version} is not pending acknowledgement for extension ${id}.`,
        });
        return;
      }

      const now = Date.now();
      const updateState: StoredExtensionUpdateState = {
        ...extension.updateState,
        acknowledgedVersion: version,
        acknowledgedAt: now,
      };

      extensionManager.updateExtensionUpdateState(id, updateState);
      const updated = extensionManager.getExtension(id)!;
      res.json({ extension: updated });
    } catch (error) {
      handleError(res, error, "Failed to acknowledge extension update");
    }
  });

  app.patch("/api/extensions/:id/settings", async (req, res) => {
    const id = req.params.id;
    const { settings } = req.body ?? {};

    let parsedSettings: Record<string, unknown> | null | undefined;
    try {
      parsedSettings = coerceSettings(settings);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (parsedSettings === undefined) {
      res.status(400).json({ error: "settings payload is required." });
      return;
    }

    try {
      const extension = await extensionManager.updateSettings(
        id,
        parsedSettings
      );
      res.json({ extension });
    } catch (error) {
      handleError(
        res,
        error,
        "Failed to update extension settings",
        resolveExtensionErrorStatus(error)
      );
    }
  });

  app.delete("/api/extensions/:id", async (req, res) => {
    const id = req.params.id;

    try {
      await extensionManager.uninstallExtension(id);
      if (activeExtensionId === id) {
        activeExtensionId = extensionManager.getDefaultExtensionId();
      }
      res.status(204).end();
    } catch (error) {
      handleError(
        res,
        error,
        "Failed to uninstall extension",
        resolveExtensionErrorStatus(error)
      );
    }
  });

  app.get("/api/system/cache-settings", (req, res) => {
    if (!coverCacheManager) {
      res.json({
        settings: {
          enabled: false,
          ttlMs: 0,
          maxEntries: 0,
          fetchTimeoutMs: 8000,
        },
      });
      return;
    }

    res.json({ settings: coverCacheManager.getSettings() });
  });

  app.patch("/api/system/cache-settings", (req, res) => {
    if (!repository || !coverCacheManager) {
      res
        .status(503)
        .json({ error: "Persistent storage is required for cache settings" });
      return;
    }

    const updates: Partial<CoverCacheSettings> = {};
    const body = req.body ?? {};

    if (typeof body.enabled === "boolean") {
      updates.enabled = body.enabled;
    }

    if (body.ttlMs !== undefined) {
      const ttlMs = Number(body.ttlMs);
      if (!Number.isFinite(ttlMs) || ttlMs < 0) {
        res.status(400).json({ error: "ttlMs must be a non-negative number" });
        return;
      }
      updates.ttlMs = ttlMs;
    } else if (body.ttlDays !== undefined) {
      const ttlDays = Number(body.ttlDays);
      if (!Number.isFinite(ttlDays) || ttlDays < 0) {
        res
          .status(400)
          .json({ error: "ttlDays must be a non-negative number" });
        return;
      }
      updates.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    }

    if (body.maxEntries !== undefined) {
      const maxEntries = Number(body.maxEntries);
      if (!Number.isInteger(maxEntries) || maxEntries < 0) {
        res
          .status(400)
          .json({ error: "maxEntries must be a non-negative integer" });
        return;
      }
      updates.maxEntries = maxEntries;
    }

    if (body.fetchTimeoutMs !== undefined) {
      const timeoutMs = Number(body.fetchTimeoutMs);
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        res.status(400).json({
          error: "fetchTimeoutMs must be a non-negative number",
        });
        return;
      }
      updates.fetchTimeoutMs = timeoutMs;
    }

    coverCacheManager.updateSettings(updates);
    repository.setAppSetting(
      "coverCacheSettings",
      coverCacheManager.getSettings(),
    );

    res.json({ settings: coverCacheManager.getSettings() });
  });

  app.get("/api/catalog", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const pageParam = getQueryParam(req, "page");
      const page = Number.parseInt((pageParam ?? "1") as string, 10) || 1;
      const query = (() => {
        const queryParam = getQueryParam(req, "query");
        return queryParam && queryParam.trim().length > 0
          ? queryParam
          : undefined;
      })();
      const filtersParam = getQueryParam(req, "filters");
      const filters = filtersParam ? JSON.parse(filtersParam) : undefined;

      const response = await service.fetchCataloguePage(extensionId, {
        page,
        query,
        filters,
      });

      if (response.items.length > 0) {
        for (const item of response.items) {
          const providedUrls = sanitizeCoverUrls([
            ...(item.coverUrls ?? []),
            item.coverUrl,
          ]);

          let mergedUrls = providedUrls;
          const storedOrder = repository?.getMangaCoverUrls(extensionId, item.id);
          if (storedOrder && storedOrder.length > 0) {
            mergedUrls = mergeCoverUrlOrder(storedOrder, providedUrls);
          }

          if (mergedUrls.length > 0) {
            item.coverUrls = mergedUrls;
            item.coverUrl = mergedUrls[0];
            if (
              repository &&
              (!storedOrder || !arraysEqual(storedOrder, mergedUrls))
            ) {
              repository.updateMangaCoverUrls(extensionId, item.id, mergedUrls);
            }
          }

          if (coverCacheManager) {
            try {
              const cached = await coverCacheManager.getCachedCover(
                extensionId,
                item.id,
              );

              if (cached) {
                item.cachedCover = {
                  dataUrl: cached.dataUrl,
                  sourceUrl: cached.sourceUrl,
                  updatedAt: new Date(cached.updatedAt).toISOString(),
                  expiresAt: cached.expiresAt
                    ? new Date(cached.expiresAt).toISOString()
                    : undefined,
                  mimeType: cached.mimeType,
                  bytes: cached.bytes,
                };
              } else {
                const urlsForCache = item.coverUrls?.length
                  ? item.coverUrls
                  : item.coverUrl
                  ? [item.coverUrl]
                  : [];

                if (urlsForCache.length > 0) {
                  void coverCacheManager
                    .ensureCachedCover(extensionId, item.id, urlsForCache, {
                      title: item.title,
                      slug: item.slug,
                      urls: urlsForCache,
                    })
                    .catch((error) => {
                      console.warn(
                        `Failed to prefetch cover for ${item.id}`,
                        error,
                      );
                    });
                }
              }
            } catch (error) {
              console.warn(
                `Failed to read cover cache for ${item.id}`,
                error,
              );
            }
          }
        }
      }

      if (repository && response.items.length > 0) {
        try {
          repository.upsertMangaSummaries(extensionId, response.items);
        } catch (error) {
          console.warn("Failed to cache catalogue items for slug lookup", error);
        }
      }

      res.json({ page, ...response, extensionId });
    } catch (error) {
      handleError(res, error, "Failed to fetch catalogue page");
    }
  });

  app.get("/api/manga/by-slug/:slug", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const includeChapters = req.query.includeChapters !== "false";
      const result = await service.syncMangaBySlug(
        extensionId,
        req.params.slug,
        { includeChapters },
      );
      await enrichMangaDetails(extensionId, result.details);
      res.json({
        details: result.details,
        chaptersFetched: result.chaptersFetched,
        extensionId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to fetch manga details by slug");
    }
  });

  app.get("/api/manga/:id", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const includeChapters = req.query.includeChapters !== "false";
      const identifier = req.params.id;
      const slugPattern = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
      const useSlug = slugPattern.test(identifier);

      const result = useSlug
        ? await service.syncMangaBySlug(extensionId, identifier, {
            includeChapters,
          })
        : await service.syncManga(extensionId, identifier, {
            includeChapters,
          });
      await enrichMangaDetails(extensionId, result.details);
      res.json({
        details: result.details,
        chaptersFetched: result.chaptersFetched,
        extensionId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to fetch manga details");
    }
  });

  // Refresh cached manga data (useful when images fail to load or data is stale)
  app.post("/api/manga/:id/refresh", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const identifier = req.params.id;
      const slugPattern = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
      const useSlug = slugPattern.test(identifier);

      // Force refresh by re-fetching from extension
      const result = useSlug
        ? await service.syncMangaBySlug(extensionId, identifier, {
            includeChapters: true,
          })
        : await service.syncManga(extensionId, identifier, {
            includeChapters: true,
          });

      const details = result.details;
      await enrichMangaDetails(extensionId, details);

      res.json({
        details,
        refreshed: true,
        extensionId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to refresh manga cache");
    }
  });

  app.post("/api/manga/:id/covers/report", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    const payload = req.body ?? {};
    const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";
    const status = payload.status;
    const attempted = Array.isArray(payload.attemptedUrls)
      ? sanitizeCoverUrls(payload.attemptedUrls as string[])
      : [];

    if (!rawUrl) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    if (status !== "success" && status !== "failure") {
      res.status(400).json({ error: "status must be 'success' or 'failure'" });
      return;
    }

    if (!repository) {
      res.status(503).json({ error: "Persistent storage is not available" });
      return;
    }

    const mangaId = req.params.id;

    try {
      if (status === "success") {
        const preferred = sanitizeCoverUrls([rawUrl, ...attempted]);
        const storedOrder = repository.getMangaCoverUrls(extensionId, mangaId) ?? [];
        const merged = mergeCoverUrlOrder(preferred, storedOrder);
        if (merged.length > 0) {
          repository.updateMangaCoverUrls(extensionId, mangaId, merged);

          if (coverCacheManager) {
            void coverCacheManager
              .ensureCachedCover(extensionId, mangaId, merged, {
                urls: merged,
              })
              .catch((error) => {
                console.warn(
                  `Failed to refresh cover cache after success report for ${mangaId}`,
                  error,
                );
              });
          }
        }
      } else {
        const storedOrder = repository.getMangaCoverUrls(extensionId, mangaId) ?? [];
        const filteredStored = storedOrder.filter((entry) => entry !== rawUrl);
        const newOrder = sanitizeCoverUrls([
          ...attempted.filter((url) => url !== rawUrl),
          ...filteredStored,
          rawUrl,
        ]);

        if (newOrder.length > 0) {
          repository.updateMangaCoverUrls(extensionId, mangaId, newOrder);
        }
      }

      res.status(204).end();
    } catch (error) {
      handleError(res, error, "Failed to record cover report");
    }
  });

  app.get("/api/manga/:id/chapters/:chapterId/pages", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const result = await service.syncChapterPages(
        extensionId,
        req.params.id,
        req.params.chapterId
      );
      res.json({ ...result, extensionId });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to fetch chapter pages");
    }
  });

  app.get(
    "/api/manga/:id/chapters/:chapterId/pages/chunk/:chunk",
    async (req, res) => {
      const extensionId = ensureExtensionLoaded(req, res);
      if (!extensionId) return;

      const chunkIndex = Number.parseInt(req.params.chunk, 10);
      const chunkSize = Number.parseInt(req.query.size as string, 10) || 10;

      if (Number.isNaN(chunkIndex) || chunkIndex < 0) {
        res.status(400).json({ error: "Invalid chunk index" });
        return;
      }

      try {
        const result = await service.fetchChapterPagesChunk(
          extensionId,
          req.params.id,
          req.params.chapterId,
          chunkIndex,
          chunkSize,
        );
        res.json({ ...result, extensionId });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("could not be resolved")
        ) {
          res.status(404).json({ error: error.message });
          return;
        }
        handleError(res, error, "Failed to fetch chapter pages chunk");
      }
    },
  );

  // Clear chapter cache for a manga
  app.delete("/api/manga/:id/chapters", async (req, res) => {
    try {
      if (!repository) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      const { id: mangaId } = req.params;
      repository.deleteChaptersForManga(mangaId);
      res.json({ success: true, message: `Chapters cleared for manga ${mangaId}` });
    } catch (error) {
      handleError(res, error, "Failed to clear chapters");
    }
  });

  app.get("/api/filters", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const filters = (await service.getFilters(extensionId)) as
        | ExtensionFilters
        | undefined;
      res.json({ filters, extensionId });
    } catch (error) {
      handleError(res, error, "Failed to fetch filters");
    }
  });

  // Reading progress endpoints
  app.post("/api/reading-progress", async (req, res) => {
    try {
      if (!repository) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      const { mangaId, chapterId, currentPage, totalPages, scrollPosition } =
        req.body;

      if (!mangaId || !chapterId || currentPage === undefined || !totalPages) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      repository.saveReadingProgress(
        mangaId,
        chapterId,
        currentPage,
        totalPages,
        scrollPosition
      );

      res.status(200).json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to save reading progress");
    }
  });

  app.get("/api/reading-progress/:mangaId/:chapterId", async (req, res) => {
    try {
      if (!repository) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      const { mangaId, chapterId } = req.params;

      if (!mangaId || !chapterId) {
        res.status(400).json({ error: "Missing manga ID or chapter ID" });
        return;
      }

      const progress = repository.getReadingProgress(
        decodeURIComponent(mangaId),
        decodeURIComponent(chapterId)
      );

      if (!progress) {
        res.status(404).json({ error: "No progress found" });
        return;
      }

      res.json(progress);
    } catch (error) {
      handleError(res, error, "Failed to get reading progress");
    }
  });

  app.get("/api/reading-progress", async (_req, res) => {
    try {
      if (!repository) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      const allProgress = repository.getAllReadingProgress();
      res.json(allProgress);
    } catch (error) {
      handleError(res, error, "Failed to get all reading progress");
    }
  });

  app.get("/api/reading-progress/enriched", async (req, res) => {
    try {
      if (!repository) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      const limitParam = getQueryParam(req, "limit");
      const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.max(parsedLimit, 1), 50)
          : 12;

      const progressEntries = repository.getLatestReadingProgressPerManga();
      const window = progressEntries.slice(0, limit);
      const defaultExtensionId = resolveExtensionId(req);
      const uniqueMangaIds = Array.from(
        new Set(window.map((entry) => entry.mangaId))
      );

      type EnrichedRecord = {
        manga: MangaDetails | null;
        error: string | null;
        extensionId?: string;
      };

      const enrichedMap = new Map<string, EnrichedRecord>();

      await Promise.all(
        uniqueMangaIds.map(async (mangaId) => {
          let cached = repository.getMangaWithDetails(mangaId);
          const extensionId = cached?.extensionId ?? defaultExtensionId;

          const result: EnrichedRecord = {
            manga: null,
            error: null,
            extensionId,
          };

          const commitResult = () => {
            enrichedMap.set(mangaId, result);
          };

          if (cached?.details) {
            result.manga = {
              ...cached.details,
              chapters: cached.details.chapters ?? cached.chapters,
            };
            commitResult();
            return;
          }

          if (!extensionId) {
            result.error =
              "Extension not available for this manga. Enable the source to continue.";
            commitResult();
            return;
          }

          if (!host.isLoaded(extensionId)) {
            result.error = `Extension ${extensionId} is not enabled.`;
            commitResult();
            return;
          }

          try {
            const requiresChapterRefresh = !(cached?.chapters?.length ?? 0);
            await service.syncManga(extensionId, mangaId, {
              forceChapterRefresh: requiresChapterRefresh,
            });
            cached = repository.getMangaWithDetails(mangaId);
            if (cached?.details) {
              result.manga = {
                ...cached.details,
                chapters: cached.details.chapters ?? cached.chapters,
              };
            } else {
              result.error = "Manga details not available after sync.";
            }
          } catch (error) {
            console.error(
              `Failed to hydrate manga ${mangaId} for reading progress`,
              error
            );
            result.error =
              error instanceof Error ? error.message : String(error);
          }

          commitResult();
        })
      );

      const enriched = window.map((entry) => {
        const record = enrichedMap.get(entry.mangaId);
        return {
          ...entry,
          manga: record?.manga ?? null,
          error: record?.error ?? null,
          extensionId: record?.extensionId,
        };
      });

      res.json(enriched);
    } catch (error) {
      handleError(res, error, "Failed to get enriched reading progress");
    }
  });

  // DANGER ZONE: Nuclear option to clear all user data
  app.post("/api/danger/nuke-user-data", async (_req, res) => {
    try {
      if (!repository) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      // Check if we're in development mode
      const isDev = process.env.NODE_ENV !== "production";
      if (!isDev) {
        res.status(403).json({
          error: "This endpoint is only available in development mode",
        });
        return;
      }

      repository.nukeUserData();

      res.json({
        success: true,
        message: "All user data has been cleared",
      });
    } catch (error) {
      handleError(res, error, "Failed to nuke user data");
    }
  });

  // ==========================================================================
  // Offline Storage Endpoints
  // ==========================================================================

  // Queue a chapter for download
  app.post("/api/offline/download/chapter", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { extensionId, mangaId, chapterId, priority } = req.body;

      if (!extensionId || !mangaId || !chapterId) {
        res.status(400).json({
          error: "extensionId, mangaId, and chapterId are required",
        });
        return;
      }

      const queueId = await offlineStorageManager.queueChapterDownload(
        extensionId,
        mangaId,
        chapterId,
        { priority: priority ?? 0 }
      );

      res.status(201).json({ queueId, success: true });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("already downloaded")
      ) {
        res.status(409).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to queue chapter download");
    }
  });

  // Queue a manga (all chapters or specific chapters) for download
  app.post("/api/offline/download/manga", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { extensionId, mangaId, chapterIds, priority } = req.body;

      if (!extensionId || !mangaId) {
        res.status(400).json({
          error: "extensionId and mangaId are required",
        });
        return;
      }

      const queueIds = await offlineStorageManager.queueMangaDownload(
        extensionId,
        mangaId,
        { chapterIds, priority: priority ?? 0 }
      );

      res.status(201).json({ queueIds, success: true });
    } catch (error) {
      handleError(res, error, "Failed to queue manga download");
    }
  });

  // Get all downloaded manga
  app.get("/api/offline/manga", async (_req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const manga = await offlineStorageManager.getDownloadedManga();
      res.json({ manga });
    } catch (error) {
      handleError(res, error, "Failed to get downloaded manga");
    }
  });

  // Get downloaded manga by ID
  app.get("/api/offline/manga/:mangaId", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res.status(400).json({ error: "extensionId query parameter is required" });
        return;
      }

      const metadata = await offlineStorageManager.getMangaMetadata(
        extensionId,
        req.params.mangaId
      );

      if (!metadata) {
        res.status(404).json({ error: "Manga not found in offline storage" });
        return;
      }

      res.json({ manga: metadata });
    } catch (error) {
      handleError(res, error, "Failed to get manga metadata");
    }
  });

  // Get downloaded chapters for a manga
  app.get("/api/offline/manga/:mangaId/chapters", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res.status(400).json({ error: "extensionId query parameter is required" });
        return;
      }

      const chapters = await offlineStorageManager.getDownloadedChapters(
        extensionId,
        req.params.mangaId
      );

      res.json({ chapters });
    } catch (error) {
      handleError(res, error, "Failed to get downloaded chapters");
    }
  });

  // Get chapter pages metadata
  app.get("/api/offline/manga/:mangaId/chapters/:chapterId/pages", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res.status(400).json({ error: "extensionId query parameter is required" });
        return;
      }

      const pages = await offlineStorageManager.getChapterPages(
        extensionId,
        req.params.mangaId,
        req.params.chapterId
      );

      if (!pages) {
        res.status(404).json({ error: "Chapter not found in offline storage" });
        return;
      }

      res.json({ pages });
    } catch (error) {
      handleError(res, error, "Failed to get chapter pages");
    }
  });

  // Check if a chapter is downloaded
  app.get("/api/offline/manga/:mangaId/chapters/:chapterId/status", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res.status(400).json({ error: "extensionId query parameter is required" });
        return;
      }

      const isDownloaded = await offlineStorageManager.isChapterDownloaded(
        extensionId,
        req.params.mangaId,
        req.params.chapterId
      );

      res.json({ isDownloaded });
    } catch (error) {
      handleError(res, error, "Failed to check chapter download status");
    }
  });

  // Delete a downloaded chapter
  app.delete("/api/offline/manga/:mangaId/chapters/:chapterId", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res.status(400).json({ error: "extensionId query parameter is required" });
        return;
      }

      await offlineStorageManager.deleteChapter(
        extensionId,
        req.params.mangaId,
        req.params.chapterId
      );

      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to delete chapter");
    }
  });

  // Delete an entire manga
  app.delete("/api/offline/manga/:mangaId", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res.status(400).json({ error: "extensionId query parameter is required" });
        return;
      }

      await offlineStorageManager.deleteManga(extensionId, req.params.mangaId);

      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to delete manga");
    }
  });

  // Get download queue
  app.get("/api/offline/queue", async (_req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queue = await offlineStorageManager.getQueuedDownloads();
      res.json({ queue });
    } catch (error) {
      handleError(res, error, "Failed to get download queue");
    }
  });

  // Get download progress for a queue item
  app.get("/api/offline/queue/:queueId", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queueId = Number.parseInt(req.params.queueId, 10);
      if (Number.isNaN(queueId)) {
        res.status(400).json({ error: "Invalid queue ID" });
        return;
      }

      const progress = await offlineStorageManager.getDownloadProgress(queueId);

      if (!progress) {
        res.status(404).json({ error: "Queue item not found" });
        return;
      }

      res.json({ progress });
    } catch (error) {
      handleError(res, error, "Failed to get download progress");
    }
  });

  // Cancel a queued download
  app.post("/api/offline/queue/:queueId/cancel", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queueId = Number.parseInt(req.params.queueId, 10);
      if (Number.isNaN(queueId)) {
        res.status(400).json({ error: "Invalid queue ID" });
        return;
      }

      await offlineStorageManager.cancelDownload(queueId);

      res.json({ success: true });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("not found")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error instanceof Error &&
        error.message.includes("currently in progress")
      ) {
        res.status(409).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to cancel download");
    }
  });

  app.post("/api/offline/queue/:queueId/retry", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queueId = Number.parseInt(req.params.queueId, 10);
      if (Number.isNaN(queueId)) {
        res.status(400).json({ error: "Invalid queue ID" });
        return;
      }

      await offlineStorageManager.retryDownload(queueId);

      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      handleError(res, error, "Failed to retry download");
    }
  });

  app.post("/api/offline/queue/retry-frozen", async (_req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const retriedIds = await offlineStorageManager.retryFrozenDownloads();

      res.json({ success: true, retriedCount: retriedIds.length, retriedIds });
    } catch (error) {
      handleError(res, error, "Failed to retry frozen downloads");
    }
  });

  // Get storage statistics
  app.get("/api/offline/storage", async (_req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const stats = await offlineStorageManager.getStorageStats();
      res.json({ stats });
    } catch (error) {
      handleError(res, error, "Failed to get storage stats");
    }
  });

  // Server-Sent Events endpoint for real-time download progress
  app.get("/api/offline/events", async (req, res) => {
    if (!downloadWorker) {
      res.status(503).json({ error: "Offline storage not available" });
      return;
    }

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial connection event
    res.write("event: connected\n");
    res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    // Listen to download worker events
    const unsubscribe = downloadWorker.on((event) => {
      try {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error("Error writing SSE event:", error);
      }
    });

    // Send heartbeat every 15 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write("event: heartbeat\n");
        res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      } catch (error) {
        console.error("Error sending heartbeat:", error);
        clearInterval(heartbeat);
      }
    }, 15000);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Get download history
  app.get("/api/offline/history", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined;
      const history = await offlineStorageManager.getDownloadHistory(limit);

      res.json({ history });
    } catch (error) {
      handleError(res, error, "Failed to get download history");
    }
  });

  // Delete a download history item
  app.delete("/api/offline/history/:historyId", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const historyId = Number.parseInt(req.params.historyId, 10);
      if (Number.isNaN(historyId)) {
        res.status(400).json({ error: "Invalid history ID" });
        return;
      }

      await offlineStorageManager.deleteHistoryItem(historyId);

      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to delete history item");
    }
  });

  // Clear all download history
  app.delete("/api/offline/history", async (_req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      await offlineStorageManager.clearDownloadHistory();

      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to clear download history");
    }
  });

  // Serve offline page images
  app.get("/api/offline/page/:mangaId/:chapterId/:filename", async (req, res) => {
    try {
      if (!offlineStorageManager) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { mangaId, chapterId, filename } = req.params;
      const pagePath = offlineStorageManager.getPagePath(mangaId, chapterId, filename);

      if (!pagePath) {
        res.status(404).json({ error: "Page not found in offline storage" });
        return;
      }

      // Check if file exists
      if (!fs.existsSync(pagePath)) {
        res.status(404).json({ error: "Page file not found" });
        return;
      }

      // Determine content type from extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.sendFile(pagePath);
    } catch (error) {
      handleError(res, error, "Failed to serve offline page");
    }
  });

  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(port, () => {
      console.log(
        `Catalog server listening on http://localhost:${port} (node ${process.version}, abi ${process.versions.modules})`,
      );
      resolve(listener);
    });
  });

  return {
    port,
    extensionId: activeExtensionId,
    loadedExtensions: host.listLoadedExtensions().map((entry) => entry.id),
    server,
    close: async () => {
      if (downloadWorker) {
        await downloadWorker.stop();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      database?.close();
    },
  };
}

const entryFile = process.argv[1];

if (entryFile) {
  const entryUrl = pathToFileURL(entryFile).href;
  if (entryUrl === import.meta.url) {
    void startCatalogServer().catch((error) => {
      console.error("Failed to start catalog server", error);
      process.exit(1);
    });
  }
}

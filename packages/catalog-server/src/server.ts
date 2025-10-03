import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import cors from "cors";
import type { Server } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionFilters } from "@jamra/extension-sdk";
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
  const storage = database
    ? new ExtensionStorage(path.join(path.dirname(database.path), "extensions"))
    : undefined;

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

        if (
          !existing ||
          !existing.entryPath ||
          !fs.existsSync(existing.entryPath)
        ) {
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

  const handleError = (
    res: Response,
    error: unknown,
    message: string,
    status = 500
  ) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(message, detail);
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
      handleError(
        res,
        error,
        "Failed to enable extension",
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

      res.json({ page, ...response, extensionId });
    } catch (error) {
      handleError(res, error, "Failed to fetch catalogue page");
    }
  });

  app.get("/api/manga/:id", async (req, res) => {
    const extensionId = ensureExtensionLoaded(req, res);
    if (!extensionId) return;

    try {
      const includeChapters = req.query.includeChapters !== "false";
      const result = await service.syncManga(extensionId, req.params.id, {
        includeChapters,
      });
      res.json({
        details: result.details,
        chaptersFetched: result.chaptersFetched,
        extensionId,
      });
    } catch (error) {
      handleError(res, error, "Failed to fetch manga details");
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
      handleError(res, error, "Failed to fetch chapter pages");
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

  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(port, () => {
      console.log(`Catalog server listening on http://localhost:${port}`);
      resolve(listener);
    });
  });

  return {
    port,
    extensionId: activeExtensionId,
    loadedExtensions: host.listLoadedExtensions().map((entry) => entry.id),
    server,
    close: async () => {
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

import { access, constants as fsConstants } from "node:fs/promises";
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
import { CoverUrlService } from "./services/coverUrlService.js";
import { SERVER_CONFIG, OFFLINE_CONFIG, CACHE_CONFIG, HISTORY_CONFIG } from "./config/index.js";
import {
  DatabaseUnavailableError,
  ValidationError,
  InvalidRequestError,
} from "./errors/AppError.js";
import { handleError as handleAppError } from "./middleware/errorHandler.js";
import {
  ReadingProgressSchema,
  HistoryEntrySchema,
  AddToLibrarySchema,
  UpdateLibraryEntrySchema,
  CoverReportSchema,
} from "./validation/schemas.js";

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

const DEFAULT_PORT = Number(process.env.JAMRA_API_PORT ?? SERVER_CONFIG.DEFAULT_PORT);

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

function validateRequestBody<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error && typeof error === "object" && "errors" in error) {
      const zodError = error as { errors: Array<{ path: (string | number)[]; message: string }> };
      const fields: Record<string, string[]> = {};
      for (const err of zodError.errors) {
        const key = err.path.join(".");
        if (!fields[key]) fields[key] = [];
        fields[key].push(err.message);
      }
      throw new ValidationError("Invalid request body", fields);
    }
    throw new ValidationError("Invalid request body");
  }
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
  const coverUrlService = new CoverUrlService(repository);

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
    const providedUrls = coverUrlService.sanitize([
      ...(details.coverUrls ?? []),
      details.coverUrl,
    ]);

    const storedOrder = coverUrlService.getStoredOrder(extensionId, details.id);
    let mergedUrls = providedUrls;
    if (storedOrder && storedOrder.length > 0) {
      mergedUrls = coverUrlService.merge(storedOrder, providedUrls);
    }

    if (mergedUrls.length > 0) {
      details.coverUrls = mergedUrls;
      details.coverUrl = mergedUrls[0];
      if (
        repository &&
        (!storedOrder || !coverUrlService.areArraysEqual(storedOrder, mergedUrls))
      ) {
        coverUrlService.updateOrder(extensionId, details.id, mergedUrls);
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

    let bootstrapExists = false;
    if (bootstrapExtensionPath) {
      try {
        await access(bootstrapExtensionPath, fsConstants.F_OK);
        bootstrapExists = true;
      } catch {
        bootstrapExists = false;
      }
    }

    if (bootstrapExists) {
      try {
        const bootstrapModule = await importExtension(bootstrapExtensionPath!);
        const bootstrapId = bootstrapModule.manifest.id;
        const existing = installed.find(
          (extension) => extension.id === bootstrapId
        );

        let entryPathExists = false;
        if (existing?.entryPath) {
          try {
            await access(existing.entryPath, fsConstants.F_OK);
            entryPathExists = true;
          } catch {
            entryPathExists = false;
          }
        }

        const needsInstall = !existing || !existing.entryPath || !entryPathExists;
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
        {
          concurrency: OFFLINE_CONFIG.DOWNLOAD_CONCURRENCY,
          pollingInterval: OFFLINE_CONFIG.DOWNLOAD_POLL_INTERVAL_MS,
        }
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
  ) => {
    // Use the new error handling system
    handleAppError(res, error, message);
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
          "Failed to install extension"
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
        "Failed to install extension"
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
        `Failed to enable ${extName} extension`
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
        "Failed to disable extension"
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
        "Failed to update extension settings"
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
        "Failed to uninstall extension"
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
          const providedUrls = coverUrlService.sanitize([
            ...(item.coverUrls ?? []),
            item.coverUrl,
          ]);

          let mergedUrls = providedUrls;
          const storedOrder = coverUrlService.getStoredOrder(extensionId, item.id);
          if (storedOrder && storedOrder.length > 0) {
            mergedUrls = coverUrlService.merge(storedOrder, providedUrls);
          }

          if (mergedUrls.length > 0) {
            item.coverUrls = mergedUrls;
            item.coverUrl = mergedUrls[0];
            if (
              repository &&
              (!storedOrder || !coverUrlService.areArraysEqual(storedOrder, mergedUrls))
            ) {
              coverUrlService.updateOrder(extensionId, item.id, mergedUrls);
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

    const mangaId = req.params.id;

    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(CoverReportSchema, req.body);
      const rawUrl = validated.url;
      const status = validated.status;
      const attempted = validated.attemptedUrls ?? [];
      if (status === "success") {
        coverUrlService.reportSuccess(extensionId, mangaId, rawUrl, attempted);

        if (coverCacheManager) {
          const merged = coverUrlService.getStoredOrder(extensionId, mangaId) ?? [];
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
      } else {
        coverUrlService.reportFailure(extensionId, mangaId, rawUrl, attempted);
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
        throw new DatabaseUnavailableError();
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
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(ReadingProgressSchema, req.body);

      repository.saveReadingProgress(
        validated.mangaId,
        validated.chapterId,
        validated.currentPage,
        validated.totalPages,
        validated.scrollPosition ?? 0
      );

      res.status(200).json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to save reading progress");
    }
  });

  app.get("/api/reading-progress/:mangaId/:chapterId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
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
        throw new DatabaseUnavailableError();
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
        throw new DatabaseUnavailableError();
      }

      const limitParam = getQueryParam(req, "limit");
      const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.max(parsedLimit, 1), CACHE_CONFIG.MAX_LIMIT)
          : CACHE_CONFIG.DEFAULT_LIMIT;

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

  // ==================== History Endpoints ====================

  app.post("/api/history", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(HistoryEntrySchema, req.body);

      const id = repository.logHistoryEntry({
        mangaId: validated.mangaId,
        chapterId: validated.chapterId,
        actionType: validated.actionType,
        timestamp: req.body.timestamp,
        extensionId: req.body.extensionId,
        metadata: validated.metadata,
      });

      res.status(201).json({ id, success: true });
    } catch (error) {
      handleError(res, error, "Failed to log history entry");
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const limitParam = getQueryParam(req, "limit");
      const offsetParam = getQueryParam(req, "offset");
      const mangaId = getQueryParam(req, "mangaId");
      const actionType = getQueryParam(req, "actionType");
      const startDateParam = getQueryParam(req, "startDate");
      const endDateParam = getQueryParam(req, "endDate");
      const enriched = getQueryParam(req, "enriched");

      const limit = limitParam ? Number.parseInt(limitParam, 10) : HISTORY_CONFIG.DEFAULT_LIMIT;
      const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;
      const startDate = startDateParam ? Number.parseInt(startDateParam, 10) : undefined;
      const endDate = endDateParam ? Number.parseInt(endDateParam, 10) : undefined;

      const options = {
        limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), HISTORY_CONFIG.MAX_LIMIT) : HISTORY_CONFIG.DEFAULT_LIMIT,
        offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
        mangaId,
        actionType,
        startDate: Number.isFinite(startDate) ? startDate : undefined,
        endDate: Number.isFinite(endDate) ? endDate : undefined,
      };

      const history = enriched === "true"
        ? repository.getEnrichedHistory(options)
        : repository.getHistory(options);

      res.json(history);
    } catch (error) {
      handleError(res, error, "Failed to get history");
    }
  });

  app.get("/api/history/stats", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const startDateParam = getQueryParam(req, "startDate");
      const endDateParam = getQueryParam(req, "endDate");

      const startDate = startDateParam ? Number.parseInt(startDateParam, 10) : undefined;
      const endDate = endDateParam ? Number.parseInt(endDateParam, 10) : undefined;

      const stats = repository.getHistoryStats({
        startDate: Number.isFinite(startDate) ? startDate : undefined,
        endDate: Number.isFinite(endDate) ? endDate : undefined,
      });

      res.json(stats);
    } catch (error) {
      handleError(res, error, "Failed to get history stats");
    }
  });

  app.delete("/api/history/:id", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { id } = req.params;
      const numericId = Number.parseInt(id, 10);

      if (!Number.isFinite(numericId)) {
        res.status(400).json({ error: "Invalid history entry ID" });
        return;
      }

      repository.deleteHistoryEntry(numericId);
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to delete history entry");
    }
  });

  app.delete("/api/history", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const beforeTimestampParam = getQueryParam(req, "beforeTimestamp");
      const beforeTimestamp = beforeTimestampParam
        ? Number.parseInt(beforeTimestampParam, 10)
        : undefined;

      const deletedCount = repository.clearHistory(
        Number.isFinite(beforeTimestamp) ? beforeTimestamp : undefined
      );

      res.json({ success: true, deletedCount });
    } catch (error) {
      handleError(res, error, "Failed to clear history");
    }
  });

  // ==================== Library Management Endpoints ====================

  app.post("/api/library", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(AddToLibrarySchema, req.body);

      const entry = repository.addToLibrary(
        validated.mangaId,
        validated.extensionId,
        validated.status,
        {
          personalRating: validated.personalRating,
          favorite: validated.favorite,
          notes: validated.notes,
          startedAt: validated.startedAt,
          completedAt: validated.completedAt,
        }
      );

      res.status(201).json(entry);
    } catch (error) {
      handleError(res, error, "Failed to add to library");
    }
  });

  app.put("/api/library/:mangaId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        throw new InvalidRequestError("Missing manga ID");
      }

      const validated = validateRequestBody(UpdateLibraryEntrySchema, req.body);

      repository.updateLibraryEntry(decodeURIComponent(mangaId), {
        status: validated.status,
        personalRating: validated.personalRating,
        favorite: validated.favorite,
        notes: validated.notes,
        startedAt: validated.startedAt,
        completedAt: validated.completedAt,
      });

      const updated = repository.getLibraryEntry(decodeURIComponent(mangaId));
      if (!updated) {
        res.status(404).json({ error: "Library entry not found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      handleError(res, error, "Failed to update library entry");
    }
  });

  app.delete("/api/library/:mangaId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        res.status(400).json({ error: "Missing manga ID" });
        return;
      }

      repository.removeFromLibrary(decodeURIComponent(mangaId));
      res.status(200).json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to remove from library");
    }
  });

  app.get("/api/library/:mangaId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        res.status(400).json({ error: "Missing manga ID" });
        return;
      }

      const entry = repository.getLibraryEntry(decodeURIComponent(mangaId));
      if (!entry) {
        res.status(404).json({ error: "Library entry not found" });
        return;
      }

      res.json(entry);
    } catch (error) {
      handleError(res, error, "Failed to get library entry");
    }
  });

  app.get("/api/library", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const status = getQueryParam(req, "status");
      const favoriteParam = getQueryParam(req, "favorite");
      const favorite = favoriteParam === "true" ? true : favoriteParam === "false" ? false : undefined;

      const entries = repository.getLibraryEntries({ status, favorite });
      res.json(entries);
    } catch (error) {
      handleError(res, error, "Failed to get library entries");
    }
  });

  app.get("/api/library-enriched", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const status = getQueryParam(req, "status");
      const favoriteParam = getQueryParam(req, "favorite");
      const favorite = favoriteParam === "true" ? true : favoriteParam === "false" ? false : undefined;

      const entries = repository.getEnrichedLibraryEntries({ status, favorite });
      res.json(entries);
    } catch (error) {
      handleError(res, error, "Failed to get enriched library entries");
    }
  });

  app.get("/api/library-stats", async (_req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const stats = repository.getLibraryStats();
      res.json(stats);
    } catch (error) {
      handleError(res, error, "Failed to get library stats");
    }
  });

  // ==================== Library Tags Endpoints ====================

  app.post("/api/library/tags", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { name, color } = req.body;
      if (!name) {
        res.status(400).json({ error: "Missing required field: name" });
        return;
      }

      const tag = repository.createLibraryTag(name, color);
      res.status(201).json(tag);
    } catch (error) {
      handleError(res, error, "Failed to create library tag");
    }
  });

  app.delete("/api/library/tags/:tagId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { tagId } = req.params;
      if (!tagId) {
        res.status(400).json({ error: "Missing tag ID" });
        return;
      }

      const parsedTagId = Number.parseInt(tagId, 10);
      if (Number.isNaN(parsedTagId)) {
        res.status(400).json({ error: "Invalid tag ID" });
        return;
      }

      repository.deleteLibraryTag(parsedTagId);
      res.status(200).json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to delete library tag");
    }
  });

  app.get("/api/library/tags", async (_req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const tags = repository.getLibraryTags();
      res.json(tags);
    } catch (error) {
      handleError(res, error, "Failed to get library tags");
    }
  });

  app.post("/api/library/:mangaId/tags/:tagId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId, tagId } = req.params;
      if (!mangaId || !tagId) {
        res.status(400).json({ error: "Missing manga ID or tag ID" });
        return;
      }

      const parsedTagId = Number.parseInt(tagId, 10);
      if (Number.isNaN(parsedTagId)) {
        res.status(400).json({ error: "Invalid tag ID" });
        return;
      }

      repository.addTagToLibraryEntry(decodeURIComponent(mangaId), parsedTagId);
      res.status(200).json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to add tag to library entry");
    }
  });

  app.delete("/api/library/:mangaId/tags/:tagId", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId, tagId } = req.params;
      if (!mangaId || !tagId) {
        res.status(400).json({ error: "Missing manga ID or tag ID" });
        return;
      }

      const parsedTagId = Number.parseInt(tagId, 10);
      if (Number.isNaN(parsedTagId)) {
        res.status(400).json({ error: "Invalid tag ID" });
        return;
      }

      repository.removeTagFromLibraryEntry(decodeURIComponent(mangaId), parsedTagId);
      res.status(200).json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to remove tag from library entry");
    }
  });

  app.get("/api/library/:mangaId/tags", async (req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        res.status(400).json({ error: "Missing manga ID" });
        return;
      }

      const tags = repository.getTagsForLibraryEntry(decodeURIComponent(mangaId));
      res.json(tags);
    } catch (error) {
      handleError(res, error, "Failed to get tags for library entry");
    }
  });

  // DANGER ZONE: Nuclear option to clear all user data
  app.post("/api/danger/nuke-user-data", async (_req, res) => {
    try {
      if (!repository) {
        throw new DatabaseUnavailableError();
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

    // Send heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write("event: heartbeat\n");
        res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      } catch (error) {
        console.error("Error sending heartbeat:", error);
        clearInterval(heartbeat);
      }
    }, SERVER_CONFIG.SSE_HEARTBEAT_INTERVAL_MS);

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
      try {
        await access(pagePath, fsConstants.F_OK);
      } catch {
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

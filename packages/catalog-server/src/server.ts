import { access, constants as fsConstants } from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import type { Server } from "node:http";
import { pathToFileURL } from "node:url";
import type { MangaDetails } from "@jamra/extension-sdk";
import {
  CatalogDatabase,
  ExtensionRepository,
  MangaRepository,
  ChapterRepository,
  ReadingProgressRepository,
  HistoryRepository,
  LibraryRepository,
  CoverCacheRepository,
  SettingsRepository,
} from "@jamra/catalog-db";
import { CatalogService } from "@jamra/catalog-service";
import { ExtensionHost, importExtension } from "@jamra/extension-host";
import { ExtensionManager } from "./extensions/extensionManager.js";
import { ExtensionStorage } from "./extensions/storage.js";
import { ExtensionRegistryService } from "./extensions/registryService.js";
import { DownloadWorkerHost } from "@jamra/offline-storage";
import {
  CoverCacheManager,
  type CoverCacheSettings,
} from "./services/coverCacheManager.js";
import { CoverUrlService } from "./services/coverUrlService.js";
import {
  SERVER_CONFIG,
  OFFLINE_CONFIG,
} from "./config/index.js";
import { createRoutes } from "./routes/index.js";
import type { ServerDependencies } from "./types/server-dependencies.js";
import { resolveRegistrySources } from "./utils/extension-helpers.js";

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

const DEFAULT_PORT = Number(
  process.env.JAMRA_API_PORT ?? SERVER_CONFIG.DEFAULT_PORT,
);

function resolveExtensionPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }

  return path.resolve(
    process.cwd(),
    "packages/example-extension/dist/index.js",
  );
}

export async function startCatalogServer(
  options: CatalogServerOptions = {},
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
      options.extensionPath ?? process.env.JAMRA_EXTENSION_PATH,
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
        "Failed to initialize SQLite catalog store. Falling back to in-memory cache.",
      );
      console.warn(String(error));
      database = undefined;
    }
  }

  const host = new ExtensionHost({
    database,
  });

  const repositories = database
    ? {
        extensions: new ExtensionRepository(database.db),
        manga: new MangaRepository(database.db),
        chapters: new ChapterRepository(database.db),
        readingProgress: new ReadingProgressRepository(database.db),
        history: new HistoryRepository(database.db),
        library: new LibraryRepository(database.db),
        coverCache: new CoverCacheRepository(database.db),
        settings: new SettingsRepository(database.db),
        db: database.db,
      }
    : undefined;
  const coverCacheSettings =
    repositories?.settings.getAppSetting<CoverCacheSettings>("coverCacheSettings");
  const coverCacheManager = repositories
    ? new CoverCacheManager(repositories, coverCacheSettings ?? undefined)
    : undefined;
  const coverUrlService = new CoverUrlService(repositories);

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
        repositories &&
        (!storedOrder ||
          !coverUrlService.areArraysEqual(storedOrder, mergedUrls))
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
  const dataRoot = database
    ? path.dirname(database.path)
    : path.join(process.cwd(), ".jamra-data");

  let downloadWorker: DownloadWorkerHost | undefined;

  const extensionManager = new ExtensionManager(host, repositories, storage);

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

  // Extension ID for bootstrap and worker
  const explicitId = options.extensionId ?? process.env.JAMRA_EXTENSION_ID;

  if (repositories && storage) {
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
          (extension) => extension.id === bootstrapId,
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

        const needsInstall =
          !existing || !existing.entryPath || !entryPathExists;
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
              error,
            );
          }
        }

        if (explicitId && bootstrapId !== explicitId) {
          console.warn(
            `Bootstrap extension id ${bootstrapId} did not match expected ${explicitId}.`,
          );
        }
      } catch (error) {
        console.warn(
          `Unable to read bootstrap extension at ${bootstrapExtensionPath}.`,
          error,
        );
      }
    } else if (bootstrapExtensionPath) {
      console.warn(
        `Bootstrap extension not found at ${bootstrapExtensionPath}.`,
      );
    }

    if (installed.length === 0 && bootstrapExists) {
      try {
        const installedExtension = await extensionManager.installFromFile(
          bootstrapExtensionPath!,
          {
            enabled: true,
          },
        );
        installed = extensionManager.listExtensions();
        if (explicitId && installedExtension.id !== explicitId) {
          console.warn(
            `Bootstrap extension id ${installedExtension.id} did not match expected ${explicitId}.`,
          );
        }
      } catch (error) {
        console.warn(
          `Failed to bootstrap extension from ${bootstrapExtensionPath}.`,
          error,
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

  const activeExtensionId = extensionManager.getDefaultExtensionId();

  const service = new CatalogService(host, { database });

  // Initialize and start offline storage system
  if (database) {
    try {
      downloadWorker = new DownloadWorkerHost(
        dataRoot,
        database.path,
        bootstrapExtensionPath,
        explicitId,
        {
          concurrency: OFFLINE_CONFIG.DOWNLOAD_CONCURRENCY,
          pollingInterval: OFFLINE_CONFIG.DOWNLOAD_POLL_INTERVAL_MS,
          chapterConcurrency: OFFLINE_CONFIG.CHAPTER_CONCURRENCY,
        },
      );
      console.log("[OfflineAPI] Starting download worker host...");
      void downloadWorker.start()
        .then(() => {
          console.log("[OfflineAPI] Download worker reported started");
        })
        .catch((error) => {
          console.error("Failed to start download worker:", error);
        });
      console.log("Offline storage system initialized");
    } catch (error) {
      console.warn("Failed to initialize offline storage system:", error);
    }
  }

  // Create mutable reference for activeExtensionId to allow controllers to update it
  const activeExtensionIdRef = { current: activeExtensionId };

  // Build ServerDependencies object for dependency injection
  const deps: ServerDependencies = {
    host,
    repositories,
    catalogService: service,
    extensionManager,
    registryService,
    downloadWorker,
    coverCacheManager,
    coverUrlService,
    enrichMangaDetails,
    activeExtensionId,
    dataRoot,
  };

  // Register all routes using modular system
  app.use(createRoutes(deps, activeExtensionIdRef));

  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(port, () => {
      console.log(
        `Catalog server listening on http://localhost:${port} (node ${process.version}, abi ${process.versions.modules})`,
      );
      resolve(listener);
    });
  });

  // Start background metadata sync (non-blocking) after server is ready
  if (downloadWorker) {
    void downloadWorker.startBackgroundMetadataSync({
      ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      concurrency: 2, // Process 2 manga at a time
      delayMs: 1000, // 1 second between syncs
    }).catch((error) => {
      console.error("Background metadata sync failed:", error);
    });
  }

  return {
    port,
    extensionId: activeExtensionIdRef.current,
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

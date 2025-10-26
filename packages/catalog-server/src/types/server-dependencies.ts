/**
 * Server Dependencies
 *
 * Central type definitions for all server dependencies that are passed to routes and controllers.
 */

import type Database from "better-sqlite3";
import type { ExtensionHost } from "@jamra/extension-host";
import type { CatalogService } from "@jamra/catalog-service";
import type {
  ExtensionRepository,
  MangaRepository,
  ChapterRepository,
  ReadingProgressRepository,
  HistoryRepository,
  LibraryRepository,
  CoverCacheRepository,
  SettingsRepository,
} from "@jamra/catalog-db";
import type { ExtensionManager } from "../extensions/extensionManager.js";
import type { ExtensionRegistryService } from "../extensions/registryService.js";
import type { DownloadWorkerHost } from "@jamra/offline-storage";
import type { CoverCacheManager } from "../services/coverCacheManager.js";
import type { CoverUrlService } from "../services/coverUrlService.js";
import type { MangaDetails } from "@jamra/extension-sdk";

export interface Repositories {
  extensions: ExtensionRepository;
  manga: MangaRepository;
  chapters: ChapterRepository;
  readingProgress: ReadingProgressRepository;
  history: HistoryRepository;
  library: LibraryRepository;
  coverCache: CoverCacheRepository;
  settings: SettingsRepository;
  db: Database.Database;
}

export interface ServerDependencies {
  host: ExtensionHost;
  repositories?: Repositories;
  catalogService?: CatalogService;
  extensionManager: ExtensionManager;
  registryService: ExtensionRegistryService;
  downloadWorker?: DownloadWorkerHost;
  coverCacheManager?: CoverCacheManager;
  coverUrlService: CoverUrlService;
  enrichMangaDetails: (
    extensionId: string,
    details: MangaDetails,
  ) => Promise<void>;
  activeExtensionId?: string;
  dataRoot: string;
}

/**
 * @jamra/offline-storage
 *
 * Offline manga storage system for JAMRA.
 * Enables downloading manga chapters for offline reading with intelligent queue management.
 */

// Main classes
export { OfflineStorageManager } from "./manager.js";
export { DownloadWorker } from "./downloader.js";
export { DownloadWorkerHost } from "./download-worker-host.js";
export { OfflineRepository } from "./repository.js";
export {
  ImageDownloader,
  getDefaultDownloader,
} from "./utils/image-downloader.js";

// Types
export type {
  OfflineMangaMetadata,
  OfflineChapterMetadata,
  OfflineChapterPages,
  OfflinePageMetadata,
  DownloadStatus,
  QueuedDownload,
  DownloadProgress,
  StorageStats,
  MangaStorageInfo,
  CleanupPolicy,
  DownloadMangaOptions,
  DownloadChapterOptions,
  OfflinePaths,
  OfflineMangaRow,
  OfflineChapterRow,
  DownloadQueueRow,
  DownloadHistoryRow,
  DownloadHistoryItem,
  OfflineStorageEvent,
  OfflineStorageEventListener,
} from "./types.js";

export type {
  DownloadImageOptions,
  DownloadImageResult,
} from "./utils/image-downloader.js";
export type { DownloadWorkerOptions } from "./downloader.js";
export type { DownloadWorkerHostOptions } from "./download-worker-host.js";
export type { PerformanceMetrics } from "./utils/performance-metrics.js";

// Utilities
export {
  generateChapterFolderName,
  generatePageFilename,
  getImageExtension,
  buildMangaPaths,
  buildChapterPaths,
  buildPagePath,
  sanitizeSlug,
} from "./utils/paths.js";

export {
  ensureDir,
  fileExists,
  fileExistsSync,
  readJSON,
  writeJSON,
  deleteDir,
  deleteFile,
  getFileSize,
  getDirSize,
  copyFile,
  move,
  listFiles,
  listDirs,
  countFiles,
} from "./utils/file-system.js";

// Archive utilities
export {
  archiveChapter,
  archiveManga,
  archiveBulk,
  estimateArchiveSize,
} from "./archiver.js";

export type {
  ArchiveOptions,
  ArchiveResult,
} from "./archiver.js";

// Import utilities
export {
  importMangaArchive,
  validateArchive,
} from "./importer.js";

export type {
  ImportOptions,
  ImportResult,
  ValidationResult,
  ConflictResolution,
} from "./importer.js";

// Cleanup utilities
export {
  shouldCleanup,
  performCleanup,
  getStorageUsage,
} from "./cleanup.js";

export type {
  StorageSettings,
  CleanupResult,
} from "./cleanup.js";

/**
 * @jamra/offline-storage
 *
 * Offline manga storage system for JAMRA.
 * Enables downloading manga chapters for offline reading with intelligent queue management.
 */

// Main classes
export { OfflineStorageManager } from "./manager.js";
export { DownloadWorker } from "./downloader.js";
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

/**
 * Offline Storage Types
 *
 * Defines the data structures for offline manga storage, including metadata
 * schemas, download queue status, and storage statistics.
 */

// ============================================================================
// Metadata Schemas
// ============================================================================

/**
 * Manga-level metadata stored at {manga-slug}/metadata.json
 * Contains everything needed to rebuild the manga details page offline.
 */
export interface OfflineMangaMetadata {
  version: 1;                          // Schema version for future migrations
  downloadedAt: number;                // Unix timestamp (ms)
  lastUpdatedAt: number;               // Unix timestamp (ms)

  // Manga identification
  mangaId: string;                     // Stable internal ID
  slug: string;                        // URL slug
  extensionId: string;                 // Source extension

  // Manga details
  title: string;
  description?: string;
  coverUrl?: string;                   // Original URL (for reference)
  coverPath: string;                   // Relative path: "cover.jpg"
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  rating?: number;
  year?: number;
  status?: string;
  demographic?: string;
  altTitles?: string[];

  // Downloaded chapters
  chapters: OfflineChapterMetadata[];
}

/**
 * Chapter metadata within manga metadata
 */
export interface OfflineChapterMetadata {
  chapterId: string;                   // Stable internal ID
  slug: string;                        // URL slug
  number?: string;                     // "1", "1.5", etc.
  title?: string;                      // Chapter title: "Into the Fray!"
  displayTitle: string;                // Computed: "Chapter 1 - Into the Fray!" or "Chapter 1"
  volume?: string;
  publishedAt?: string;
  languageCode?: string;
  scanlators?: string[];

  // Storage info
  folderName: string;                  // "chapter-0001"
  totalPages: number;
  downloadedAt: number;                // Unix timestamp (ms)
  sizeBytes: number;                   // Total size of all pages
}

/**
 * Chapter-level metadata stored at chapters/{folder}/metadata.json
 * Contains page-level information for each chapter.
 */
export interface OfflineChapterPages {
  version: 1;
  downloadedAt: number;                // Unix timestamp (ms)

  chapterId: string;
  mangaId: string;
  folderName: string;                  // "chapter-0001"

  pages: OfflinePageMetadata[];
}

/**
 * Individual page metadata
 */
export interface OfflinePageMetadata {
  index: number;                       // 0-indexed page number
  originalUrl: string;                 // Original source URL
  filename: string;                    // "page-0001.jpg"
  width?: number;
  height?: number;
  sizeBytes: number;
  mimeType: string;                    // "image/jpeg", "image/png", etc.
}

// ============================================================================
// Download Queue
// ============================================================================

/**
 * Download queue status
 */
export type DownloadStatus = "queued" | "downloading" | "completed" | "failed" | "paused";

/**
 * Queued download item
 */
export interface QueuedDownload {
  id: number;                          // Queue item ID
  extensionId: string;
  mangaId: string;
  mangaSlug: string;
  chapterId?: string;                  // Undefined = download all chapters
  status: DownloadStatus;
  priority: number;                    // Higher = more important
  queuedAt: number;                    // Unix timestamp (ms)
  startedAt?: number;                  // Unix timestamp (ms)
  completedAt?: number;                // Unix timestamp (ms)
  errorMessage?: string;
  progressCurrent: number;             // Pages downloaded
  progressTotal: number;               // Total pages to download
}

/**
 * Download progress for UI
 */
export interface DownloadProgress {
  queueId: number;
  mangaTitle: string;
  chapterTitle?: string;
  status: DownloadStatus;
  progressCurrent: number;
  progressTotal: number;
  progressPercent: number;             // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond?: number;
  estimatedTimeRemainingMs?: number;
  errorMessage?: string;
}

// ============================================================================
// Storage Statistics
// ============================================================================

/**
 * Overall storage statistics
 */
export interface StorageStats {
  totalBytes: number;
  mangaCount: number;
  chapterCount: number;
  pageCount: number;
  byExtension: Record<string, number>;     // extensionId -> bytes
  byManga: MangaStorageInfo[];
}

/**
 * Per-manga storage info
 */
export interface MangaStorageInfo {
  mangaId: string;
  mangaSlug: string;
  title: string;
  coverPath: string;
  extensionId: string;
  chapterCount: number;
  totalBytes: number;
  downloadedAt: number;
  lastAccessedAt?: number;
}

// ============================================================================
// Cleanup Policies
// ============================================================================

/**
 * Storage cleanup policy
 */
export interface CleanupPolicy {
  maxStorageBytes?: number;            // Delete oldest when exceeded
  maxAgeUnreadDays?: number;           // Delete unread chapters older than X days
  keepReadChapters?: boolean;          // Never delete read chapters
  keepFavorites?: boolean;             // Never delete favorited manga
}

// ============================================================================
// Download Options
// ============================================================================

/**
 * Options for queueing manga download
 */
export interface DownloadMangaOptions {
  chapterIds?: string[];               // Download specific chapters, or all if undefined
  priority?: number;                   // Queue priority (default: 0)
  imageQuality?: "original" | "high" | "medium";  // Future: image compression
}

/**
 * Options for queueing chapter download
 */
export interface DownloadChapterOptions {
  priority?: number;                   // Queue priority (default: 0)
  imageQuality?: "original" | "high" | "medium";  // Future: image compression
}

// ============================================================================
// File Paths
// ============================================================================

/**
 * Resolved file system paths for offline content
 */
export interface OfflinePaths {
  dataDir: string;                     // .jamra-data
  offlineDir: string;                  // .jamra-data/offline
  extensionDir: string;                // .jamra-data/offline/{extensionId}
  mangaDir: string;                    // .jamra-data/offline/{extensionId}/{mangaSlug}
  chaptersDir: string;                 // .jamra-data/offline/{extensionId}/{mangaSlug}/chapters
  chapterDir: string;                  // .jamra-data/offline/{extensionId}/{mangaSlug}/chapters/{chapterFolder}
  metadataFile: string;                // .jamra-data/offline/{extensionId}/{mangaSlug}/metadata.json
  coverFile: string;                   // .jamra-data/offline/{extensionId}/{mangaSlug}/cover.jpg
}

// ============================================================================
// Repository Interfaces
// ============================================================================

/**
 * Database row for offline_manga table
 */
export interface OfflineMangaRow {
  id: number;
  extension_id: string;
  manga_id: string;
  manga_slug: string;
  download_path: string;
  downloaded_at: number;
  last_updated_at: number;
  total_size_bytes: number;
}

/**
 * Database row for offline_chapters table
 */
export interface OfflineChapterRow {
  id: number;
  offline_manga_id: number;
  chapter_id: string;
  chapter_number: string | null;
  chapter_title: string | null;
  folder_name: string;
  total_pages: number;
  downloaded_at: number;
  size_bytes: number;
}

/**
 * Database row for download_queue table
 */
export interface DownloadQueueRow {
  id: number;
  extension_id: string;
  manga_id: string;
  manga_slug: string;
  chapter_id: string | null;
  status: DownloadStatus;
  priority: number;
  queued_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
  progress_current: number;
  progress_total: number;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by the offline storage system
 */
export type OfflineStorageEvent =
  | { type: "download-started"; queueId: number; mangaId: string; chapterId?: string }
  | { type: "download-progress"; queueId: number; mangaId: string; chapterId?: string; progressCurrent: number; progressTotal: number }
  | { type: "download-completed"; queueId: number; mangaId: string; chapterId?: string }
  | { type: "download-failed"; queueId: number; mangaId: string; chapterId?: string; error: string }
  | { type: "chapter-deleted"; mangaId: string; chapterId: string }
  | { type: "manga-deleted"; mangaId: string }
  | { type: "cleanup-performed"; deletedBytes: number; deletedChapters: number };

/**
 * Event listener callback
 */
export type OfflineStorageEventListener = (event: OfflineStorageEvent) => void;

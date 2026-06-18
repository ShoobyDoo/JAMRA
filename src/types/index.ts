/**
 * Shared frontend types mirroring backend contracts.
 * Renderer-facing DTOs import canonical definitions from the backend to prevent drift.
 */

import type {
  CatalogEntry,
  CatalogSyncResult,
  ExtensionManifest,
  ExtensionRecord,
  DownloadDetailsResponse,
  DownloadListResponse,
  DownloadQueueItem,
  DownloadStats,
  DownloadedPage,
  DownloadStatus,
  LibraryItem,
  LibraryListResponse,
  LibraryStats,
  LibraryStatus,
  ReadingProgress,
  Setting,
  SettingScope,
} from "@jamra/contracts";

export type {
  CatalogEntry,
  CatalogSyncResult,
  ExtensionManifest,
  ExtensionRecord,
  DownloadDetailsResponse,
  DownloadListResponse,
  DownloadQueueItem,
  DownloadStats,
  DownloadedPage,
  DownloadStatus,
  LibraryItem,
  LibraryListResponse,
  LibraryStats,
  LibraryStatus,
  ReadingProgress,
  Setting,
  SettingScope,
};

export interface CatalogListResponse {
  entries: CatalogEntry[];
}

export interface CatalogSyncResponse {
  status: string;
  repoId: string;
  result: CatalogSyncResult;
}

export interface ExtensionsListResponse {
  extensions: ExtensionRecord[];
}

export interface ExtensionSearchResult {
  id: string;
  title: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  lang?: string;
}

export interface ExtensionSearchResponse {
  results: ExtensionSearchResult[];
  hasMore: boolean;
}

export interface ExtensionChapter {
  id: string;
  chapterNumber?: string | number;
  title?: string;
  translatedLanguage?: string;
  updatedAt?: string;
}

export interface ExtensionChaptersResponse {
  chapters: ExtensionChapter[];
  metrics?: { totalChapters?: number };
}

export interface MangaDetails {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  tags?: string[];
  chapters?: ExtensionChapter[];
  authors?: string[];
  status?: "ongoing" | "completed" | "hiatus" | "cancelled" | "unknown";
}

export interface MangaDetailsResponse {
  manga: MangaDetails;
}

export interface ExtensionPageDescriptor {
  index: number;
  imageUrl: string;
}

export interface ExtensionPagesResponse {
  pages: ExtensionPageDescriptor[];
}

export type InstallJobStatus =
  | "pending"
  | "downloading"
  | "compiling"
  | "installing"
  | "completed"
  | "failed";

export interface InstallJob {
  jobId: string;
  extensionId: string;
  status: InstallJobStatus;
  repositoryUrl: string;
  requestedAt: number;
  completedAt?: number | null;
  error?: string | null;
}

export interface ContinueReadingEntry {
  libraryId: string;
  mangaId: string;
  extensionId: string;
  title: string;
  coverUrl?: string;
  chapterId: string;
  chapterNumber?: string;
  pageNumber: number;
  totalPages?: number;
  progressPercent: number;
  lastReadAt: string;
  updatedAt: string;
}

export interface ReaderPageDescriptor {
  number: number;
  url: string;
}

export interface ReaderChapterSummary {
  id: string;
  number?: string;
  title?: string;
}

export interface ReaderChapter {
  id: string;
  number?: string;
  title?: string;
  pages: ReaderPageDescriptor[];
  isDownloaded: boolean;
  previousChapterId: string | null;
  nextChapterId: string | null;
  chapters: ReaderChapterSummary[];
}

/**
 * WebSocket payload re-exports.
 */
export type {
  DownloadCancelledPayload,
  DownloadChapterCompletePayload,
  DownloadFailedPayload,
  DownloadPageCompletePayload,
  DownloadProgressPayload,
  DownloadStartedPayload,
  LibraryItemRemovedPayload,
  LibraryItemSnapshotPayload,
  LibraryItemUpdatedPayload,
  MangaUpdatedPayload,
} from "./websocket";

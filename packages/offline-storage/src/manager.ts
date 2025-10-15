/**
 * Offline Storage Manager
 *
 * Main entry point for offline manga storage operations.
 * Handles queueing downloads, querying offline content, and managing storage.
 */

import type { CatalogService } from "@jamra/catalog-service";
import type { ChapterSummary } from "@jamra/extension-sdk";
import { OfflineRepository } from "./repository.js";
import {
  buildMangaPaths,
  buildChapterPaths,
  sanitizeSlug,
} from "./utils/paths.js";
import {
  readJSON,
  writeJSON,
  deleteDir,
  getDirSize,
} from "./utils/file-system.js";
import type {
  OfflineMangaMetadata,
  OfflineChapterMetadata,
  OfflineChapterPages,
  DownloadMangaOptions,
  DownloadChapterOptions,
  QueuedDownload,
  DownloadProgress,
  StorageStats,
  OfflineStorageEvent,
  OfflineStorageEventListener,
} from "./types.js";

export class OfflineStorageManager {
  private readonly eventListeners: Set<OfflineStorageEventListener> = new Set();

  constructor(
    private readonly dataDir: string,
    private readonly repository: OfflineRepository,
    private readonly catalogService: CatalogService
  ) {}

  // ==========================================================================
  // Event Emitter
  // ==========================================================================

  on(listener: OfflineStorageEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: OfflineStorageEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in offline storage event listener:", error);
      }
    }
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Queues a single chapter for download
   */
  async queueChapterDownload(
    extensionId: string,
    mangaId: string,
    chapterId: string,
    options: DownloadChapterOptions = {}
  ): Promise<number> {
    // Check if already downloaded
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (offlineManga) {
      const chapters = this.repository.getChaptersByManga(offlineManga.id);
      const existingChapter = chapters.find(c => c.chapter_id === chapterId);
      if (existingChapter) {
        throw new Error("Chapter already downloaded");
      }
    }

    // Get manga details to resolve slug and chapter info
    const mangaDetails = await this.catalogService.syncManga(extensionId, mangaId);
    const mangaSlug = sanitizeSlug(mangaDetails.details.slug || mangaDetails.details.title);
    const chapter = mangaDetails.details.chapters?.find(c => c.id === chapterId);

    const queueId = this.repository.queueDownload({
      extension_id: extensionId,
      manga_id: mangaId,
      manga_slug: mangaSlug,
      manga_title: mangaDetails.details.title,
      chapter_id: chapterId,
      chapter_number: chapter?.number || null,
      chapter_title: chapter?.title || null,
      status: "queued",
      priority: options.priority ?? 0,
      queued_at: Date.now(),
      started_at: null,
      completed_at: null,
      error_message: null,
      progress_current: 0,
      progress_total: 0,
    });

    return queueId;
  }

  /**
   * Queues an entire manga (all chapters or specific chapters) for download
   */
  async queueMangaDownload(
    extensionId: string,
    mangaId: string,
    options: DownloadMangaOptions = {}
  ): Promise<number[]> {
    // Get manga details with chapters
    const mangaDetails = await this.catalogService.syncManga(extensionId, mangaId);
    const chapters = mangaDetails.details.chapters || [];

    // Filter chapters if specific ones are requested
    const chaptersToDownload = options.chapterIds
      ? chapters.filter(c => options.chapterIds!.includes(c.id))
      : chapters;

    // Queue each chapter
    const queueIds: number[] = [];
    for (const chapter of chaptersToDownload) {
      try {
        const queueId = await this.queueChapterDownload(
          extensionId,
          mangaId,
          chapter.id,
          { priority: options.priority }
        );
        queueIds.push(queueId);
      } catch (error) {
        // Skip if chapter already downloaded
        if (error instanceof Error && error.message.includes("already downloaded")) {
          continue;
        }
        throw error;
      }
    }

    return queueIds;
  }

  /**
   * Cancels a queued download
   */
  async cancelDownload(queueId: number): Promise<void> {
    const item = this.repository.getQueueItem(queueId);
    if (!item) {
      throw new Error(`Queue item ${queueId} not found`);
    }

    // Allow cancellation of any download, including in-progress ones
    // The download worker will handle cleanup when it detects the item is gone
    this.repository.deleteQueueItem(queueId);

    // Emit cancellation event
    this.emit({
      type: "download-failed",
      queueId,
      mangaId: item.mangaId,
      chapterId: item.chapterId || undefined,
      error: "Cancelled by user",
    });
  }

  /**
   * Retries a failed or frozen download by resetting it to queued status
   */
  async retryDownload(queueId: number): Promise<void> {
    const item = this.repository.getQueueItem(queueId);
    if (!item) {
      throw new Error(`Queue item ${queueId} not found`);
    }

    // Reset to queued status and clear error
    this.repository.updateQueueStatus(queueId, "queued", undefined);

    // Emit event
    this.emit({
      type: "download-retried",
      queueId,
      mangaId: item.mangaId,
      chapterId: item.chapterId || undefined,
    });
  }

  /**
   * Retries all frozen downloads (downloading status but no recent progress)
   */
  async retryFrozenDownloads(): Promise<number[]> {
    const queue = this.repository.getQueuedDownloads();
    const now = Date.now();
    const frozenThreshold = 30000; // 30 seconds
    const retriedIds: number[] = [];

    for (const item of queue) {
      if (item.status === "downloading" && item.startedAt) {
        const timeSinceStart = now - item.startedAt;
        // Consider frozen if downloading for 30+ seconds with no progress or very slow progress
        const isFrozen =
          (timeSinceStart > frozenThreshold && item.progressCurrent === 0) ||
          (timeSinceStart > 120000 && item.progressTotal > 0 &&
           (item.progressCurrent / item.progressTotal) < 0.1);

        if (isFrozen) {
          this.repository.updateQueueStatus(item.id, "queued", undefined);
          retriedIds.push(item.id);

          this.emit({
            type: "download-retried",
            queueId: item.id,
            mangaId: item.mangaId,
            chapterId: item.chapterId || undefined,
          });
        }
      }
    }

    return retriedIds;
  }

  /**
   * Pauses all queued downloads
   */
  async pauseDownloads(): Promise<void> {
    this.repository.pauseAllDownloads();
  }

  /**
   * Resumes paused downloads
   */
  async resumeDownloads(): Promise<void> {
    this.repository.resumeAllDownloads();
  }

  /**
   * Gets download history
   */
  async getDownloadHistory(limit?: number): Promise<import("./types.js").DownloadHistoryItem[]> {
    return this.repository.getDownloadHistory(limit);
  }

  /**
   * Deletes a download history item
   */
  async deleteHistoryItem(historyId: number): Promise<void> {
    this.repository.deleteHistoryItem(historyId);
  }

  /**
   * Clears all download history
   */
  async clearDownloadHistory(): Promise<void> {
    this.repository.clearDownloadHistory();
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Checks if a specific chapter is downloaded
   */
  async isChapterDownloaded(
    extensionId: string,
    mangaId: string,
    chapterId: string
  ): Promise<boolean> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) return false;

    const chapter = this.repository.getChapter(offlineManga.id, chapterId);
    return !!chapter;
  }

  /**
   * Checks if a manga has any downloaded chapters
   */
  async isMangaDownloaded(extensionId: string, mangaId: string): Promise<boolean> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) return false;

    const chapters = this.repository.getChaptersByManga(offlineManga.id);
    return chapters.length > 0;
  }

  /**
   * Gets all downloaded manga
   */
  async getDownloadedManga(): Promise<OfflineMangaMetadata[]> {
    const mangaRows = this.repository.getAllManga();
    const result: OfflineMangaMetadata[] = [];

    for (const row of mangaRows) {
      try {
        const paths = buildMangaPaths(this.dataDir, row.extension_id, row.manga_slug);
        const metadata = await readJSON<OfflineMangaMetadata>(paths.metadataFile);
        result.push(metadata);
      } catch (error) {
        console.error(`Failed to read metadata for manga ${row.manga_id}:`, error);
      }
    }

    return result;
  }

  /**
   * Gets metadata for a specific downloaded manga
   */
  async getMangaMetadata(
    extensionId: string,
    mangaId: string
  ): Promise<OfflineMangaMetadata | null> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) return null;

    try {
      const paths = buildMangaPaths(this.dataDir, extensionId, offlineManga.manga_slug);
      return await readJSON<OfflineMangaMetadata>(paths.metadataFile);
    } catch {
      return null;
    }
  }

  /**
   * Gets downloaded chapters for a manga
   */
  async getDownloadedChapters(
    extensionId: string,
    mangaId: string
  ): Promise<OfflineChapterMetadata[]> {
    const metadata = await this.getMangaMetadata(extensionId, mangaId);
    return metadata?.chapters || [];
  }

  /**
   * Gets chapter pages metadata
   */
  async getChapterPages(
    extensionId: string,
    mangaId: string,
    chapterId: string
  ): Promise<OfflineChapterPages | null> {
    const metadata = await this.getMangaMetadata(extensionId, mangaId);
    if (!metadata) return null;

    const chapter = metadata.chapters.find(c => c.chapterId === chapterId);
    if (!chapter) return null;

    try {
      const paths = buildChapterPaths(
        this.dataDir,
        extensionId,
        metadata.slug,
        chapter.folderName
      );
      return await readJSON<OfflineChapterPages>(paths.metadataFile);
    } catch {
      return null;
    }
  }

  /**
   * Gets download progress for a queue item
   */
  async getDownloadProgress(queueId: number): Promise<DownloadProgress | null> {
    const item = this.repository.getQueueItem(queueId);
    if (!item) return null;

    // Try to get manga details for title
    let mangaTitle = "Unknown";
    let chapterTitle: string | undefined;

    try {
      const mangaDetails = await this.catalogService.syncManga(
        item.extensionId,
        item.mangaId
      );
      mangaTitle = mangaDetails.details.title;

      if (item.chapterId && mangaDetails.details.chapters) {
        const chapter = mangaDetails.details.chapters.find(c => c.id === item.chapterId);
        if (chapter) {
          chapterTitle = this.formatChapterTitle(chapter);
        }
      }
    } catch {
      // Ignore errors, use defaults
    }

    const progressPercent = item.progressTotal > 0
      ? Math.round((item.progressCurrent / item.progressTotal) * 100)
      : 0;

    return {
      queueId: item.id,
      mangaTitle,
      chapterTitle,
      status: item.status,
      progressCurrent: item.progressCurrent,
      progressTotal: item.progressTotal,
      progressPercent,
      downloadedBytes: 0, // TODO: Track bytes
      totalBytes: 0, // TODO: Track bytes
      errorMessage: item.errorMessage,
    };
  }

  /**
   * Gets all queued downloads
   */
  async getQueuedDownloads(): Promise<QueuedDownload[]> {
    return this.repository.getQueuedDownloads();
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Deletes a downloaded chapter
   */
  async deleteChapter(extensionId: string, mangaId: string, chapterId: string): Promise<void> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) {
      throw new Error("Manga not found in offline storage");
    }

    const chapter = this.repository.getChapter(offlineManga.id, chapterId);
    if (!chapter) {
      throw new Error("Chapter not found in offline storage");
    }

    // Delete chapter directory
    const paths = buildChapterPaths(
      this.dataDir,
      extensionId,
      offlineManga.manga_slug,
      chapter.folder_name
    );
    await deleteDir(paths.chapterDir);

    // Remove from database
    this.repository.deleteChapter(offlineManga.id, chapterId);

    // Update manga metadata
    const metadata = await this.getMangaMetadata(extensionId, mangaId);
    if (metadata) {
      metadata.chapters = metadata.chapters.filter(c => c.chapterId !== chapterId);
      metadata.lastUpdatedAt = Date.now();

      const mangaPaths = buildMangaPaths(this.dataDir, extensionId, offlineManga.manga_slug);
      await writeJSON(mangaPaths.metadataFile, metadata);
    }

    // Recalculate manga size
    const mangaPaths = buildMangaPaths(this.dataDir, extensionId, offlineManga.manga_slug);
    const newSize = await getDirSize(mangaPaths.mangaDir);
    this.repository.updateMangaSize(extensionId, mangaId, newSize);

    // If no chapters left, delete the manga
    const remainingChapters = this.repository.getChaptersByManga(offlineManga.id);
    if (remainingChapters.length === 0) {
      await this.deleteManga(extensionId, mangaId);
    }

    this.emit({ type: "chapter-deleted", mangaId, chapterId });
  }

  /**
   * Deletes an entire downloaded manga
   */
  async deleteManga(extensionId: string, mangaId: string): Promise<void> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) {
      throw new Error("Manga not found in offline storage");
    }

    // Delete manga directory
    const paths = buildMangaPaths(this.dataDir, extensionId, offlineManga.manga_slug);
    await deleteDir(paths.mangaDir);

    // Remove from database (cascade deletes chapters)
    this.repository.deleteManga(extensionId, mangaId);

    this.emit({ type: "manga-deleted", mangaId });
  }

  /**
   * Clears all offline downloads
   */
  async clearAllDownloads(): Promise<void> {
    const allManga = this.repository.getAllManga();

    for (const manga of allManga) {
      try {
        await this.deleteManga(manga.extension_id, manga.manga_id);
      } catch (error) {
        console.error(`Failed to delete manga ${manga.manga_id}:`, error);
      }
    }
  }

  // ==========================================================================
  // Storage Management
  // ==========================================================================

  /**
   * Gets total storage size in bytes
   */
  async getTotalStorageSize(): Promise<number> {
    return this.repository.getTotalStorageSize();
  }

  /**
   * Gets storage size for a specific manga
   */
  async getMangaStorageSize(extensionId: string, mangaId: string): Promise<number> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) return 0;

    return offlineManga.total_size_bytes;
  }

  /**
   * Gets detailed storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const totalBytes = this.repository.getTotalStorageSize();
    const mangaCount = this.repository.getAllManga().length;
    const chapterCount = this.repository.getChapterCount();
    const pageCount = this.repository.getPageCount();
    const byExtension = this.repository.getStorageSizeByExtension();
    const byManga = this.repository.getMangaStorageInfo();

    return {
      totalBytes,
      mangaCount,
      chapterCount,
      pageCount,
      byExtension,
      byManga,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Formats a chapter title for display
   */
  private formatChapterTitle(chapter: ChapterSummary): string {
    if (chapter.title && chapter.title.trim().length > 0) {
      if (chapter.number && chapter.number.trim().length > 0) {
        return `Chapter ${chapter.number} - ${chapter.title}`;
      }
      return chapter.title;
    }

    if (chapter.number && chapter.number.trim().length > 0) {
      return `Chapter ${chapter.number}`;
    }

    return `Chapter ${chapter.id}`;
  }

  /**
   * Gets the absolute path to a page file
   */
  getPagePath(mangaId: string, chapterId: string, filename: string): string | null {
    // This requires looking up the manga and chapter to get the paths
    // Will be used by the API server to serve offline images
    const allManga = this.repository.getAllManga();
    const offlineManga = allManga.find(m => m.manga_id === mangaId);

    if (!offlineManga) return null;

    const chapter = this.repository.getChapter(offlineManga.id, chapterId);
    if (!chapter) return null;

    const paths = buildChapterPaths(
      this.dataDir,
      offlineManga.extension_id,
      offlineManga.manga_slug,
      chapter.folder_name
    );

    return `${paths.chapterDir}/${filename}`;
  }
}

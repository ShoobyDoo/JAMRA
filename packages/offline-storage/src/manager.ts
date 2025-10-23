/**
 * Offline Storage Manager
 *
 * Main entry point for offline manga storage operations.
 * Handles queueing downloads, querying offline content, and managing storage.
 */

import * as path from "node:path";
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
  fileExists,
  ensureDir,
} from "./utils/file-system.js";
import type {
  OfflineMangaMetadata,
  OfflineChapterMetadata,
  OfflineChapterPages,
  OfflineMangaRow,
  OfflineChapterRow,
  DownloadMangaOptions,
  DownloadChapterOptions,
  QueuedDownload,
  DownloadProgress,
  StorageStats,
  OfflineStorageEvent,
  OfflineStorageEventListener,
} from "./types.js";

export class OfflineStorageManager {
  private readonly dataDir: string;
  private readonly eventListeners: Set<OfflineStorageEventListener> = new Set();

  constructor(
    dataDir: string,
    private readonly repository: OfflineRepository,
    private readonly catalogService: CatalogService,
  ) {
    if (path.basename(dataDir) === "offline") {
      console.warn(
        "[OfflineStorage] Received data directory suffixed with 'offline'. Adjusting to parent directory.",
      );
      this.dataDir = path.dirname(dataDir);
    } else {
      this.dataDir = dataDir;
    }
  }

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
    options: DownloadChapterOptions = {},
  ): Promise<number> {
    // Check if already downloaded
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    console.log(`[OfflineStorage] queueChapterDownload check:`, {
      extensionId,
      mangaId,
      chapterId,
      offlineMangaFound: !!offlineManga,
      offlineMangaId: offlineManga?.id,
    });

    if (offlineManga) {
      const chapters = this.repository.getChaptersByManga(offlineManga.id);
      const existingChapter = chapters.find((c) => c.chapter_id === chapterId);
      console.log(`[OfflineStorage] Chapter availability check:`, {
        totalOfflineChapters: chapters.length,
        chapterIdToCheck: chapterId,
        existingChapterFound: !!existingChapter,
        existingChapterId: existingChapter?.chapter_id,
        existingChapterNumber: existingChapter?.chapter_number,
      });

      if (existingChapter) {
        console.warn(`[OfflineStorage] ⚠️  Chapter already downloaded - rejecting queue request:`, {
          chapterId,
          chapterNumber: existingChapter.chapter_number,
          downloadedAt: new Date(existingChapter.downloaded_at).toISOString(),
        });
        throw new Error("Chapter already downloaded");
      }
    }

    // Get manga details to resolve slug and chapter info
    const mangaDetails = await this.catalogService.syncManga(
      extensionId,
      mangaId,
    );
    const mangaSlug = sanitizeSlug(
      mangaDetails.details.slug || mangaDetails.details.title,
    );
    const chapter = mangaDetails.details.chapters?.find(
      (c) => c.id === chapterId,
    );

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

    // Emit event so UI can immediately show the queued item
    this.emit({
      type: "download-queued",
      queueId,
      mangaId,
      chapterId,
    });

    return queueId;
  }

  /**
   * Queues an entire manga (all chapters or specific chapters) for download
   */
  async queueMangaDownload(
    extensionId: string,
    mangaId: string,
    options: DownloadMangaOptions = {},
  ): Promise<number[]> {
    // Get manga details with chapters ONCE (not per-chapter!)
    const mangaDetails = await this.catalogService.syncManga(
      extensionId,
      mangaId,
    );
    const chapters = mangaDetails.details.chapters || [];
    const mangaSlug = sanitizeSlug(
      mangaDetails.details.slug || mangaDetails.details.title,
    );

    // Filter chapters if specific ones are requested
    const chaptersToDownload = options.chapterIds
      ? chapters.filter((c) => options.chapterIds!.includes(c.id))
      : chapters;

    // Check which chapters are already downloaded (do this BEFORE queuing)
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    const alreadyDownloadedIds = new Set<string>();

    if (offlineManga) {
      const offlineChapters = this.repository.getChaptersByManga(offlineManga.id);
      for (const chapter of offlineChapters) {
        alreadyDownloadedIds.add(chapter.chapter_id);
      }
    }

    // Queue each chapter (batch operation)
    const queueIds: number[] = [];
    const queuedChapterIds: string[] = [];
    const now = Date.now();

    for (const chapter of chaptersToDownload) {
      // Skip if already downloaded
      if (alreadyDownloadedIds.has(chapter.id)) {
        console.log(`[OfflineStorage] Skipping already downloaded chapter ${chapter.number || chapter.id}`);
        continue;
      }

      try {
        // Queue directly without re-fetching manga details
        const queueId = this.repository.queueDownload({
          extension_id: extensionId,
          manga_id: mangaId,
          manga_slug: mangaSlug,
          manga_title: mangaDetails.details.title,
          chapter_id: chapter.id,
          chapter_number: chapter.number || null,
          chapter_title: chapter.title || null,
          status: "queued",
          priority: options.priority ?? 0,
          queued_at: now,
          started_at: null,
          completed_at: null,
          error_message: null,
          progress_current: 0,
          progress_total: 0,
        });

        queueIds.push(queueId);
        queuedChapterIds.push(chapter.id);
      } catch (error) {
        console.error(`Failed to queue chapter ${chapter.id}:`, error);
        // Continue with other chapters even if one fails
      }
    }

    console.log(`[OfflineStorage] Queued ${queueIds.length} chapters for download (skipped ${chaptersToDownload.length - queueIds.length} already downloaded)`);

    // Emit single batched event instead of individual events per chapter
    // This prevents overwhelming the frontend with hundreds of events
    if (queueIds.length > 0) {
      this.emit({
        type: "download-queued",
        queueId: queueIds[0], // First queue ID for backwards compatibility
        mangaId,
        chapterId: queuedChapterIds[0], // First chapter ID for backwards compatibility
      });

      // Log batch information for debugging
      console.log(`[OfflineStorage] Emitted batch download-queued event (${queueIds.length} chapters)`);
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
          (timeSinceStart > 120000 &&
            item.progressTotal > 0 &&
            item.progressCurrent / item.progressTotal < 0.1);

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
  async getDownloadHistory(
    limit?: number,
  ): Promise<import("./types.js").DownloadHistoryItem[]> {
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
    chapterId: string,
  ): Promise<boolean> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) return false;

    const chapter = this.repository.getChapter(offlineManga.id, chapterId);
    return !!chapter;
  }

  /**
   * Checks if a manga has any downloaded chapters
   */
  async isMangaDownloaded(
    extensionId: string,
    mangaId: string,
  ): Promise<boolean> {
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
      const metadata = await this.ensureMangaMetadata(
        row.extension_id,
        row.manga_id,
      );
      if (metadata) {
        result.push(metadata);
      }
    }

    return result;
  }

  /**
   * Gets metadata for a specific downloaded manga
   */
  async getMangaMetadata(
    extensionId: string,
    mangaId: string,
  ): Promise<OfflineMangaMetadata | null> {
    return this.ensureMangaMetadata(extensionId, mangaId);
  }

  /**
   * Gets downloaded chapters for a manga
   */
  async getDownloadedChapters(
    extensionId: string,
    mangaId: string,
  ): Promise<OfflineChapterMetadata[]> {
    const metadata = await this.ensureMangaMetadata(extensionId, mangaId);
    return metadata?.chapters ?? [];
  }

  /**
   * Gets chapter pages metadata
   */
  async getChapterPages(
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ): Promise<OfflineChapterPages | null> {
    const metadata = await this.ensureMangaMetadata(extensionId, mangaId);
    if (!metadata) return null;

    const chapter = metadata.chapters.find((c) => c.chapterId === chapterId);
    if (!chapter) return null;

    try {
      const paths = buildChapterPaths(
        this.dataDir,
        extensionId,
        metadata.slug,
        chapter.folderName,
      );
      return await readJSON<OfflineChapterPages>(paths.metadataFile);
    } catch {
      return null;
    }
  }

  /**
   * Force rebuilds metadata for a specific manga from the database and filesystem.
   */
  async rebuildMangaMetadata(
    extensionId: string,
    mangaId: string,
  ): Promise<OfflineMangaMetadata | null> {
    return this.ensureMangaMetadata(extensionId, mangaId, { force: true });
  }

  /**
   * Rebuilds metadata for all offline manga.
   */
  async rebuildAllMetadata(): Promise<void> {
    const mangaRows = this.repository.getAllManga();
    for (const row of mangaRows) {
      await this.ensureMangaMetadata(row.extension_id, row.manga_id, {
        force: true,
      });
    }
  }

  /**
   * Validates that metadata chapter count matches database chapter count.
   * Rebuilds from local data only if mismatch detected (no network call).
   * Call this when user views manga details page.
   */
  async validateMangaChapterCount(
    extensionId: string,
    mangaId: string,
  ): Promise<{ valid: boolean; rebuilt: boolean }> {
    const metadata = await this.getMangaMetadata(extensionId, mangaId);
    if (!metadata) return { valid: true, rebuilt: false };

    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) return { valid: true, rebuilt: false };

    const dbChapters = this.repository.getChaptersByManga(offlineManga.id);

    // Check for mismatch
    if (dbChapters.length !== metadata.chapters.length) {
      console.log(
        `[OfflineStorage] Chapter count mismatch for ${mangaId}: ` +
          `metadata=${metadata.chapters.length}, db=${dbChapters.length}. Rebuilding...`,
      );

      // Rebuild from local data only (force=false means no catalog service call)
      await this.ensureMangaMetadata(extensionId, mangaId, { force: false });

      return { valid: false, rebuilt: true };
    }

    return { valid: true, rebuilt: false };
  }

  /**
   * Background task that syncs stale metadata with catalog service.
   * Discovers new chapters and updates metadata.
   * Non-blocking - runs after server startup.
   */
  async startBackgroundMetadataSync(options: {
    ttlMs: number;
    concurrency?: number;
    delayMs?: number;
  }): Promise<void> {
    const { ttlMs, concurrency = 2, delayMs = 1000 } = options;

    console.log(
      `[OfflineStorage] Starting background metadata sync (TTL: ${ttlMs / 1000 / 60 / 60 / 24} days)`,
    );

    const allManga = this.repository.getAllManga();
    const staleManga: typeof allManga = [];

    // Identify stale manga
    for (const manga of allManga) {
      const metadata = await this.getMangaMetadata(
        manga.extension_id,
        manga.manga_id,
      );
      if (!metadata) continue;

      const age = Date.now() - metadata.lastUpdatedAt;
      if (age > ttlMs) {
        staleManga.push(manga);
      }
    }

    console.log(
      `[OfflineStorage] Found ${staleManga.length}/${allManga.length} manga with stale metadata`,
    );

    if (staleManga.length === 0) return;

    // Process in batches with concurrency limit
    for (let i = 0; i < staleManga.length; i += concurrency) {
      const batch = staleManga.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (manga) => {
          try {
            // Fetch fresh catalog data (discovers new chapters)
            const oldMetadata = await this.getMangaMetadata(
              manga.extension_id,
              manga.manga_id,
            );

            await this.ensureMangaMetadata(manga.extension_id, manga.manga_id, {
              force: true, // Need catalog fetch for new chapters
            });

            const newMetadata = await this.getMangaMetadata(
              manga.extension_id,
              manga.manga_id,
            );

            // Log if new chapters discovered
            if (newMetadata && oldMetadata) {
              const oldCount = oldMetadata.chapters.length;
              const newCount = newMetadata.chapters.length;

              if (newCount > oldCount) {
                console.log(
                  `[OfflineStorage] Discovered ${newCount - oldCount} new chapters for ${manga.manga_slug}`,
                );

                // Emit event for UI notification
                this.emit({
                  type: "new-chapters-available",
                  mangaId: manga.manga_id,
                  newChapterCount: newCount - oldCount,
                });
              }
            }
          } catch (error) {
            console.error(
              `[OfflineStorage] Failed to sync metadata for ${manga.manga_slug}:`,
              error,
            );
          }
        }),
      );

      // Rate limit between batches
      if (i + concurrency < staleManga.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[OfflineStorage] Background metadata sync complete`);
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
        item.mangaId,
      );
      mangaTitle = mangaDetails.details.title;

      if (item.chapterId && mangaDetails.details.chapters) {
        const chapter = mangaDetails.details.chapters.find(
          (c) => c.id === item.chapterId,
        );
        if (chapter) {
          chapterTitle = this.formatChapterTitle(chapter);
        }
      }
    } catch {
      // Ignore errors, use defaults
    }

    const progressPercent =
      item.progressTotal > 0
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
  async deleteChapter(
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ): Promise<void> {
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
      chapter.folder_name,
    );
    await deleteDir(paths.chapterDir);

    // Remove from database
    this.repository.deleteChapter(offlineManga.id, chapterId);

    // Update manga metadata
    const metadata = await this.getMangaMetadata(extensionId, mangaId);
    if (metadata) {
      metadata.chapters = metadata.chapters.filter(
        (c) => c.chapterId !== chapterId,
      );
      metadata.lastUpdatedAt = Date.now();

      const mangaPaths = buildMangaPaths(
        this.dataDir,
        extensionId,
        offlineManga.manga_slug,
      );
      await writeJSON(mangaPaths.metadataFile, metadata);
    }

    // Recalculate manga size
    const mangaPaths = buildMangaPaths(
      this.dataDir,
      extensionId,
      offlineManga.manga_slug,
    );
    const newSize = await getDirSize(mangaPaths.mangaDir);
    this.repository.updateMangaSize(extensionId, mangaId, newSize);

    // If no chapters left, delete the manga
    const remainingChapters = this.repository.getChaptersByManga(
      offlineManga.id,
    );
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
    const paths = buildMangaPaths(
      this.dataDir,
      extensionId,
      offlineManga.manga_slug,
    );
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

  /**
   * Completely clears offline storage, including queue/history and filesystem
   */
  async nukeOfflineData(): Promise<void> {
    // Delete all known manga directories (covers + chapters)
    const allManga = this.repository.getAllManga();
    for (const manga of allManga) {
      const mangaPaths = buildMangaPaths(
        this.dataDir,
        manga.extension_id,
        manga.manga_slug,
      );
      await deleteDir(mangaPaths.mangaDir);
    }

    // Remove any leftover empty directories under the offline root
    const offlineRoot = path.join(this.dataDir, "offline");
    await deleteDir(offlineRoot);

    // Wipe database tables that track offline state
    this.repository.clearAllOfflineData();

    // Recreate the base offline directory so future downloads succeed
    await ensureDir(offlineRoot);
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
  async getMangaStorageSize(
    extensionId: string,
    mangaId: string,
  ): Promise<number> {
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
  // Metadata Maintenance
  // ==========================================================================

  private async ensureMangaMetadata(
    extensionId: string,
    mangaId: string,
    options: { force?: boolean } = {},
  ): Promise<OfflineMangaMetadata | null> {
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (!offlineManga) {
      return null;
    }

    const chapterRows = this.repository.getChaptersByManga(offlineManga.id);
    const mangaPaths = buildMangaPaths(
      this.dataDir,
      extensionId,
      offlineManga.manga_slug,
    );

    let existingMetadata: OfflineMangaMetadata | null = null;
    try {
      existingMetadata = await readJSON<OfflineMangaMetadata>(
        mangaPaths.metadataFile,
      );
    } catch (error) {
      if (!options.force) {
        console.warn(
          `[OfflineStorage] Metadata file missing or unreadable for manga ${mangaId}`,
          error,
        );
      }
    }

    const metadataChapterIds = new Set(
      existingMetadata?.chapters.map((chapter) => chapter.chapterId) ?? [],
    );
    const chapterRowIds = new Set(chapterRows.map((row) => row.chapter_id));

    let needsRebuild =
      options.force || !existingMetadata || metadataChapterIds.size !== chapterRowIds.size;

    if (!needsRebuild) {
      for (const id of chapterRowIds) {
        if (!metadataChapterIds.has(id)) {
          needsRebuild = true;
          break;
        }
      }
    }

    if (!needsRebuild) {
      return existingMetadata;
    }

    const mismatchReason = options.force
      ? "forced"
      : !existingMetadata
        ? "metadata missing"
        : `chapter mismatch (db=${chapterRows.length}, metadata=${metadataChapterIds.size})`;

    const logFn = options.force ? console.info : console.warn;
    logFn(
      `[OfflineStorage] Rebuilding metadata for manga ${mangaId}: ${mismatchReason}.`,
    );

    const rebuilt = await this.buildMangaMetadata(
      extensionId,
      mangaId,
      offlineManga,
      chapterRows,
      existingMetadata,
    );

    return rebuilt;
  }

  private async buildMangaMetadata(
    extensionId: string,
    mangaId: string,
    offlineManga: OfflineMangaRow,
    chapterRows: OfflineChapterRow[],
    existingMetadata: OfflineMangaMetadata | null,
  ): Promise<OfflineMangaMetadata> {
    const mangaPaths = buildMangaPaths(
      this.dataDir,
      extensionId,
      offlineManga.manga_slug,
    );

    type SyncResult = Awaited<ReturnType<CatalogService["syncManga"]>>;
    let mangaDetails: SyncResult | null = null;

    try {
      mangaDetails = await this.catalogService.syncManga(
        extensionId,
        mangaId,
      );
    } catch (error) {
      console.warn(
        `[OfflineStorage] Unable to sync catalog details while rebuilding metadata for ${mangaId}`,
        error,
      );
    }

    const details = mangaDetails?.details;
    const catalogChapters = details?.chapters
      ? new Map(details.chapters.map((chapter) => [chapter.id, chapter]))
      : new Map<string, ChapterSummary>();

    const chapterMetadata: OfflineChapterMetadata[] = [];
    for (const row of chapterRows) {
      const chapterDetails = catalogChapters.get(row.chapter_id);
      const metadata = await this.buildChapterMetadata(
        extensionId,
        offlineManga.manga_slug,
        row,
        chapterDetails,
      );
      chapterMetadata.push(metadata);
    }

    chapterMetadata.sort((a, b) => a.downloadedAt - b.downloadedAt);

    const downloadedAt =
      existingMetadata?.downloadedAt ??
      Number(offlineManga.downloaded_at) ??
      Date.now();

    const metadata: OfflineMangaMetadata = {
      version: 1,
      downloadedAt,
      lastUpdatedAt: Date.now(),
      mangaId,
      slug: offlineManga.manga_slug,
      extensionId,
      title: details?.title ?? existingMetadata?.title ?? mangaId,
      description: details?.description ?? existingMetadata?.description,
      coverUrl: details?.coverUrl ?? existingMetadata?.coverUrl,
      coverPath: await this.resolveCoverPath(mangaPaths, existingMetadata),
      authors: details?.authors ?? existingMetadata?.authors,
      artists: details?.artists ?? existingMetadata?.artists,
      genres: details?.genres ?? existingMetadata?.genres,
      tags: details?.tags ?? existingMetadata?.tags,
      rating: details?.rating ?? existingMetadata?.rating,
      year: details?.year ?? existingMetadata?.year,
      status: details?.status ?? existingMetadata?.status,
      demographic: details?.demographic ?? existingMetadata?.demographic,
      altTitles: details?.altTitles ?? existingMetadata?.altTitles,
      chapters: chapterMetadata,
    };

    await writeJSON(mangaPaths.metadataFile, metadata);

    const totalSizeBytes = await getDirSize(mangaPaths.mangaDir);
    this.repository.updateMangaSize(extensionId, mangaId, totalSizeBytes);

    return metadata;
  }

  private async buildChapterMetadata(
    extensionId: string,
    mangaSlug: string,
    row: OfflineChapterRow,
    chapterDetails?: ChapterSummary,
  ): Promise<OfflineChapterMetadata> {
    const chapterPaths = buildChapterPaths(
      this.dataDir,
      extensionId,
      mangaSlug,
      row.folder_name,
    );

    let chapterPages: OfflineChapterPages | null = null;
    try {
      chapterPages = await readJSON<OfflineChapterPages>(
        chapterPaths.metadataFile,
      );
    } catch {
      // Missing chapter metadata file is expected in some recovery paths.
    }

    const downloadedAt =
      (chapterPages && typeof chapterPages.downloadedAt === "number"
        ? chapterPages.downloadedAt
        : Number(row.downloaded_at)) || Date.now();

    const totalPages =
      chapterPages?.pages && Array.isArray(chapterPages.pages)
        ? chapterPages.pages.length
        : row.total_pages;

    let sizeBytes = row.size_bytes;
    if (!sizeBytes || sizeBytes <= 0) {
      sizeBytes = await getDirSize(chapterPaths.chapterDir);
    }

    const number = chapterDetails?.number ?? row.chapter_number ?? undefined;
    const title = chapterDetails?.title ?? row.chapter_title ?? undefined;

    const summary: ChapterSummary = {
      id: row.chapter_id,
      number,
      title,
    };

    const slugSource =
      number ??
      title ??
      row.chapter_number ??
      row.chapter_title ??
      row.chapter_id;
    const slug = sanitizeSlug(String(slugSource ?? row.chapter_id));

    return {
      chapterId: row.chapter_id,
      slug,
      number,
      title,
      displayTitle: this.formatChapterTitle(summary),
      volume: chapterDetails?.volume ?? undefined,
      publishedAt: chapterDetails?.publishedAt ?? undefined,
      languageCode: chapterDetails?.languageCode ?? undefined,
      scanlators: chapterDetails?.scanlators ?? undefined,
      folderName: row.folder_name,
      totalPages,
      downloadedAt,
      sizeBytes,
    };
  }

  private async resolveCoverPath(
    mangaPaths: ReturnType<typeof buildMangaPaths>,
    existingMetadata: OfflineMangaMetadata | null,
  ): Promise<string> {
    const existing = existingMetadata?.coverPath;
    if (existing) {
      const existingPath = path.join(mangaPaths.mangaDir, existing);
      if (await fileExists(existingPath)) {
        return existing;
      }
    }

    const candidates = [
      "cover.webp",
      "cover.png",
      "cover.jpeg",
      "cover.jpg",
    ];

    for (const candidate of candidates) {
      const candidatePath = path.join(mangaPaths.mangaDir, candidate);
      if (await fileExists(candidatePath)) {
        return candidate;
      }
    }

    return existing ?? "cover.jpg";
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
  getPagePath(
    mangaId: string,
    chapterId: string,
    filename: string,
  ): string | null {
    // This requires looking up the manga and chapter to get the paths
    // Will be used by the API server to serve offline images
    const allManga = this.repository.getAllManga();
    const offlineManga = allManga.find((m) => m.manga_id === mangaId);

    if (!offlineManga) return null;

    const chapter = this.repository.getChapter(offlineManga.id, chapterId);
    if (!chapter) return null;

    const paths = buildChapterPaths(
      this.dataDir,
      offlineManga.extension_id,
      offlineManga.manga_slug,
      chapter.folder_name,
    );

    return `${paths.chapterDir}/${filename}`;
  }
}

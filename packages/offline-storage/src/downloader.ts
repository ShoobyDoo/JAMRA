/**
 * Download Worker
 *
 * Background worker that processes the download queue and downloads manga chapters.
 */

import type { CatalogService } from "@jamra/catalog-service";
import type { ChapterSummary, MangaDetails } from "@jamra/extension-sdk";
import { OfflineRepository } from "./repository.js";
import {
  buildMangaPaths,
  buildChapterPaths,
  buildPagePath,
  generateChapterFolderName,
  generatePageFilename,
  sanitizeSlug,
} from "./utils/paths.js";
import {
  ensureDir,
  readJSON,
  writeJSON,
  fileExists,
  getDirSize,
} from "./utils/file-system.js";
import { ImageDownloader } from "./utils/image-downloader.js";
import {
  ProgressBatcher,
  type ProgressUpdate,
} from "./utils/progress-batcher.js";
import { MetadataCache } from "./utils/metadata-cache.js";
import {
  PerformanceMetricsTracker,
  type PerformanceMetrics,
} from "./utils/performance-metrics.js";
import type {
  OfflineMangaMetadata,
  OfflineChapterMetadata,
  OfflineChapterPages,
  OfflinePageMetadata,
  QueuedDownload,
  OfflineStorageEvent,
  OfflineStorageEventListener,
} from "./types.js";

export interface DownloadWorkerOptions {
  concurrency?: number; // Max concurrent page downloads (default: 3)
  pollingInterval?: number; // Queue polling interval in ms (default: 1000)
  chapterConcurrency?: number; // Max concurrent chapter downloads
  chapterDelayMs?: number; // Delay between chapter downloads in ms (default: 1000)
  progressBatchInterval?: number; // Progress update batching interval in ms (default: 1500)

  // Performance optimization options
  performance?: {
    enableMetrics?: boolean; // Track performance metrics (default: true)
    enableEventCoalescing?: boolean; // Batch events before emission (default: false)
    eventCoalescingInterval?: number; // Event batching interval in ms (default: 500)
    metadataCacheTTL?: number; // Metadata cache TTL in ms (default: 5 minutes)
    metadataCacheSize?: number; // Max metadata cache entries (default: 100)
  };
}

const DEFAULT_CHAPTER_CONCURRENCY = 3;

export class DownloadWorker {
  private isRunning = false;
  private readonly activeDownloads: Set<number> = new Set();
  private readonly imageDownloader: ImageDownloader;
  private readonly progressBatcher: ProgressBatcher;
  private readonly metadataCache: MetadataCache;
  private readonly metricsTracker: PerformanceMetricsTracker | null;
  private readonly concurrency: number;
  private readonly pollingInterval: number;
  private readonly chapterConcurrency: number;
  private readonly chapterDelayMs: number;
  private lastChapterDownloadTime = 0;
  private readonly eventListeners: Set<OfflineStorageEventListener> = new Set();
  private readonly performanceOptions: Required<
    NonNullable<DownloadWorkerOptions["performance"]>
  >;

  constructor(
    private readonly dataDir: string,
    private readonly repository: OfflineRepository,
    private readonly catalogService: CatalogService,
    options: DownloadWorkerOptions = {},
  ) {
    this.imageDownloader = new ImageDownloader();
    this.concurrency = options.concurrency ?? 3;
    this.pollingInterval = options.pollingInterval ?? 1000;
    const requestedChapterConcurrency =
      options.chapterConcurrency ?? DEFAULT_CHAPTER_CONCURRENCY;
    this.chapterConcurrency = Math.max(1, requestedChapterConcurrency);
    this.chapterDelayMs = options.chapterDelayMs ?? 1000;

    // Initialize performance options
    this.performanceOptions = {
      enableMetrics: options.performance?.enableMetrics ?? true,
      enableEventCoalescing: options.performance?.enableEventCoalescing ?? false,
      eventCoalescingInterval:
        options.performance?.eventCoalescingInterval ?? 500,
      metadataCacheTTL: options.performance?.metadataCacheTTL ?? 5 * 60 * 1000,
      metadataCacheSize: options.performance?.metadataCacheSize ?? 100,
    };

    // Initialize metrics tracker if enabled
    this.metricsTracker = this.performanceOptions.enableMetrics
      ? new PerformanceMetricsTracker()
      : null;

    // Initialize progress batcher with callback that handles both DB and events
    this.progressBatcher = new ProgressBatcher(
      (update: ProgressUpdate) => {
        // Update database
        this.repository.updateQueueProgress(
          update.queueId,
          update.progressCurrent,
          update.progressTotal,
        );

        // Track metrics
        this.metricsTracker?.databaseWrite();

        // Emit progress event
        this.emit({
          type: "download-progress",
          queueId: update.queueId,
          mangaId: update.mangaId,
          chapterId: update.chapterId,
          progressCurrent: update.progressCurrent,
          progressTotal: update.progressTotal,
        });
      },
      {
        flushInterval: options.progressBatchInterval ?? 1500,
        flushOnComplete: true,
      },
    );

    // Initialize metadata cache to reduce redundant network calls
    this.metadataCache = new MetadataCache({
      maxSize: this.performanceOptions.metadataCacheSize,
      ttlMs: this.performanceOptions.metadataCacheTTL,
    });
  }

  // ==========================================================================
  // Event Emitter
  // ==========================================================================

  on(listener: OfflineStorageEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: OfflineStorageEvent): void {
    // Track metrics
    this.metricsTracker?.eventEmitted();

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in download worker event listener:", error);
      }
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics | null {
    return this.metricsTracker?.getMetrics() ?? null;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metricsTracker?.reset();
  }

  private async resetStaleDownloads(): Promise<void> {
    const staleDownloads = this.repository.getAllQueueItems().filter(
      (item: QueuedDownload) => item.status === "downloading",
    );

    if (staleDownloads.length > 0) {
      console.log(
        `[DownloadWorker] Found ${staleDownloads.length} stale downloads, resetting to queued`,
      );

      // Process in batches to avoid blocking the event loop
      const BATCH_SIZE = 10;
      for (let i = 0; i < staleDownloads.length; i += BATCH_SIZE) {
        const batch = staleDownloads.slice(i, i + BATCH_SIZE);

        for (const item of batch) {
          this.repository.updateQueueStatus(item.id, "queued");
          this.emit({
            type: "download-queued",
            queueId: item.id,
            mangaId: item.mangaId,
            chapterId: item.chapterId,
          });
        }

        // Yield control back to event loop after each batch
        // This allows the HTTP servers (catalog + Next.js) to respond to requests
        if (i + BATCH_SIZE < staleDownloads.length) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
    }
  }

  // ==========================================================================
  // Worker Lifecycle
  // ==========================================================================

  /**
   * Starts the download worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Download worker is already running");
    }

    this.isRunning = true;
    console.log("[DownloadWorker] Started - will reset stale downloads in background");

    // Defer stale download reset to avoid blocking startup
    // This runs completely in the background after the worker has started
    void this.resetStaleDownloadsAsync();

    // Start processing queue in background
    void this.processQueue();
  }

  /**
   * Resets stale downloads in the background without blocking startup
   */
  private async resetStaleDownloadsAsync(): Promise<void> {
    console.log("[DownloadWorker] Resetting stale downloads in background...");
    const resetStart = Date.now();

    try {
      await this.resetStaleDownloads();
      const resetTime = Date.now() - resetStart;
      console.log(`[DownloadWorker] Reset stale downloads completed in ${resetTime}ms`);
    } catch (error) {
      console.error("[DownloadWorker] Failed to reset stale downloads:", error);
    }
  }

  /**
   * Stops the download worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log("Download worker stopped");

    // Flush any pending progress updates
    this.progressBatcher.destroy();

    // Wait for current download to complete
    // In production, might want to save state and resume later
  }

  /**
   * Checks if worker is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Gets list of active download queue IDs
   */
  getActiveDownloads(): number[] {
    return Array.from(this.activeDownloads);
  }

  // ==========================================================================
  // Queue Processing
  // ==========================================================================

  /**
   * Main queue processing loop - respects chapter concurrency and rate limiting
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Start new downloads up to chapter concurrency limit
        while (this.activeDownloads.size < this.chapterConcurrency && this.isRunning) {
          const item = this.repository.getNextQueuedDownload();

          if (!item) {
            // No more items in queue
            break;
          }

          // Rate limiting: enforce delay between chapter downloads
          const timeSinceLastDownload = Date.now() - this.lastChapterDownloadTime;
          if (timeSinceLastDownload < this.chapterDelayMs) {
            // Too soon, wait before starting next download
            await this.sleep(this.chapterDelayMs - timeSinceLastDownload);
          }

          // Update last download time
          this.lastChapterDownloadTime = Date.now();

          // Start download in background (non-blocking)
          void this.startDownloadAsync(item);
        }

        // Sleep before checking queue again
        await this.sleep(this.pollingInterval);
      } catch (error) {
        console.error("Error in download queue processing:", error);
        await this.sleep(this.pollingInterval);
      }
    }
  }

  /**
   * Starts a download in the background
   */
  private async startDownloadAsync(item: QueuedDownload): Promise<void> {
    // Track this download as active
    this.activeDownloads.add(item.id);

    try {
      await this.downloadItem(item);
    } catch (error) {
      await this.handleDownloadError(item, error);
    } finally {
      // Remove from active downloads when complete
      this.activeDownloads.delete(item.id);
    }
  }

  /**
   * Downloads a queue item (chapter or full manga)
   */
  private async downloadItem(item: QueuedDownload): Promise<void> {
    // Track download started
    this.metricsTracker?.downloadStarted(item.id);

    // Mark as downloading
    this.repository.updateQueueStatus(item.id, "downloading");
    this.emit({
      type: "download-started",
      queueId: item.id,
      mangaId: item.mangaId,
      chapterId: item.chapterId,
    });

    let pagesDownloaded = 0;

    if (item.chapterId) {
      // Download single chapter
      pagesDownloaded = await this.downloadChapter(item);
    } else {
      // Download all manga chapters
      pagesDownloaded = await this.downloadManga(item);
    }

    // Flush any pending progress updates before marking complete
    this.progressBatcher.flush();

    // Track download completed
    this.metricsTracker?.downloadCompleted(item.id, pagesDownloaded);

    // Mark as completed and move to history
    this.repository.updateQueueStatus(item.id, "completed");
    this.repository.moveQueueItemToHistory(item.id);
    this.emit({
      type: "download-completed",
      queueId: item.id,
      mangaId: item.mangaId,
      chapterId: item.chapterId,
    });
  }

  /**
   * Downloads a single chapter
   */
  private async downloadChapter(item: QueuedDownload): Promise<number> {
    if (!item.chapterId) {
      throw new Error("Chapter ID is required for chapter download");
    }

    // Check cache first, then fetch if needed
    let mangaDetails = this.metadataCache.getManga({
      extensionId: item.extensionId,
      mangaId: item.mangaId,
    });

    if (!mangaDetails) {
      // Cache miss - fetch from catalog service
      this.metricsTracker?.networkRequest();
      const result = await this.catalogService.syncManga(
        item.extensionId,
        item.mangaId,
      );
      mangaDetails = result.details;
      // Cache for future use
      this.metadataCache.setManga(
        { extensionId: item.extensionId, mangaId: item.mangaId },
        mangaDetails,
      );
    } else {
      // Cache hit
      this.metricsTracker?.cacheHit();
    }

    const chapter = mangaDetails.chapters?.find(
      (c) => c.id === item.chapterId,
    );
    if (!chapter) {
      throw new Error(
        `Chapter ${item.chapterId} not found in manga ${item.mangaId}`,
      );
    }

    const mangaSlug = sanitizeSlug(
      mangaDetails.slug || mangaDetails.title,
    );

    // Ensure manga metadata exists
    await this.ensureMangaMetadata(
      item.extensionId,
      mangaDetails,
      mangaSlug,
    );

    // Check cache for chapter pages
    let chapterPages = this.metadataCache.getChapterPages({
      extensionId: item.extensionId,
      mangaId: item.mangaId,
      chapterId: item.chapterId!,
    });

    if (!chapterPages) {
      // Cache miss - fetch from catalog service
      this.metricsTracker?.networkRequest();
      const result = await this.catalogService.syncChapterPages(
        item.extensionId,
        item.mangaId,
        item.chapterId!,
      );
      chapterPages = result.pages;
      // Cache for future use
      this.metadataCache.setChapterPages(
        {
          extensionId: item.extensionId,
          mangaId: item.mangaId,
          chapterId: item.chapterId!,
        },
        chapterPages,
      );
    } else {
      // Cache hit
      this.metricsTracker?.cacheHit();
    }

    // Validate chapter pages
    if (
      !chapterPages ||
      !chapterPages.pages ||
      !Array.isArray(chapterPages.pages)
    ) {
      throw new Error(
        `Invalid chapter pages response: pages is ${chapterPages?.pages === undefined ? "undefined" : typeof chapterPages?.pages}`,
      );
    }

    if (chapterPages.pages.length === 0) {
      throw new Error("No pages found for this chapter");
    }

    const totalPages = chapterPages.pages.length;

    // Send initial progress update through batcher
    this.progressBatcher.update({
      queueId: item.id,
      mangaId: item.mangaId,
      chapterId: item.chapterId,
      progressCurrent: 0,
      progressTotal: totalPages,
    });

    // Download chapter
    await this.downloadChapterPages(
      item.extensionId,
      mangaSlug,
      item.mangaId,
      chapter,
      chapterPages.pages,
      (current, total) => {
        // Buffer progress updates instead of immediate DB write + event
        this.progressBatcher.update({
          queueId: item.id,
          mangaId: item.mangaId,
          chapterId: item.chapterId,
          progressCurrent: current,
          progressTotal: total,
        });
      },
    );

    return chapterPages.pages.length;
  }

  /**
   * Downloads all chapters for a manga
   */
  private async downloadManga(item: QueuedDownload): Promise<number> {
    // Check cache first, then fetch if needed
    let mangaDetails = this.metadataCache.getManga({
      extensionId: item.extensionId,
      mangaId: item.mangaId,
    });

    if (!mangaDetails) {
      // Cache miss - fetch from catalog service
      this.metricsTracker?.networkRequest();
      const result = await this.catalogService.syncManga(
        item.extensionId,
        item.mangaId,
      );
      mangaDetails = result.details;
      // Cache for future use
      this.metadataCache.setManga(
        { extensionId: item.extensionId, mangaId: item.mangaId },
        mangaDetails,
      );
    } else {
      // Cache hit
      this.metricsTracker?.cacheHit();
    }

    const chapters = mangaDetails.chapters || [];
    const mangaSlug = sanitizeSlug(
      mangaDetails.slug || mangaDetails.title,
    );

    // Ensure manga metadata exists
    await this.ensureMangaMetadata(
      item.extensionId,
      mangaDetails,
      mangaSlug,
    );

    // Download each chapter
    let totalPagesDownloaded = 0;

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];

      // Check cache for chapter pages
      let chapterPages = this.metadataCache.getChapterPages({
        extensionId: item.extensionId,
        mangaId: item.mangaId,
        chapterId: chapter.id,
      });

      if (!chapterPages) {
        // Cache miss - fetch from catalog service
        this.metricsTracker?.networkRequest();
        const result = await this.catalogService.syncChapterPages(
          item.extensionId,
          item.mangaId,
          chapter.id,
        );
        chapterPages = result.pages;
        // Cache for future use
        this.metadataCache.setChapterPages(
          {
            extensionId: item.extensionId,
            mangaId: item.mangaId,
            chapterId: chapter.id,
          },
          chapterPages,
        );
      } else {
        // Cache hit
        this.metricsTracker?.cacheHit();
      }

      totalPagesDownloaded += chapterPages.pages.length;

      await this.downloadChapterPages(
        item.extensionId,
        mangaSlug,
        item.mangaId,
        chapter,
        chapterPages.pages,
        (current, total) => {
          // Calculate overall progress
          const chapterProgress = current / total;
          const overallProgress = (i + chapterProgress) / chapters.length;
          const progressCurrent = Math.floor(
            overallProgress * chapters.length * 100,
          );
          const progressTotal = chapters.length * 100;

          // Buffer progress updates instead of immediate DB write + event
          this.progressBatcher.update({
            queueId: item.id,
            mangaId: item.mangaId,
            chapterId: chapter.id,
            progressCurrent,
            progressTotal,
          });
        },
      );

      // Yield to event loop after each chapter to keep app responsive
      await new Promise((resolve) => setImmediate(resolve));
    }

    return totalPagesDownloaded;
  }

  /**
   * Ensures manga metadata exists (creates or updates)
   */
  private async ensureMangaMetadata(
    extensionId: string,
    mangaDetails: MangaDetails,
    mangaSlug: string,
  ): Promise<void> {
    const paths = buildMangaPaths(this.dataDir, extensionId, mangaSlug);

    // Check if metadata already exists
    const exists = await fileExists(paths.metadataFile);

    if (exists) {
      // Update existing metadata
      const metadata = await readJSON<OfflineMangaMetadata>(paths.metadataFile);
      metadata.lastUpdatedAt = Date.now();
      await writeJSON(paths.metadataFile, metadata);
      return;
    }

    // Create new metadata
    await ensureDir(paths.mangaDir);
    await ensureDir(paths.chaptersDir);

    // Download cover image if available
    let coverPath = "cover.jpg";
    if (mangaDetails.coverUrl) {
      try {
        const result = await this.imageDownloader.download(
          mangaDetails.coverUrl,
          paths.coverFile,
        );
        coverPath = `cover.${result.filename.split(".").pop()}`;
      } catch (error) {
        console.warn(
          `Failed to download cover for ${mangaDetails.title}:`,
          error,
        );
      }
    }

    // Create metadata
    const metadata: OfflineMangaMetadata = {
      version: 1,
      downloadedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      mangaId: mangaDetails.id,
      slug: mangaSlug,
      extensionId,
      title: mangaDetails.title,
      description: mangaDetails.description,
      coverUrl: mangaDetails.coverUrl,
      coverPath,
      authors: mangaDetails.authors,
      artists: mangaDetails.artists,
      genres: mangaDetails.genres,
      tags: mangaDetails.tags,
      rating: mangaDetails.rating,
      year: mangaDetails.year,
      status: mangaDetails.status,
      demographic: mangaDetails.demographic,
      altTitles: mangaDetails.altTitles,
      chapters: [],
    };

    await writeJSON(paths.metadataFile, metadata);

    // Add to database
    this.repository.insertManga({
      extension_id: extensionId,
      manga_id: mangaDetails.id,
      manga_slug: mangaSlug,
      download_path: paths.mangaDir,
      downloaded_at: Date.now(),
      last_updated_at: Date.now(),
      total_size_bytes: await getDirSize(paths.mangaDir),
    });
  }

  /**
   * Downloads all pages for a chapter
   */
  private async downloadChapterPages(
    extensionId: string,
    mangaSlug: string,
    mangaId: string,
    chapter: ChapterSummary,
    pages: Array<{
      index: number;
      url: string;
      width?: number;
      height?: number;
    }>,
    onProgress: (current: number, total: number) => void,
  ): Promise<void> {
    const folderName = generateChapterFolderName(chapter.number || chapter.id);
    const chapterPaths = buildChapterPaths(
      this.dataDir,
      extensionId,
      mangaSlug,
      folderName,
    );

    await ensureDir(chapterPaths.chapterDir);

    // Download all pages with concurrency control
    const pageMetadata: OfflinePageMetadata[] = [];
    let completed = 0;

    const downloads = pages.map((page) => ({
      url: page.url,
      destPath: buildPagePath(
        this.dataDir,
        extensionId,
        mangaSlug,
        folderName,
        generatePageFilename(page.index),
      ),
      pageData: page,
    }));

    // Process in batches with real-time progress updates
    for (let i = 0; i < downloads.length; i += this.concurrency) {
      const batch = downloads.slice(i, i + this.concurrency);

      // Download pages concurrently but report progress individually
      const results = await Promise.all(
        batch.map(async ({ url, destPath, pageData }) => {
          const result = await this.imageDownloader.download(url, destPath);

          // Report progress immediately after each page completes
          completed++;
          onProgress(completed, pages.length);

          return {
            index: pageData.index,
            originalUrl: url,
            filename: result.filename,
            width: pageData.width,
            height: pageData.height,
            sizeBytes: result.sizeBytes,
            mimeType: result.mimeType,
          };
        }),
      );

      pageMetadata.push(...results);

      // Yield to event loop every 5 pages to keep app responsive
      // This allows UI interactions, API requests, and navigation to proceed
      if ((i + this.concurrency) % 5 === 0 || i + this.concurrency >= downloads.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    // Save chapter metadata
    const chapterPages: OfflineChapterPages = {
      version: 1,
      downloadedAt: Date.now(),
      chapterId: chapter.id,
      mangaId,
      folderName,
      pages: pageMetadata.sort((a, b) => a.index - b.index),
    };

    await writeJSON(chapterPaths.metadataFile, chapterPages);

    // Update manga metadata
    const mangaPaths = buildMangaPaths(this.dataDir, extensionId, mangaSlug);
    const mangaMetadata = await readJSON<OfflineMangaMetadata>(
      mangaPaths.metadataFile,
    );

    const displayTitle = this.formatChapterTitle(chapter);
    const chapterSize = await getDirSize(chapterPaths.chapterDir);

    const chapterMetadata: OfflineChapterMetadata = {
      chapterId: chapter.id,
      slug: sanitizeSlug(chapter.number || chapter.id),
      number: chapter.number,
      title: chapter.title,
      displayTitle,
      volume: chapter.volume,
      publishedAt: chapter.publishedAt,
      languageCode: chapter.languageCode,
      scanlators: chapter.scanlators,
      folderName,
      totalPages: pages.length,
      downloadedAt: Date.now(),
      sizeBytes: chapterSize,
    };

    // Add or update chapter in manga metadata
    const existingIndex = mangaMetadata.chapters.findIndex(
      (c) => c.chapterId === chapter.id,
    );
    if (existingIndex >= 0) {
      mangaMetadata.chapters[existingIndex] = chapterMetadata;
    } else {
      mangaMetadata.chapters.push(chapterMetadata);
    }

    mangaMetadata.lastUpdatedAt = Date.now();
    await writeJSON(mangaPaths.metadataFile, mangaMetadata);

    // Update database
    const offlineManga = this.repository.getManga(extensionId, mangaId);
    if (offlineManga) {
      this.repository.insertChapter({
        offline_manga_id: offlineManga.id,
        chapter_id: chapter.id,
        chapter_number: chapter.number || null,
        chapter_title: chapter.title || null,
        folder_name: folderName,
        total_pages: pages.length,
        downloaded_at: Date.now(),
        size_bytes: chapterSize,
      });

      // Update manga total size
      const mangaTotalSize = await getDirSize(mangaPaths.mangaDir);
      this.repository.updateMangaSize(extensionId, mangaId, mangaTotalSize);
    }
  }

  /**
   * Handles download errors with retry logic
   */
  private async handleDownloadError(
    item: QueuedDownload,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(
      `Download failed for queue item ${item.id} (${item.mangaSlug}):`,
      errorMessage,
    );

    // Flush any pending progress updates before handling error
    this.progressBatcher.flush();

    // Track download failure
    this.metricsTracker?.downloadFailed(item.id);

    // Check if error is retryable (rate limiting, temporary errors, network issues)
    const isRetryable = errorMessage.includes('temporarily unavailable') ||
                       errorMessage.includes('rate limit') ||
                       errorMessage.includes('ECONNRESET') ||
                       errorMessage.includes('ETIMEDOUT') ||
                       errorMessage.includes('503') ||
                       errorMessage.includes('429');

    // Extract retry count from error message (format: "Retry X/Y")
    const retryMatch = item.errorMessage?.match(/Retry (\d+)\/\d+/);
    const retryCount = retryMatch ? parseInt(retryMatch[1], 10) : 0;
    const maxRetries = 3;

    if (isRetryable && retryCount < maxRetries) {
      // Calculate exponential backoff delay: 5s, 15s, 45s
      const delayMs = 5000 * Math.pow(3, retryCount);

      console.log(
        `[DownloadWorker] Will retry queue item ${item.id} after ${delayMs / 1000}s (attempt ${retryCount + 1}/${maxRetries})`,
      );

      // Reset to queued status with retry information in error message
      this.repository.updateQueueStatus(
        item.id,
        "queued",
        `Retry ${retryCount + 1}/${maxRetries}`,
      );

      // Wait before retrying
      await this.sleep(delayMs);

      return; // Will be picked up again by processQueue
    }

    // Max retries reached or non-retryable error - mark as failed
    this.repository.updateQueueStatus(item.id, "failed", errorMessage);
    this.emit({
      type: "download-failed",
      queueId: item.id,
      mangaId: item.mangaId,
      chapterId: item.chapterId,
      error: errorMessage,
    });
  }

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
   * Helper to sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

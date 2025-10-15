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
  concurrency?: number;              // Max concurrent page downloads (default: 3)
  pollingInterval?: number;          // Queue polling interval in ms (default: 1000)
}

export class DownloadWorker {
  private isRunning = false;
  private readonly activeDownloads: Set<number> = new Set();
  private readonly imageDownloader: ImageDownloader;
  private readonly concurrency: number;
  private readonly pollingInterval: number;
  private readonly eventListeners: Set<OfflineStorageEventListener> = new Set();

  constructor(
    private readonly dataDir: string,
    private readonly repository: OfflineRepository,
    private readonly catalogService: CatalogService,
    options: DownloadWorkerOptions = {}
  ) {
    this.imageDownloader = new ImageDownloader();
    this.concurrency = options.concurrency ?? 3;
    this.pollingInterval = options.pollingInterval ?? 1000;
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
        console.error("Error in download worker event listener:", error);
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
    console.log("Download worker started");

    // Start processing queue in background
    void this.processQueue();
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
   * Main queue processing loop - starts up to 3 concurrent downloads
   */
  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Start new downloads up to concurrency limit
        while (this.activeDownloads.size < this.concurrency && this.isRunning) {
          const item = this.repository.getNextQueuedDownload();

          if (!item) {
            // No more items in queue
            break;
          }

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
    // Mark as downloading
    this.repository.updateQueueStatus(item.id, "downloading");
    this.emit({
      type: "download-started",
      queueId: item.id,
      mangaId: item.mangaId,
      chapterId: item.chapterId,
    });

    if (item.chapterId) {
      // Download single chapter
      await this.downloadChapter(item);
    } else {
      // Download all manga chapters
      await this.downloadManga(item);
    }

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
  private async downloadChapter(item: QueuedDownload): Promise<void> {
    if (!item.chapterId) {
      throw new Error("Chapter ID is required for chapter download");
    }

    // Fetch manga and chapter details
    const mangaDetails = await this.catalogService.syncManga(
      item.extensionId,
      item.mangaId
    );

    const chapter = mangaDetails.details.chapters?.find(c => c.id === item.chapterId);
    if (!chapter) {
      throw new Error(`Chapter ${item.chapterId} not found in manga ${item.mangaId}`);
    }

    const mangaSlug = sanitizeSlug(
      mangaDetails.details.slug || mangaDetails.details.title
    );

    // Ensure manga metadata exists
    await this.ensureMangaMetadata(item.extensionId, mangaDetails.details, mangaSlug);

    // Fetch chapter pages
    const { pages: chapterPages } = await this.catalogService.syncChapterPages(
      item.extensionId,
      item.mangaId,
      item.chapterId!
    );

    // Validate chapter pages
    if (!chapterPages || !chapterPages.pages || !Array.isArray(chapterPages.pages)) {
      throw new Error(`Invalid chapter pages response: pages is ${chapterPages?.pages === undefined ? 'undefined' : typeof chapterPages?.pages}`);
    }

    if (chapterPages.pages.length === 0) {
      throw new Error("No pages found for this chapter");
    }

    const totalPages = chapterPages.pages.length;
    this.repository.updateQueueProgress(item.id, 0, totalPages);

    // Emit initial progress event
    this.emit({
      type: "download-progress",
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
        this.repository.updateQueueProgress(item.id, current, total);
        this.emit({
          type: "download-progress",
          queueId: item.id,
          mangaId: item.mangaId,
          chapterId: item.chapterId,
          progressCurrent: current,
          progressTotal: total,
        });
      }
    );
  }

  /**
   * Downloads all chapters for a manga
   */
  private async downloadManga(item: QueuedDownload): Promise<void> {
    // Fetch manga details with chapters
    const mangaDetails = await this.catalogService.syncManga(
      item.extensionId,
      item.mangaId
    );

    const chapters = mangaDetails.details.chapters || [];
    const mangaSlug = sanitizeSlug(
      mangaDetails.details.slug || mangaDetails.details.title
    );

    // Ensure manga metadata exists
    await this.ensureMangaMetadata(item.extensionId, mangaDetails.details, mangaSlug);

    // Download each chapter
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];

      // Fetch chapter pages
      const { pages: chapterPages } = await this.catalogService.syncChapterPages(
        item.extensionId,
        item.mangaId,
        chapter.id
      );

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
          const progressCurrent = Math.floor(overallProgress * chapters.length * 100);
          const progressTotal = chapters.length * 100;

          this.repository.updateQueueProgress(item.id, progressCurrent, progressTotal);
          this.emit({
            type: "download-progress",
            queueId: item.id,
            mangaId: item.mangaId,
            chapterId: chapter.id,
            progressCurrent,
            progressTotal,
          });
        }
      );
    }
  }

  /**
   * Ensures manga metadata exists (creates or updates)
   */
  private async ensureMangaMetadata(
    extensionId: string,
    mangaDetails: MangaDetails,
    mangaSlug: string
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
          paths.coverFile
        );
        coverPath = `cover.${result.filename.split(".").pop()}`;
      } catch (error) {
        console.warn(`Failed to download cover for ${mangaDetails.title}:`, error);
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
    pages: Array<{ index: number; url: string; width?: number; height?: number }>,
    onProgress: (current: number, total: number) => void
  ): Promise<void> {
    const folderName = generateChapterFolderName(chapter.number || chapter.id);
    const chapterPaths = buildChapterPaths(this.dataDir, extensionId, mangaSlug, folderName);

    await ensureDir(chapterPaths.chapterDir);

    // Download all pages with concurrency control
    const pageMetadata: OfflinePageMetadata[] = [];
    let completed = 0;

    const downloads = pages.map(page => ({
      url: page.url,
      destPath: buildPagePath(
        this.dataDir,
        extensionId,
        mangaSlug,
        folderName,
        generatePageFilename(page.index)
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
        })
      );

      pageMetadata.push(...results);
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
    const mangaMetadata = await readJSON<OfflineMangaMetadata>(mangaPaths.metadataFile);

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
    const existingIndex = mangaMetadata.chapters.findIndex(c => c.chapterId === chapter.id);
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
   * Handles download errors
   */
  private async handleDownloadError(item: QueuedDownload, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(
      `Download failed for queue item ${item.id} (${item.mangaSlug}):`,
      errorMessage
    );

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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

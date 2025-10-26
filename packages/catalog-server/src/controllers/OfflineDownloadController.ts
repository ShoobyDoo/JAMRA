/**
 * Offline Download Controller
 *
 * Handles download queue management and download operations
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { SERVER_CONFIG } from "../config/index.js";

export class OfflineDownloadController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/offline/download/chapter
   * Queue a single chapter for download
   */
  async queueChapterDownload(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { extensionId, mangaId, chapterId, priority } = req.body;

      if (!extensionId || !mangaId || !chapterId) {
        res.status(400).json({
          error: "extensionId, mangaId, and chapterId are required",
        });
        return;
      }

      console.log("[OfflineAPI] queue-chapter request", {
        extensionId,
        mangaId,
        chapterId,
      });
      const queueId = await this.deps.downloadWorker.queueChapterDownload(
        extensionId,
        mangaId,
        chapterId,
        { priority: priority ?? 0 },
      );

      console.log("[OfflineAPI] queue-chapter success", { queueId });
      res.status(201).json({ queueId, success: true });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("already downloaded")
      ) {
        res.status(409).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to queue chapter download");
    }
  }

  /**
   * POST /api/offline/download/manga
   * Queue a manga (all or specific chapters) for download
   */
  async queueMangaDownload(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { extensionId, mangaId, chapterIds, priority } = req.body;

      if (!extensionId || !mangaId) {
        res.status(400).json({
          error: "extensionId and mangaId are required",
        });
        return;
      }

      console.log("[OfflineAPI] queue-manga request", {
        extensionId,
        mangaId,
        chapterCount: Array.isArray(chapterIds) ? chapterIds.length : "all",
      });
      const queueIds = await this.deps.downloadWorker.queueMangaDownload(
        extensionId,
        mangaId,
        { chapterIds, priority: priority ?? 0 },
      );

      console.log("[OfflineAPI] queue-manga success", {
        queueIds,
      });
      res.status(201).json({ queueIds, success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to queue manga download");
    }
  }

  /**
   * GET /api/offline/queue
   * Get all queued downloads
   */
  async getQueue(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] get queue request");
      const queue = await this.deps.downloadWorker.getQueuedDownloads();
      console.log("[OfflineAPI] get queue response", { size: queue.length });
      res.json({ queue });
    } catch (error) {
      this.handleError(res, error, "Failed to get download queue");
    }
  }

  /**
   * GET /api/offline/queue/:queueId
   * Get download progress for a specific queue item
   */
  async getQueueItem(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queueId = Number.parseInt(req.params.queueId, 10);
      if (Number.isNaN(queueId)) {
        res.status(400).json({ error: "Invalid queue ID" });
        return;
      }

      console.log("[OfflineAPI] get queue item", { queueId });
      const progress = await this.deps.downloadWorker.getDownloadProgress(queueId);

      if (!progress) {
        res.status(404).json({ error: "Queue item not found" });
        return;
      }

      console.log("[OfflineAPI] get queue item success", {
        queueId,
        status: progress.status,
      });
      res.json({ progress });
    } catch (error) {
      this.handleError(res, error, "Failed to get download progress");
    }
  }

  /**
   * POST /api/offline/queue/:queueId/cancel
   * Cancel a queued download
   */
  async cancelDownload(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queueId = Number.parseInt(req.params.queueId, 10);
      if (Number.isNaN(queueId)) {
        res.status(400).json({ error: "Invalid queue ID" });
        return;
      }

      console.log("[OfflineAPI] cancel queue", { queueId });
      await this.deps.downloadWorker.cancelDownload(queueId);

      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (
        error instanceof Error &&
        error.message.includes("currently in progress")
      ) {
        res.status(409).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to cancel download");
    }
  }

  /**
   * POST /api/offline/queue/:queueId/retry
   * Retry a failed download
   */
  async retryDownload(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const queueId = Number.parseInt(req.params.queueId, 10);
      if (Number.isNaN(queueId)) {
        res.status(400).json({ error: "Invalid queue ID" });
        return;
      }

      console.log("[OfflineAPI] retry queue", { queueId });
      await this.deps.downloadWorker.retryDownload(queueId);

      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to retry download");
    }
  }

  /**
   * POST /api/offline/queue/retry-frozen
   * Retry all frozen downloads
   */
  async retryFrozenDownloads(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] retry frozen queue items");
      const retriedIds = await this.deps.downloadWorker.retryFrozenDownloads();

      res.json({ success: true, retriedCount: retriedIds.length, retriedIds });
    } catch (error) {
      this.handleError(res, error, "Failed to retry frozen downloads");
    }
  }

  /**
   * GET /api/offline/events
   * Server-Sent Events endpoint for real-time download progress
   */
  async getDownloadEvents(req: Request, res: Response): Promise<void> {
    if (!this.deps.downloadWorker) {
      res.status(503).json({ error: "Offline storage not available" });
      return;
    }

    console.log("[OfflineAPI] SSE /offline/events connection opened");
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // Send initial connection event
    res.write("event: connected\n");
    res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    // Listen to download worker events
    const unsubscribeWorker = this.deps.downloadWorker.on((event) => {
      try {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error("Error writing SSE event:", error);
      }
    });

    // Send heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write("event: heartbeat\n");
        res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      } catch (error) {
        console.error("Error sending heartbeat:", error);
        clearInterval(heartbeat);
      }
    }, SERVER_CONFIG.SSE_HEARTBEAT_INTERVAL_MS);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribeWorker();
      console.log("[OfflineAPI] SSE /offline/events connection closed");
    });
  }
}

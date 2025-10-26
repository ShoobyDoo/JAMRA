/**
 * Offline Routes
 *
 * Aggregates all offline storage controllers
 */

import { Router } from "express";
import multer from "multer";
import path from "node:path";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { OfflineDownloadController } from "../controllers/OfflineDownloadController.js";
import { OfflineContentController } from "../controllers/OfflineContentController.js";
import { OfflineStorageController } from "../controllers/OfflineStorageController.js";
import { OfflineArchiveController } from "../controllers/OfflineArchiveController.js";
import { OfflineHistoryController } from "../controllers/OfflineHistoryController.js";
import { OfflineSchedulerController } from "../controllers/OfflineSchedulerController.js";
import { strictLimiter, moderateLimiter, relaxedLimiter, uploadLimiter } from "../middleware/rateLimiter.js";

export function createOfflineRoutes(deps: ServerDependencies): Router {
  const router = Router();

  // Set up file upload middleware (multer)
  const upload = multer({
    dest: path.join(process.cwd(), ".jamra-data", ".uploads"),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max file size
    },
  });

  // Initialize controllers
  const downloadController = new OfflineDownloadController(deps);
  const contentController = new OfflineContentController(deps);
  const storageController = new OfflineStorageController(deps);
  const archiveController = new OfflineArchiveController(deps);
  const historyController = new OfflineHistoryController(deps);
  const schedulerController = new OfflineSchedulerController(deps);

  // Download management routes (strict rate limiting for expensive operations)
  router.post("/api/offline/download/chapter", strictLimiter, (req, res) =>
    downloadController.queueChapterDownload(req, res),
  );
  router.post("/api/offline/download/manga", strictLimiter, (req, res) =>
    downloadController.queueMangaDownload(req, res),
  );
  router.get("/api/offline/queue", relaxedLimiter, (req, res) =>
    downloadController.getQueue(req, res),
  );
  router.get("/api/offline/queue/:queueId", relaxedLimiter, (req, res) =>
    downloadController.getQueueItem(req, res),
  );
  router.post("/api/offline/queue/:queueId/cancel", moderateLimiter, (req, res) =>
    downloadController.cancelDownload(req, res),
  );
  router.post("/api/offline/queue/:queueId/retry", moderateLimiter, (req, res) =>
    downloadController.retryDownload(req, res),
  );
  router.post("/api/offline/queue/retry-frozen", moderateLimiter, (req, res) =>
    downloadController.retryFrozenDownloads(req, res),
  );
  router.get("/api/offline/events", relaxedLimiter, (req, res) =>
    downloadController.getDownloadEvents(req, res),
  );

  // Content access routes (moderate/relaxed rate limiting)
  router.get("/api/offline/manga", relaxedLimiter, (req, res) =>
    contentController.getDownloadedManga(req, res),
  );
  router.get("/api/offline/manga/:mangaId", relaxedLimiter, (req, res) =>
    contentController.getMangaMetadata(req, res),
  );
  router.get("/api/offline/manga/:mangaId/chapters", relaxedLimiter, (req, res) =>
    contentController.getDownloadedChapters(req, res),
  );
  router.get("/api/offline/manga/:mangaId/chapters/:chapterId/pages", relaxedLimiter, (req, res) =>
    contentController.getChapterPages(req, res),
  );
  router.get("/api/offline/manga/:mangaId/chapters/:chapterId/status", relaxedLimiter, (req, res) =>
    contentController.getChapterStatus(req, res),
  );
  router.delete("/api/offline/manga/:mangaId/chapters/:chapterId", moderateLimiter, (req, res) =>
    contentController.deleteChapter(req, res),
  );
  router.delete("/api/offline/manga/:mangaId", moderateLimiter, (req, res) =>
    contentController.deleteManga(req, res),
  );
  router.patch("/api/offline/metadata/:extensionId/:mangaId", moderateLimiter, (req, res) =>
    contentController.updateMetadata(req, res),
  );
  router.post("/api/offline/manga/:mangaId/validate", relaxedLimiter, (req, res) =>
    contentController.validateManga(req, res),
  );
  router.get("/api/offline/page/:mangaId/:chapterId/:filename", relaxedLimiter, (req, res) =>
    contentController.getPageImage(req, res),
  );

  // Storage management routes (moderate/relaxed rate limiting)
  router.get("/api/offline/storage", relaxedLimiter, (req, res) =>
    storageController.getStorageStats(req, res),
  );
  router.get("/api/offline/metrics", relaxedLimiter, (req, res) =>
    storageController.getMetrics(req, res),
  );
  router.get("/api/offline/settings", relaxedLimiter, (req, res) =>
    storageController.getSettings(req, res),
  );
  router.put("/api/offline/settings", moderateLimiter, (req, res) =>
    storageController.updateSettings(req, res),
  );
  router.post("/api/offline/cleanup", strictLimiter, (req, res) =>
    storageController.performCleanup(req, res),
  );

  // Archive routes (strict/upload rate limiting for expensive operations)
  router.post("/api/offline/archive", strictLimiter, (req, res) =>
    archiveController.createArchive(req, res),
  );
  router.get("/api/offline/archive/download/:filename", strictLimiter, (req, res) =>
    archiveController.downloadArchive(req, res),
  );
  router.post("/api/offline/import/validate", uploadLimiter, upload.single("file"), (req, res) =>
    archiveController.validateArchive(req, res),
  );
  router.post("/api/offline/import", uploadLimiter, upload.single("file"), (req, res) =>
    archiveController.importArchive(req, res),
  );

  // History routes (moderate/relaxed rate limiting)
  router.get("/api/offline/history", relaxedLimiter, (req, res) =>
    historyController.getDownloadHistory(req, res),
  );
  router.delete("/api/offline/history/:historyId", moderateLimiter, (req, res) =>
    historyController.deleteHistoryItem(req, res),
  );
  router.delete("/api/offline/history", moderateLimiter, (req, res) =>
    historyController.clearDownloadHistory(req, res),
  );

  // Scheduler routes (moderate rate limiting)
  router.get("/api/offline/scheduler", relaxedLimiter, (req, res) =>
    schedulerController.getSchedulerSettings(req, res),
  );
  router.put("/api/offline/scheduler", moderateLimiter, (req, res) =>
    schedulerController.updateSchedulerSettings(req, res),
  );

  return router;
}

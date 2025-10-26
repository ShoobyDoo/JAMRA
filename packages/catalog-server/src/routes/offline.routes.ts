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

  // Download management routes
  router.post("/api/offline/download/chapter", (req, res) =>
    downloadController.queueChapterDownload(req, res),
  );
  router.post("/api/offline/download/manga", (req, res) =>
    downloadController.queueMangaDownload(req, res),
  );
  router.get("/api/offline/queue", (req, res) =>
    downloadController.getQueue(req, res),
  );
  router.get("/api/offline/queue/:queueId", (req, res) =>
    downloadController.getQueueItem(req, res),
  );
  router.post("/api/offline/queue/:queueId/cancel", (req, res) =>
    downloadController.cancelDownload(req, res),
  );
  router.post("/api/offline/queue/:queueId/retry", (req, res) =>
    downloadController.retryDownload(req, res),
  );
  router.post("/api/offline/queue/retry-frozen", (req, res) =>
    downloadController.retryFrozenDownloads(req, res),
  );
  router.get("/api/offline/events", (req, res) =>
    downloadController.getDownloadEvents(req, res),
  );

  // Content access routes
  router.get("/api/offline/manga", (req, res) =>
    contentController.getDownloadedManga(req, res),
  );
  router.get("/api/offline/manga/:mangaId", (req, res) =>
    contentController.getMangaMetadata(req, res),
  );
  router.get("/api/offline/manga/:mangaId/chapters", (req, res) =>
    contentController.getDownloadedChapters(req, res),
  );
  router.get("/api/offline/manga/:mangaId/chapters/:chapterId/pages", (req, res) =>
    contentController.getChapterPages(req, res),
  );
  router.get("/api/offline/manga/:mangaId/chapters/:chapterId/status", (req, res) =>
    contentController.getChapterStatus(req, res),
  );
  router.delete("/api/offline/manga/:mangaId/chapters/:chapterId", (req, res) =>
    contentController.deleteChapter(req, res),
  );
  router.delete("/api/offline/manga/:mangaId", (req, res) =>
    contentController.deleteManga(req, res),
  );
  router.patch("/api/offline/metadata/:extensionId/:mangaId", (req, res) =>
    contentController.updateMetadata(req, res),
  );
  router.post("/api/offline/manga/:mangaId/validate", (req, res) =>
    contentController.validateManga(req, res),
  );
  router.get("/api/offline/page/:mangaId/:chapterId/:filename", (req, res) =>
    contentController.getPageImage(req, res),
  );

  // Storage management routes
  router.get("/api/offline/storage", (req, res) =>
    storageController.getStorageStats(req, res),
  );
  router.get("/api/offline/metrics", (req, res) =>
    storageController.getMetrics(req, res),
  );
  router.get("/api/offline/settings", (req, res) =>
    storageController.getSettings(req, res),
  );
  router.put("/api/offline/settings", (req, res) =>
    storageController.updateSettings(req, res),
  );
  router.post("/api/offline/cleanup", (req, res) =>
    storageController.performCleanup(req, res),
  );

  // Archive routes
  router.post("/api/offline/archive", (req, res) =>
    archiveController.createArchive(req, res),
  );
  router.get("/api/offline/archive/download/:filename", (req, res) =>
    archiveController.downloadArchive(req, res),
  );
  router.post("/api/offline/import/validate", upload.single("file"), (req, res) =>
    archiveController.validateArchive(req, res),
  );
  router.post("/api/offline/import", upload.single("file"), (req, res) =>
    archiveController.importArchive(req, res),
  );

  // History routes
  router.get("/api/offline/history", (req, res) =>
    historyController.getDownloadHistory(req, res),
  );
  router.delete("/api/offline/history/:historyId", (req, res) =>
    historyController.deleteHistoryItem(req, res),
  );
  router.delete("/api/offline/history", (req, res) =>
    historyController.clearDownloadHistory(req, res),
  );

  // Scheduler routes
  router.get("/api/offline/scheduler", (req, res) =>
    schedulerController.getSchedulerSettings(req, res),
  );
  router.put("/api/offline/scheduler", (req, res) =>
    schedulerController.updateSchedulerSettings(req, res),
  );

  return router;
}

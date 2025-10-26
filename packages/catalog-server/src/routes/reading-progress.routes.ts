/**
 * Reading Progress Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { ReadingProgressController } from "../controllers/ReadingProgressController.js";
import { moderateLimiter, relaxedLimiter } from "../middleware/rateLimiter.js";

export function createReadingProgressRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new ReadingProgressController(deps);

  router.post("/api/reading-progress", moderateLimiter, (req, res) =>
    controller.saveProgress(req, res),
  );
  router.get("/api/reading-progress/:mangaId/:chapterId", relaxedLimiter, (req, res) =>
    controller.getProgress(req, res),
  );
  router.get("/api/reading-progress", relaxedLimiter, (req, res) =>
    controller.getAllProgress(req, res),
  );
  router.get("/api/reading-progress/enriched", relaxedLimiter, (req, res) =>
    controller.getEnrichedProgress(req, res),
  );

  return router;
}

/**
 * History Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { HistoryController } from "../controllers/HistoryController.js";
import { moderateLimiter, relaxedLimiter } from "../middleware/rateLimiter.js";

export function createHistoryRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new HistoryController(deps);

  router.post("/api/history", moderateLimiter, (req, res) =>
    controller.createHistoryEntry(req, res),
  );
  router.get("/api/history", relaxedLimiter, (req, res) => controller.getHistory(req, res));
  router.get("/api/history/stats", relaxedLimiter, (req, res) =>
    controller.getHistoryStats(req, res),
  );
  router.delete("/api/history/:id", moderateLimiter, (req, res) =>
    controller.deleteHistoryEntry(req, res),
  );
  router.delete("/api/history", moderateLimiter, (req, res) =>
    controller.clearHistory(req, res),
  );

  return router;
}

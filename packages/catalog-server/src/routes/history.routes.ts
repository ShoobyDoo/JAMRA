/**
 * History Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { HistoryController } from "../controllers/HistoryController.js";

export function createHistoryRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new HistoryController(deps);

  router.post("/api/history", (req, res) =>
    controller.createHistoryEntry(req, res),
  );
  router.get("/api/history", (req, res) => controller.getHistory(req, res));
  router.get("/api/history/stats", (req, res) =>
    controller.getHistoryStats(req, res),
  );
  router.delete("/api/history/:id", (req, res) =>
    controller.deleteHistoryEntry(req, res),
  );
  router.delete("/api/history", (req, res) =>
    controller.clearHistory(req, res),
  );

  return router;
}

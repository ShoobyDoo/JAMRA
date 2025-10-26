/**
 * Manga Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { MangaController } from "../controllers/MangaController.js";
import { moderateLimiter, relaxedLimiter } from "../middleware/rateLimiter.js";

export function createMangaRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new MangaController(deps);

  router.get("/api/manga/by-slug/:slug", relaxedLimiter, (req, res) =>
    controller.getMangaBySlug(req, res),
  );
  router.get("/api/manga/:id", relaxedLimiter, (req, res) => controller.getManga(req, res));
  router.post("/api/manga/:id/refresh", moderateLimiter, (req, res) =>
    controller.refreshManga(req, res),
  );
  router.post("/api/manga/:id/covers/report", moderateLimiter, (req, res) =>
    controller.reportCover(req, res),
  );
  router.get("/api/manga/:id/chapters/:chapterId/pages", relaxedLimiter, (req, res) =>
    controller.getChapterPages(req, res),
  );
  router.get("/api/manga/:id/chapters/:chapterId/pages/chunk/:chunk", relaxedLimiter, (req, res) =>
    controller.getChapterPagesChunk(req, res),
  );
  router.delete("/api/manga/:id/chapters", moderateLimiter, (req, res) =>
    controller.deleteChapters(req, res),
  );

  return router;
}

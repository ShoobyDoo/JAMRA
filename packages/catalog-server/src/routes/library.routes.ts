/**
 * Library Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { LibraryController } from "../controllers/LibraryController.js";
import { LibraryTagController } from "../controllers/LibraryTagController.js";
import { moderateLimiter, relaxedLimiter } from "../middleware/rateLimiter.js";

export function createLibraryRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const libraryController = new LibraryController(deps);
  const tagController = new LibraryTagController(deps);

  // Library entries
  router.post("/api/library", moderateLimiter, (req, res) =>
    libraryController.addToLibrary(req, res),
  );
  router.put("/api/library/:mangaId", moderateLimiter, (req, res) =>
    libraryController.updateLibraryEntry(req, res),
  );
  router.delete("/api/library/:mangaId", moderateLimiter, (req, res) =>
    libraryController.removeFromLibrary(req, res),
  );
  router.get("/api/library/:mangaId", relaxedLimiter, (req, res) =>
    libraryController.getLibraryEntry(req, res),
  );
  router.get("/api/library", relaxedLimiter, (req, res) =>
    libraryController.getLibraryEntries(req, res),
  );
  router.get("/api/library-enriched", relaxedLimiter, (req, res) =>
    libraryController.getEnrichedLibraryEntries(req, res),
  );
  router.get("/api/library-stats", relaxedLimiter, (req, res) =>
    libraryController.getLibraryStats(req, res),
  );

  // Library tags
  router.post("/api/library/tags", moderateLimiter, (req, res) =>
    tagController.createLibraryTag(req, res),
  );
  router.delete("/api/library/tags/:tagId", moderateLimiter, (req, res) =>
    tagController.deleteLibraryTag(req, res),
  );
  router.get("/api/library/tags", relaxedLimiter, (req, res) =>
    tagController.getLibraryTags(req, res),
  );

  // Library entry tags
  router.post("/api/library/:mangaId/tags/:tagId", moderateLimiter, (req, res) =>
    tagController.addTagToEntry(req, res),
  );
  router.delete("/api/library/:mangaId/tags/:tagId", moderateLimiter, (req, res) =>
    tagController.removeTagFromEntry(req, res),
  );
  router.get("/api/library/:mangaId/tags", relaxedLimiter, (req, res) =>
    tagController.getTagsForEntry(req, res),
  );

  return router;
}

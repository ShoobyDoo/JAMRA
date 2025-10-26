/**
 * Catalog Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { CatalogController } from "../controllers/CatalogController.js";
import { relaxedLimiter } from "../middleware/rateLimiter.js";

export function createCatalogRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new CatalogController(deps);

  router.get("/api/catalog", relaxedLimiter, (req, res) => controller.getCatalog(req, res));
  router.get("/api/filters", relaxedLimiter, (req, res) => controller.getFilters(req, res));

  return router;
}

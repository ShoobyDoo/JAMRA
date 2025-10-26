/**
 * Catalog Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { CatalogController } from "../controllers/CatalogController.js";

export function createCatalogRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new CatalogController(deps);

  router.get("/api/catalog", (req, res) => controller.getCatalog(req, res));
  router.get("/api/filters", (req, res) => controller.getFilters(req, res));

  return router;
}

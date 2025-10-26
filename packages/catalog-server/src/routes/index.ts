/**
 * Routes Index
 *
 * Main aggregator for all application routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { createHealthRoutes } from "./health.routes.js";
import { createExtensionRoutes } from "./extensions.routes.js";
import { createSystemRoutes } from "./system.routes.js";
import { createCatalogRoutes } from "./catalog.routes.js";
import { createMangaRoutes } from "./manga.routes.js";
import { createReadingProgressRoutes } from "./reading-progress.routes.js";
import { createHistoryRoutes } from "./history.routes.js";
import { createLibraryRoutes } from "./library.routes.js";
import { createOfflineRoutes } from "./offline.routes.js";
import { createDangerRoutes } from "./danger.routes.js";

/**
 * Create all application routes
 */
export function createRoutes(
  deps: ServerDependencies,
  activeExtensionIdRef: { current?: string },
): Router {
  const router = Router();

  // Register all route modules
  router.use(createHealthRoutes(deps));
  router.use(createExtensionRoutes(deps, activeExtensionIdRef));
  router.use(createSystemRoutes(deps));
  router.use(createCatalogRoutes(deps));
  router.use(createMangaRoutes(deps));
  router.use(createReadingProgressRoutes(deps));
  router.use(createHistoryRoutes(deps));
  router.use(createLibraryRoutes(deps));
  router.use(createOfflineRoutes(deps));
  router.use(createDangerRoutes(deps));

  return router;
}

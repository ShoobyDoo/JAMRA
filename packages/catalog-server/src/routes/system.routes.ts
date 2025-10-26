/**
 * System Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { SystemController } from "../controllers/SystemController.js";

export function createSystemRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new SystemController(deps);

  router.get("/api/system/cache-settings", (req, res) =>
    controller.getCacheSettings(req, res),
  );
  router.patch("/api/system/cache-settings", (req, res) =>
    controller.updateCacheSettings(req, res),
  );

  return router;
}

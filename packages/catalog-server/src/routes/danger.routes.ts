/**
 * Danger Routes
 *
 * Dangerous operations (development only)
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { DangerController } from "../controllers/DangerController.js";

export function createDangerRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const controller = new DangerController(deps);

  router.post("/api/danger/nuke-user-data", (req, res) =>
    controller.nukeUserData(req, res),
  );

  return router;
}

/**
 * Health Check Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";

export function createHealthRoutes(deps: ServerDependencies): Router {
  const router = Router();
  const { host, activeExtensionId } = deps;

  router.get("/api/health", (_req, res) => {
    const loaded = host.listLoadedExtensions().map((entry) => entry.id);

    res.json({
      status: "ok",
      extensionId: activeExtensionId ?? null,
      loadedExtensions: loaded,
    });
  });

  return router;
}

/**
 * Extension Routes
 */

import { Router } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { ExtensionController } from "../controllers/ExtensionController.js";

export function createExtensionRoutes(
  deps: ServerDependencies,
  activeExtensionIdRef: { current?: string },
): Router {
  const router = Router();
  const controller = new ExtensionController(deps, activeExtensionIdRef);

  router.get("/api/extensions", (req, res) =>
    controller.listExtensions(req, res),
  );
  router.get("/api/extension-marketplace", (req, res) =>
    controller.getMarketplace(req, res),
  );
  router.post("/api/extensions", (req, res) =>
    controller.installExtension(req, res),
  );
  router.post("/api/extensions/:id/enable", (req, res) =>
    controller.enableExtension(req, res),
  );
  router.post("/api/extensions/:id/disable", (req, res) =>
    controller.disableExtension(req, res),
  );
  router.post("/api/extensions/:id/check-updates", (req, res) =>
    controller.checkUpdates(req, res),
  );
  router.post("/api/extensions/:id/acknowledge-update", (req, res) =>
    controller.acknowledgeUpdate(req, res),
  );
  router.patch("/api/extensions/:id/settings", (req, res) =>
    controller.updateSettings(req, res),
  );
  router.delete("/api/extensions/:id", (req, res) =>
    controller.uninstallExtension(req, res),
  );

  return router;
}

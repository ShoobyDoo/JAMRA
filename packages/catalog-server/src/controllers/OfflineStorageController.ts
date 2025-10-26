/**
 * Offline Storage Controller
 *
 * Handles storage management, settings, and statistics
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import * as path from "node:path";

export class OfflineStorageController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/offline/storage
   * Get storage statistics
   */
  async getStorageStats(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] get storage stats");
      const stats = await this.deps.downloadWorker.getStorageStats();
      res.json({ stats });
    } catch (error) {
      this.handleError(res, error, "Failed to get storage stats");
    }
  }

  /**
   * GET /api/offline/metrics
   * Get performance metrics
   */
  async getMetrics(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] get performance metrics");
      const metrics = await this.deps.downloadWorker.getMetrics();
      res.json({ metrics });
    } catch (error) {
      this.handleError(res, error, "Failed to get performance metrics");
    }
  }

  /**
   * GET /api/offline/settings
   * Get storage settings
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settingsPath = path.join(this.deps.dataRoot, ".settings", "storage.json");

      try {
        const { readFile } = await import("node:fs/promises");
        const settingsData = await readFile(settingsPath, "utf-8");
        const settings = JSON.parse(settingsData);
        res.json(settings);
      } catch (error) {
        // Return defaults if settings file doesn't exist (expected on first run)
        console.log("[OfflineStorageController] Settings file not found, using defaults: %s", error instanceof Error ? error.message : String(error));
        res.json({
          maxStorageGB: 10,
          autoCleanupEnabled: false,
          cleanupStrategy: "oldest",
          cleanupThresholdPercent: 90,
        });
      }
    } catch (error) {
      this.handleError(res, error, "Failed to get storage settings");
    }
  }

  /**
   * PUT /api/offline/settings
   * Update storage settings
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = req.body;

      console.log("[OfflineAPI] update storage settings");

      // Validate settings
      if (typeof settings.maxStorageGB !== "number" || settings.maxStorageGB <= 0) {
        res.status(400).json({ error: "Invalid maxStorageGB" });
        return;
      }

      if (typeof settings.autoCleanupEnabled !== "boolean") {
        res.status(400).json({ error: "Invalid autoCleanupEnabled" });
        return;
      }

      if (!["oldest", "largest", "least-accessed"].includes(settings.cleanupStrategy)) {
        res.status(400).json({ error: "Invalid cleanupStrategy" });
        return;
      }

      if (
        typeof settings.cleanupThresholdPercent !== "number" ||
        settings.cleanupThresholdPercent < 50 ||
        settings.cleanupThresholdPercent > 95
      ) {
        res.status(400).json({ error: "Invalid cleanupThresholdPercent" });
        return;
      }

      // Ensure settings directory exists
      const settingsDir = path.join(this.deps.dataRoot, ".settings");
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(settingsDir, { recursive: true });

      // Write settings to file
      const settingsPath = path.join(settingsDir, "storage.json");
      await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

      console.log("[OfflineAPI] storage settings updated");

      res.json({ success: true, settings });
    } catch (error) {
      this.handleError(res, error, "Failed to update storage settings");
    }
  }

  /**
   * POST /api/offline/cleanup
   * Perform storage cleanup
   */
  async performCleanup(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] manual cleanup triggered");

      // Get storage settings
      const settingsPath = path.join(this.deps.dataRoot, ".settings", "storage.json");
      let settings = {
        maxStorageGB: 10,
        autoCleanupEnabled: false,
        cleanupStrategy: "oldest" as const,
        cleanupThresholdPercent: 90,
      };

      try {
        const { readFile } = await import("node:fs/promises");
        const settingsData = await readFile(settingsPath, "utf-8");
        settings = JSON.parse(settingsData);
      } catch {
        // Use defaults
      }

      // Perform cleanup
      const { performCleanup } = await import("@jamra/offline-storage");
      const targetFreeGB = req.body.targetFreeGB || 1;
      const result = await performCleanup(this.deps.dataRoot, settings, targetFreeGB);

      res.json(result);
    } catch (error) {
      this.handleError(res, error, "Failed to perform cleanup");
    }
  }
}

/**
 * Offline Scheduler Controller
 *
 * Handles download scheduler settings
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import * as path from "node:path";

export class OfflineSchedulerController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/offline/scheduler
   * Get scheduler settings
   */
  async getSchedulerSettings(req: Request, res: Response): Promise<void> {
    try {
      const settingsPath = path.join(this.deps.dataRoot, ".settings", "scheduler.json");

      try {
        const { readFile } = await import("node:fs/promises");
        const settingsData = await readFile(settingsPath, "utf-8");
        const settings = JSON.parse(settingsData);
        res.json(settings);
      } catch (error) {
        // Return defaults if settings file doesn't exist (expected on first run)
        console.log("[OfflineSchedulerController] Settings file not found, using defaults: %s", error instanceof Error ? error.message : String(error));
        res.json({
          enabled: false,
          allowedStartHour: 0,
          allowedEndHour: 23,
          maxBandwidthMBps: 0,
          pauseDuringActiveUse: false,
        });
      }
    } catch (error) {
      this.handleError(res, error, "Failed to get scheduler settings");
    }
  }

  /**
   * PUT /api/offline/scheduler
   * Update scheduler settings
   */
  async updateSchedulerSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = req.body;

      console.log("[OfflineAPI] update scheduler settings");

      // Validate settings
      if (typeof settings.enabled !== "boolean") {
        res.status(400).json({ error: "Invalid enabled" });
        return;
      }

      if (
        typeof settings.allowedStartHour !== "number" ||
        settings.allowedStartHour < 0 ||
        settings.allowedStartHour > 23
      ) {
        res.status(400).json({ error: "Invalid allowedStartHour" });
        return;
      }

      if (
        typeof settings.allowedEndHour !== "number" ||
        settings.allowedEndHour < 0 ||
        settings.allowedEndHour > 23
      ) {
        res.status(400).json({ error: "Invalid allowedEndHour" });
        return;
      }

      if (
        typeof settings.maxBandwidthMBps !== "number" ||
        settings.maxBandwidthMBps < 0
      ) {
        res.status(400).json({ error: "Invalid maxBandwidthMBps" });
        return;
      }

      if (typeof settings.pauseDuringActiveUse !== "boolean") {
        res.status(400).json({ error: "Invalid pauseDuringActiveUse" });
        return;
      }

      // Ensure settings directory exists
      const settingsDir = path.join(this.deps.dataRoot, ".settings");
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(settingsDir, { recursive: true });

      // Write settings to file
      const settingsPath = path.join(settingsDir, "scheduler.json");
      await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

      console.log("[OfflineAPI] scheduler settings updated");

      res.json({ success: true, settings });
    } catch (error) {
      this.handleError(res, error, "Failed to update scheduler settings");
    }
  }
}

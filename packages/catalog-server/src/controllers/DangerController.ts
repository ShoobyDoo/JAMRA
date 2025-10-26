/**
 * Danger Controller
 *
 * Handles dangerous operations that should only be used in development
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { DatabaseUnavailableError } from "../errors/AppError.js";
import { nukeUserData } from "@jamra/catalog-db";

export class DangerController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/danger/nuke-user-data
   * Nuclear option to clear all user data (development only)
   */
  async nukeUserData(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      // Check if we're in development mode
      const isDev = process.env.NODE_ENV !== "production";
      if (!isDev) {
        res.status(403).json({
          error: "This endpoint is only available in development mode",
        });
        return;
      }

      const workerWasRunning = (await this.deps.downloadWorker?.isActive()) ?? false;
      if (workerWasRunning) {
        await this.deps.downloadWorker?.stop();
      }

      await this.deps.downloadWorker?.nukeOfflineData();

      nukeUserData(this.deps.repositories.db);

      if (workerWasRunning) {
        await this.deps.downloadWorker?.start();
      }

      res.json({
        success: true,
        message: "All user data has been deleted",
      });
    } catch (error) {
      this.handleError(res, error, "Failed to nuke user data");
    }
  }
}

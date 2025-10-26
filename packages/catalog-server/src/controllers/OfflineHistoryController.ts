/**
 * Offline History Controller
 *
 * Handles download history tracking
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";

export class OfflineHistoryController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/offline/history
   * Get download history
   */
  async getDownloadHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const limit = req.query.limit
        ? Number.parseInt(req.query.limit as string, 10)
        : undefined;
      console.log("[OfflineAPI] get history, limit: %s", limit !== undefined ? limit : "none");
      const history = await this.deps.downloadWorker.getDownloadHistory(limit);

      res.json({ history });
    } catch (error) {
      this.handleError(res, error, "Failed to get download history");
    }
  }

  /**
   * DELETE /api/offline/history/:historyId
   * Delete a download history item
   */
  async deleteHistoryItem(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const historyId = Number.parseInt(req.params.historyId, 10);
      if (Number.isNaN(historyId)) {
        res.status(400).json({ error: "Invalid history ID" });
        return;
      }

      console.log("[OfflineAPI] delete history item %d", historyId);
      await this.deps.downloadWorker.deleteHistoryItem(historyId);

      res.json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to delete history item");
    }
  }

  /**
   * DELETE /api/offline/history
   * Clear all download history
   */
  async clearDownloadHistory(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] clear history");
      await this.deps.downloadWorker.clearDownloadHistory();

      res.json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to clear download history");
    }
  }
}

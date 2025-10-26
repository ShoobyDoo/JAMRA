/**
 * History Controller
 *
 * Handles reading history tracking
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { validateRequestBody, getQueryParam } from "../utils/request-helpers.js";
import { DatabaseUnavailableError } from "../errors/AppError.js";
import { HistoryEntrySchema } from "../validation/schemas.js";
import { HISTORY_CONFIG } from "../config/index.js";

export class HistoryController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/history
   * Log a history entry
   */
  async createHistoryEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(HistoryEntrySchema, req.body);

      const entry = this.deps.repositories.history.logHistoryEntry({
        mangaId: validated.mangaId,
        chapterId: validated.chapterId,
        actionType: validated.actionType,
        metadata: validated.metadata,
      });

      res.status(201).json({ id: entry.id, success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to log history entry");
    }
  }

  /**
   * GET /api/history
   * Get history with optional filters
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const limitParam = getQueryParam(req, "limit");
      const offsetParam = getQueryParam(req, "offset");
      const mangaId = getQueryParam(req, "mangaId");
      const actionType = getQueryParam(req, "actionType");
      const startDateParam = getQueryParam(req, "startDate");
      const endDateParam = getQueryParam(req, "endDate");

      const limit = limitParam
        ? Number.parseInt(limitParam, 10)
        : HISTORY_CONFIG.DEFAULT_LIMIT;
      const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;
      const startDate = startDateParam
        ? Number.parseInt(startDateParam, 10)
        : undefined;
      const endDate = endDateParam
        ? Number.parseInt(endDateParam, 10)
        : undefined;

      const options = {
        limit: Number.isFinite(limit)
          ? Math.min(Math.max(limit, 1), HISTORY_CONFIG.MAX_LIMIT)
          : HISTORY_CONFIG.DEFAULT_LIMIT,
        offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
        mangaId,
        actionType,
        startDate: Number.isFinite(startDate) ? startDate : undefined,
        endDate: Number.isFinite(endDate) ? endDate : undefined,
      };

      const history = this.deps.repositories.history.getHistory(options);

      res.json(history);
    } catch (error) {
      this.handleError(res, error, "Failed to get history");
    }
  }

  /**
   * GET /api/history/stats
   * Get history statistics
   */
  async getHistoryStats(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const startDateParam = getQueryParam(req, "startDate");
      const endDateParam = getQueryParam(req, "endDate");

      const startDate = startDateParam
        ? Number.parseInt(startDateParam, 10)
        : undefined;
      const endDate = endDateParam
        ? Number.parseInt(endDateParam, 10)
        : undefined;

      const stats = this.deps.repositories.history.getHistoryStats({
        startDate: Number.isFinite(startDate) ? startDate : undefined,
        endDate: Number.isFinite(endDate) ? endDate : undefined,
      });

      res.json(stats);
    } catch (error) {
      this.handleError(res, error, "Failed to get history stats");
    }
  }

  /**
   * DELETE /api/history/:id
   * Delete a specific history entry
   */
  async deleteHistoryEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { id } = req.params;
      const numericId = Number.parseInt(id, 10);

      if (!Number.isFinite(numericId)) {
        res.status(400).json({ error: "Invalid history entry ID" });
        return;
      }

      this.deps.repositories.history.deleteHistoryEntry(numericId);
      res.json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to delete history entry");
    }
  }

  /**
   * DELETE /api/history
   * Clear history (optionally before a timestamp)
   */
  async clearHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const beforeTimestampParam = getQueryParam(req, "beforeTimestamp");
      const beforeTimestamp = beforeTimestampParam
        ? Number.parseInt(beforeTimestampParam, 10)
        : undefined;

      const deletedCount = this.deps.repositories.history.clearHistory(
        Number.isFinite(beforeTimestamp) ? beforeTimestamp : undefined,
      );

      res.json({ success: true, deletedCount });
    } catch (error) {
      this.handleError(res, error, "Failed to clear history");
    }
  }
}

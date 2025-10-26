/**
 * System Controller
 *
 * Handles system-level settings and configuration
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import type { CoverCacheSettings } from "../services/coverCacheManager.js";

export class SystemController {
  constructor(private readonly deps: ServerDependencies) {}

  /**
   * GET /api/system/cache-settings
   * Get cover cache settings
   */
  getCacheSettings(_req: Request, res: Response): void {
    if (!this.deps.coverCacheManager) {
      res.json({
        settings: {
          enabled: false,
          ttlMs: 0,
          maxEntries: 0,
          fetchTimeoutMs: 8000,
        },
      });
      return;
    }

    res.json({ settings: this.deps.coverCacheManager.getSettings() });
  }

  /**
   * PATCH /api/system/cache-settings
   * Update cover cache settings
   */
  updateCacheSettings(req: Request, res: Response): void {
    if (!this.deps.repositories || !this.deps.coverCacheManager) {
      res
        .status(503)
        .json({ error: "Persistent storage is required for cache settings" });
      return;
    }

    const updates: Partial<CoverCacheSettings> = {};
    const body = req.body ?? {};

    if (typeof body.enabled === "boolean") {
      updates.enabled = body.enabled;
    }

    if (body.ttlMs !== undefined) {
      const ttlMs = Number(body.ttlMs);
      if (!Number.isFinite(ttlMs) || ttlMs < 0) {
        res.status(400).json({ error: "ttlMs must be a non-negative number" });
        return;
      }
      updates.ttlMs = ttlMs;
    } else if (body.ttlDays !== undefined) {
      const ttlDays = Number(body.ttlDays);
      if (!Number.isFinite(ttlDays) || ttlDays < 0) {
        res
          .status(400)
          .json({ error: "ttlDays must be a non-negative number" });
        return;
      }
      updates.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    }

    if (body.maxEntries !== undefined) {
      const maxEntries = Number(body.maxEntries);
      if (!Number.isInteger(maxEntries) || maxEntries < 0) {
        res
          .status(400)
          .json({ error: "maxEntries must be a non-negative integer" });
        return;
      }
      updates.maxEntries = maxEntries;
    }

    if (body.fetchTimeoutMs !== undefined) {
      const timeoutMs = Number(body.fetchTimeoutMs);
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        res.status(400).json({
          error: "fetchTimeoutMs must be a non-negative number",
        });
        return;
      }
      updates.fetchTimeoutMs = timeoutMs;
    }

    this.deps.coverCacheManager.updateSettings(updates);
    this.deps.repositories.settings.setAppSetting(
      "coverCacheSettings",
      this.deps.coverCacheManager.getSettings(),
    );

    res.json({ settings: this.deps.coverCacheManager.getSettings() });
  }
}

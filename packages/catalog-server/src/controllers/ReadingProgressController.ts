/**
 * Reading Progress Controller
 *
 * Handles reading progress tracking
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import type { MangaDetails } from "@jamra/extension-sdk";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { validateRequestBody, getQueryParam, resolveExtensionId } from "../utils/request-helpers.js";
import { DatabaseUnavailableError } from "../errors/AppError.js";
import { ReadingProgressSchema } from "../validation/schemas.js";
import { CACHE_CONFIG } from "../config/index.js";

export class ReadingProgressController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/reading-progress
   * Save reading progress
   */
  async saveProgress(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(ReadingProgressSchema, req.body);

      this.deps.repositories.readingProgress.saveReadingProgress(
        validated.mangaId,
        validated.chapterId,
        validated.currentPage,
        validated.totalPages,
        validated.scrollPosition ?? 0,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to save reading progress");
    }
  }

  /**
   * GET /api/reading-progress/:mangaId/:chapterId
   * Get reading progress for specific manga/chapter
   */
  async getProgress(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId, chapterId } = req.params;

      if (!mangaId || !chapterId) {
        res.status(400).json({ error: "Missing manga ID or chapter ID" });
        return;
      }

      const progress = this.deps.repositories.readingProgress.getReadingProgress(
        decodeURIComponent(mangaId),
        decodeURIComponent(chapterId),
      );

      if (!progress) {
        res.status(404).json({ error: "No progress found" });
        return;
      }

      res.json(progress);
    } catch (error) {
      this.handleError(res, error, "Failed to get reading progress");
    }
  }

  /**
   * GET /api/reading-progress
   * Get all reading progress
   */
  async getAllProgress(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const allProgress = this.deps.repositories.readingProgress.getAllReadingProgress();
      res.json(allProgress);
    } catch (error) {
      this.handleError(res, error, "Failed to get all reading progress");
    }
  }

  /**
   * GET /api/reading-progress/enriched
   * Get enriched reading progress with manga details
   */
  async getEnrichedProgress(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      if (!this.deps.catalogService) {
        res.status(503).json({ error: "Catalog service not available" });
        return;
      }

      const limitParam = getQueryParam(req, "limit");
      const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.max(parsedLimit, 1), CACHE_CONFIG.MAX_LIMIT)
          : CACHE_CONFIG.DEFAULT_LIMIT;

      const progressEntries = this.deps.repositories.readingProgress.getLatestReadingProgressPerManga();
      const window = progressEntries.slice(0, limit);
      const defaultExtensionId = resolveExtensionId(req, this.deps.activeExtensionId);
      const uniqueMangaIds = Array.from(
        new Set(window.map((entry) => entry.mangaId)),
      );

      type EnrichedRecord = {
        manga: MangaDetails | null;
        error: string | null;
        extensionId?: string;
      };

      const enrichedMap = new Map<string, EnrichedRecord>();

      await Promise.all(
        uniqueMangaIds.map(async (mangaId) => {
          let cached = this.deps.repositories!.manga.getMangaWithDetails(mangaId);
          const extensionId = cached?.extensionId ?? defaultExtensionId;

          const result: EnrichedRecord = {
            manga: null,
            error: null,
            extensionId,
          };

          const commitResult = () => {
            enrichedMap.set(mangaId, result);
          };

          if (cached?.details) {
            result.manga = {
              ...cached.details,
              chapters: cached.details.chapters ?? cached.chapters,
            };
            commitResult();
            return;
          }

          if (!extensionId) {
            result.error =
              "Extension not available for this manga. Enable the source to continue.";
            commitResult();
            return;
          }

          if (!this.deps.host.isLoaded(extensionId)) {
            result.error = `Extension ${extensionId} is not enabled.`;
            commitResult();
            return;
          }

          try {
            const requiresChapterRefresh = !(cached?.chapters?.length ?? 0);
            await this.deps.catalogService!.syncManga(extensionId, mangaId, {
              forceChapterRefresh: requiresChapterRefresh,
            });
            cached = this.deps.repositories!.manga.getMangaWithDetails(mangaId);
            if (cached?.details) {
              result.manga = {
                ...cached.details,
                chapters: cached.details.chapters ?? cached.chapters,
              };
            } else {
              result.error = "Manga details not available after sync.";
            }
          } catch (error) {
            console.error(
              `Failed to hydrate manga ${mangaId} for reading progress`,
              error,
            );
            result.error =
              error instanceof Error ? error.message : String(error);
          }

          commitResult();
        }),
      );

      const enriched = window.map((entry) => {
        const record = enrichedMap.get(entry.mangaId);
        return {
          ...entry,
          manga: record?.manga ?? null,
          error: record?.error ?? null,
          extensionId: record?.extensionId,
        };
      });

      res.json(enriched);
    } catch (error) {
      this.handleError(res, error, "Failed to get enriched reading progress");
    }
  }
}

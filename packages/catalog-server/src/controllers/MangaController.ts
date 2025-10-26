/**
 * Manga Controller
 *
 * Handles manga details, chapters, and cover management
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { ensureExtensionLoaded, validateRequestBody } from "../utils/request-helpers.js";
import { DatabaseUnavailableError } from "../errors/AppError.js";
import { CoverReportSchema } from "../validation/schemas.js";

export class MangaController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/manga/by-slug/:slug
   * Get manga details by slug
   */
  async getMangaBySlug(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    try {
      const includeChapters = req.query.includeChapters !== "false";
      const result = await this.deps.catalogService.syncMangaBySlug(
        extensionId,
        req.params.slug,
        { includeChapters },
      );
      await this.deps.enrichMangaDetails(extensionId, result.details);
      res.json({
        details: result.details,
        chaptersFetched: result.chaptersFetched,
        extensionId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to fetch manga details by slug");
    }
  }

  /**
   * GET /api/manga/:id
   * Get manga details by ID or slug
   */
  async getManga(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    try {
      const includeChapters = req.query.includeChapters !== "false";
      const identifier = req.params.id;
      const slugPattern = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
      const useSlug = slugPattern.test(identifier);

      const result = useSlug
        ? await this.deps.catalogService.syncMangaBySlug(extensionId, identifier, {
            includeChapters,
          })
        : await this.deps.catalogService.syncManga(extensionId, identifier, {
            includeChapters,
          });
      await this.deps.enrichMangaDetails(extensionId, result.details);
      res.json({
        details: result.details,
        chaptersFetched: result.chaptersFetched,
        extensionId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to fetch manga details");
    }
  }

  /**
   * POST /api/manga/:id/refresh
   * Refresh cached manga data
   */
  async refreshManga(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    try {
      const identifier = req.params.id;
      const slugPattern = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
      const useSlug = slugPattern.test(identifier);

      // Force refresh by re-fetching from extension
      const result = useSlug
        ? await this.deps.catalogService.syncMangaBySlug(extensionId, identifier, {
            includeChapters: true,
          })
        : await this.deps.catalogService.syncManga(extensionId, identifier, {
            includeChapters: true,
          });

      const details = result.details;
      await this.deps.enrichMangaDetails(extensionId, details);

      res.json({
        details,
        refreshed: true,
        extensionId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to refresh manga cache");
    }
  }

  /**
   * POST /api/manga/:id/covers/report
   * Report cover load success/failure for URL reordering
   */
  async reportCover(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    const mangaId = req.params.id;

    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(CoverReportSchema, req.body);
      const rawUrl = validated.url;
      const status = validated.status;
      const attempted = validated.attemptedUrls ?? [];

      if (status === "success") {
        this.deps.coverUrlService.reportSuccess(extensionId, mangaId, rawUrl, attempted);

        if (this.deps.coverCacheManager) {
          const merged =
            this.deps.coverUrlService.getStoredOrder(extensionId, mangaId) ?? [];
          void this.deps.coverCacheManager
            .ensureCachedCover(extensionId, mangaId, merged, {
              urls: merged,
            })
            .catch((error) => {
              console.warn(
                `Failed to refresh cover cache after success report for ${mangaId}`,
                error,
              );
            });
        }
      } else {
        this.deps.coverUrlService.reportFailure(extensionId, mangaId, rawUrl, attempted);
      }

      res.status(204).end();
    } catch (error) {
      this.handleError(res, error, "Failed to record cover report");
    }
  }

  /**
   * GET /api/manga/:id/chapters/:chapterId/pages
   * Get pages for a chapter
   */
  async getChapterPages(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    try {
      const result = await this.deps.catalogService.syncChapterPages(
        extensionId,
        req.params.id,
        req.params.chapterId,
      );
      res.json({ ...result, extensionId });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to fetch chapter pages");
    }
  }

  /**
   * GET /api/manga/:id/chapters/:chapterId/pages/chunk/:chunk
   * Get paginated chunk of chapter pages
   */
  async getChapterPagesChunk(req: Request, res: Response): Promise<void> {
    const extensionId = ensureExtensionLoaded(
      req,
      res,
      this.deps.host,
      this.deps.activeExtensionId,
    );
    if (!extensionId) return;

    if (!this.deps.catalogService) {
      res.status(503).json({ error: "Catalog service not available" });
      return;
    }

    const chunkIndex = Number.parseInt(req.params.chunk, 10);
    const chunkSize = Number.parseInt(req.query.size as string, 10) || 10;

    if (Number.isNaN(chunkIndex) || chunkIndex < 0) {
      res.status(400).json({ error: "Invalid chunk index" });
      return;
    }

    try {
      const result = await this.deps.catalogService.fetchChapterPagesChunk(
        extensionId,
        req.params.id,
        req.params.chapterId,
        chunkIndex,
        chunkSize,
      );
      res.json({ ...result, extensionId });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("could not be resolved")
      ) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to fetch chapter pages chunk");
    }
  }

  /**
   * DELETE /api/manga/:id/chapters
   * Clear chapter cache for a manga
   */
  async deleteChapters(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { id: mangaId } = req.params;
      this.deps.repositories.chapters.deleteChaptersForManga(mangaId);
      res.json({
        success: true,
        message: `Chapters cleared for manga ${mangaId}`,
      });
    } catch (error) {
      this.handleError(res, error, "Failed to clear chapters");
    }
  }
}

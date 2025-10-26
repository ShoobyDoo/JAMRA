/**
 * Offline Content Controller
 *
 * Handles access to offline manga content and metadata
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { getQueryParam } from "../utils/request-helpers.js";

export class OfflineContentController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * GET /api/offline/manga
   * Get all downloaded manga
   */
  async getDownloadedManga(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      console.log("[OfflineAPI] list downloaded manga");
      const manga = await this.deps.downloadWorker.getDownloadedManga();
      res.json({ manga });
    } catch (error) {
      this.handleError(res, error, "Failed to get downloaded manga");
    }
  }

  /**
   * GET /api/offline/manga/:mangaId
   * Get downloaded manga metadata by ID
   */
  async getMangaMetadata(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      console.log("[OfflineAPI] get offline metadata", {
        extensionId,
        mangaId: req.params.mangaId,
      });
      const metadata = await this.deps.downloadWorker.getMangaMetadata(
        extensionId,
        req.params.mangaId,
      );

      if (!metadata) {
        res.status(404).json({ error: "Manga not found in offline storage" });
        return;
      }

      res.json({ manga: metadata });
    } catch (error) {
      this.handleError(res, error, "Failed to get manga metadata");
    }
  }

  /**
   * GET /api/offline/manga/:mangaId/chapters
   * Get downloaded chapters for a manga
   */
  async getDownloadedChapters(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      console.log("[OfflineAPI] list offline chapters", {
        extensionId,
        mangaId: req.params.mangaId,
      });
      const chapters = await this.deps.downloadWorker.getDownloadedChapters(
        extensionId,
        req.params.mangaId,
      );

      res.json({ chapters });
    } catch (error) {
      this.handleError(res, error, "Failed to get downloaded chapters");
    }
  }

  /**
   * GET /api/offline/manga/:mangaId/chapters/:chapterId/pages
   * Get chapter pages metadata
   */
  async getChapterPages(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      const pages = await this.deps.downloadWorker.getChapterPages(
        extensionId,
        req.params.mangaId,
        req.params.chapterId,
      );

      if (!pages) {
        res
          .status(404)
          .json({ error: "Chapter not found in offline storage" });
        return;
      }

      res.json({ pages });
    } catch (error) {
      this.handleError(res, error, "Failed to get chapter pages");
    }
  }

  /**
   * GET /api/offline/manga/:mangaId/chapters/:chapterId/status
   * Check if a chapter is downloaded
   */
  async getChapterStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      console.log("[OfflineAPI] check chapter status", {
        extensionId,
        mangaId: req.params.mangaId,
        chapterId: req.params.chapterId,
      });
      const isDownloaded = await this.deps.downloadWorker.isChapterDownloaded(
        extensionId,
        req.params.mangaId,
        req.params.chapterId,
      );

      res.json({ isDownloaded });
    } catch (error) {
      this.handleError(res, error, "Failed to check chapter download status");
    }
  }

  /**
   * DELETE /api/offline/manga/:mangaId/chapters/:chapterId
   * Delete a downloaded chapter
   */
  async deleteChapter(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      console.log("[OfflineAPI] delete chapter", {
        extensionId,
        mangaId: req.params.mangaId,
        chapterId: req.params.chapterId,
      });
      await this.deps.downloadWorker.deleteChapter(
        extensionId,
        req.params.mangaId,
        req.params.chapterId,
      );

      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to delete chapter");
    }
  }

  /**
   * DELETE /api/offline/manga/:mangaId
   * Delete an entire manga
   */
  async deleteManga(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      console.log("[OfflineAPI] delete manga", {
        extensionId,
        mangaId: req.params.mangaId,
      });
      await this.deps.downloadWorker.deleteManga(extensionId, req.params.mangaId);

      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      this.handleError(res, error, "Failed to delete manga");
    }
  }

  /**
   * PATCH /api/offline/metadata/:extensionId/:mangaId
   * Update manga metadata
   */
  async updateMetadata(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { extensionId, mangaId } = req.params;
      const updates = req.body;

      console.log("[OfflineAPI] update metadata", { extensionId, mangaId, updates });

      // Validate that we have at least one field to update
      const allowedFields = ["title", "description", "authors", "artists"];
      const hasValidUpdates = Object.keys(updates).some(key => allowedFields.includes(key));

      if (!hasValidUpdates) {
        res.status(400).json({
          error: "No valid metadata fields provided",
          allowedFields
        });
        return;
      }

      // Get existing metadata
      const existingMetadata = await this.deps.downloadWorker.getMangaMetadata(extensionId, mangaId);

      if (!existingMetadata) {
        res.status(404).json({ error: "Manga not found in offline storage" });
        return;
      }

      // Build path to metadata file
      const path = await import("node:path");
      const metadataPath = path.default.join(this.deps.dataRoot, extensionId, mangaId, "metadata.json");

      // Update metadata with new values (only update provided fields)
      const updatedMetadata = {
        ...existingMetadata,
        title: updates.title !== undefined ? updates.title : existingMetadata.title,
        description: updates.description !== undefined ? updates.description : existingMetadata.description,
        authors: updates.authors !== undefined ? updates.authors : existingMetadata.authors,
        artists: updates.artists !== undefined ? updates.artists : existingMetadata.artists,
      };

      // Write updated metadata to file
      const { writeFile } = await import("node:fs/promises");
      await writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2), "utf-8");

      console.log("[OfflineAPI] metadata updated successfully");

      res.json({
        success: true,
        metadata: updatedMetadata
      });
    } catch (error) {
      this.handleError(res, error, "Failed to update metadata");
    }
  }

  /**
   * POST /api/offline/manga/:mangaId/validate
   * Validate manga metadata chapter count
   */
  async validateManga(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const extensionId = getQueryParam(req, "extensionId");
      if (!extensionId) {
        res
          .status(400)
          .json({ error: "extensionId query parameter is required" });
        return;
      }

      console.log("[OfflineAPI] validate manga", {
        extensionId,
        mangaId: req.params.mangaId,
      });
      const result = await this.deps.downloadWorker.validateMangaChapterCount(
        extensionId,
        req.params.mangaId,
      );

      res.json(result);
    } catch (error) {
      this.handleError(res, error, "Failed to validate manga metadata");
    }
  }

  /**
   * GET /api/offline/page/:mangaId/:chapterId/:filename
   * Serve offline page images
   */
  async getPageImage(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { mangaId, chapterId, filename } = req.params;
      console.log("[OfflineAPI] get page path", {
        mangaId,
        chapterId,
        filename,
      });
      const pagePath = await this.deps.downloadWorker.getPagePath(
        mangaId,
        chapterId,
        filename,
      );

      if (!pagePath) {
        res.status(404).json({ error: "Page not found in offline storage" });
        return;
      }

      // Send the image file
      res.sendFile(pagePath);
    } catch (error) {
      this.handleError(res, error, "Failed to get page image");
    }
  }
}

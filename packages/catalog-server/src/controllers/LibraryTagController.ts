/**
 * Library Tag Controller
 *
 * Handles library tag management and tag assignments
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { DatabaseUnavailableError } from "../errors/AppError.js";

export class LibraryTagController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/library/tags
   * Create a new library tag
   */
  async createLibraryTag(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { name, color } = req.body;
      if (!name) {
        res.status(400).json({ error: "Missing required field: name" });
        return;
      }

      const tag = this.deps.repositories.library.createLibraryTag(name, color);
      res.status(201).json(tag);
    } catch (error) {
      this.handleError(res, error, "Failed to create library tag");
    }
  }

  /**
   * DELETE /api/library/tags/:tagId
   * Delete a library tag
   */
  async deleteLibraryTag(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { tagId } = req.params;
      if (!tagId) {
        res.status(400).json({ error: "Missing tag ID" });
        return;
      }

      const parsedTagId = Number.parseInt(tagId, 10);
      if (Number.isNaN(parsedTagId)) {
        res.status(400).json({ error: "Invalid tag ID" });
        return;
      }

      this.deps.repositories.library.deleteLibraryTag(parsedTagId);
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to delete library tag");
    }
  }

  /**
   * GET /api/library/tags
   * Get all library tags
   */
  async getLibraryTags(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const tags = this.deps.repositories.library.getLibraryTags();
      res.json(tags);
    } catch (error) {
      this.handleError(res, error, "Failed to get library tags");
    }
  }

  /**
   * POST /api/library/:mangaId/tags/:tagId
   * Add a tag to a library entry
   */
  async addTagToEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId, tagId } = req.params;
      if (!mangaId || !tagId) {
        res.status(400).json({ error: "Missing manga ID or tag ID" });
        return;
      }

      const parsedTagId = Number.parseInt(tagId, 10);
      if (Number.isNaN(parsedTagId)) {
        res.status(400).json({ error: "Invalid tag ID" });
        return;
      }

      this.deps.repositories.library.addTagToLibraryEntry(decodeURIComponent(mangaId), parsedTagId);
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to add tag to library entry");
    }
  }

  /**
   * DELETE /api/library/:mangaId/tags/:tagId
   * Remove a tag from a library entry
   */
  async removeTagFromEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId, tagId } = req.params;
      if (!mangaId || !tagId) {
        res.status(400).json({ error: "Missing manga ID or tag ID" });
        return;
      }

      const parsedTagId = Number.parseInt(tagId, 10);
      if (Number.isNaN(parsedTagId)) {
        res.status(400).json({ error: "Invalid tag ID" });
        return;
      }

      this.deps.repositories.library.removeTagFromLibraryEntry(
        decodeURIComponent(mangaId),
        parsedTagId,
      );
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to remove tag from library entry");
    }
  }

  /**
   * GET /api/library/:mangaId/tags
   * Get tags for a library entry
   */
  async getTagsForEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        res.status(400).json({ error: "Missing manga ID" });
        return;
      }

      const tags = this.deps.repositories.library.getTagsForLibraryEntry(
        decodeURIComponent(mangaId),
      );
      res.json(tags);
    } catch (error) {
      this.handleError(res, error, "Failed to get tags for library entry");
    }
  }
}

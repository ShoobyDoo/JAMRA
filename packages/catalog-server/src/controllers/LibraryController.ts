/**
 * Library Controller
 *
 * Handles library entry management
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import type { LibraryStatus } from "@jamra/catalog-db";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { validateRequestBody, getQueryParam } from "../utils/request-helpers.js";
import { DatabaseUnavailableError, InvalidRequestError } from "../errors/AppError.js";
import { AddToLibrarySchema, UpdateLibraryEntrySchema } from "../validation/schemas.js";

export class LibraryController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/library
   * Add manga to library
   */
  async addToLibrary(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const validated = validateRequestBody(AddToLibrarySchema, req.body);

      const entry = this.deps.repositories.library.addToLibrary(
        validated.mangaId,
        validated.extensionId,
        validated.status,
        {
          personalRating: validated.personalRating,
          favorite: validated.favorite,
          notes: validated.notes,
          startedAt: validated.startedAt,
          completedAt: validated.completedAt,
        },
      );

      res.status(201).json(entry);
    } catch (error) {
      this.handleError(res, error, "Failed to add to library");
    }
  }

  /**
   * PUT /api/library/:mangaId
   * Update library entry
   */
  async updateLibraryEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        throw new InvalidRequestError("Missing manga ID");
      }

      const validated = validateRequestBody(UpdateLibraryEntrySchema, req.body);

      this.deps.repositories.library.updateLibraryEntry(decodeURIComponent(mangaId), {
        status: validated.status,
        personalRating: validated.personalRating,
        favorite: validated.favorite,
        notes: validated.notes,
        startedAt: validated.startedAt,
        completedAt: validated.completedAt,
      });

      const updated = this.deps.repositories.library.getLibraryEntry(decodeURIComponent(mangaId));
      if (!updated) {
        res.status(404).json({ error: "Library entry not found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      this.handleError(res, error, "Failed to update library entry");
    }
  }

  /**
   * DELETE /api/library/:mangaId
   * Remove manga from library
   */
  async removeFromLibrary(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        res.status(400).json({ error: "Missing manga ID" });
        return;
      }

      this.deps.repositories.library.removeFromLibrary(decodeURIComponent(mangaId));
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Failed to remove from library");
    }
  }

  /**
   * GET /api/library/:mangaId
   * Get library entry for a manga
   */
  async getLibraryEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const { mangaId } = req.params;
      if (!mangaId) {
        res.status(400).json({ error: "Missing manga ID" });
        return;
      }

      const entry = this.deps.repositories.library.getLibraryEntry(decodeURIComponent(mangaId));
      if (!entry) {
        res.status(404).json({ error: "Library entry not found" });
        return;
      }

      res.json(entry);
    } catch (error) {
      this.handleError(res, error, "Failed to get library entry");
    }
  }

  /**
   * GET /api/library
   * Get all library entries with optional filters
   */
  async getLibraryEntries(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const statusParam = getQueryParam(req, "status");
      const validStatuses: LibraryStatus[] = [
        "reading",
        "plan_to_read",
        "completed",
        "on_hold",
        "dropped",
      ];
      const status = statusParam && validStatuses.includes(statusParam as LibraryStatus)
        ? (statusParam as LibraryStatus)
        : undefined;
      const favoriteParam = getQueryParam(req, "favorite");
      const favorite =
        favoriteParam === "true"
          ? true
          : favoriteParam === "false"
            ? false
            : undefined;

      const entries = this.deps.repositories.library.getLibraryEntries({ status, favorite });
      res.json(entries);
    } catch (error) {
      this.handleError(res, error, "Failed to get library entries");
    }
  }

  /**
   * GET /api/library-enriched
   * Get enriched library entries with manga details
   */
  async getEnrichedLibraryEntries(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const statusParam = getQueryParam(req, "status");
      const validStatuses: LibraryStatus[] = [
        "reading",
        "plan_to_read",
        "completed",
        "on_hold",
        "dropped",
      ];
      const status = statusParam && validStatuses.includes(statusParam as LibraryStatus)
        ? (statusParam as LibraryStatus)
        : undefined;
      const favoriteParam = getQueryParam(req, "favorite");
      const favorite =
        favoriteParam === "true"
          ? true
          : favoriteParam === "false"
            ? false
            : undefined;

      const entries = this.deps.repositories.library.getEnrichedLibraryEntries({
        status,
        favorite,
      });
      res.json(entries);
    } catch (error) {
      this.handleError(res, error, "Failed to get enriched library entries");
    }
  }

  /**
   * GET /api/library-stats
   * Get library statistics
   */
  async getLibraryStats(_req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.repositories) {
        throw new DatabaseUnavailableError();
      }

      const stats = this.deps.repositories.library.getLibraryStats();
      res.json(stats);
    } catch (error) {
      this.handleError(res, error, "Failed to get library stats");
    }
  }
}

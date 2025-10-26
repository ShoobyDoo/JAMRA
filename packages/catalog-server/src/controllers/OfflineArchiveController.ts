/**
 * Offline Archive Controller
 *
 * Handles archive creation, download, import, and validation
 */

import type { Request, Response } from "express";
import type { ServerDependencies } from "../types/server-dependencies.js";
import { handleError as handleAppError } from "../middleware/errorHandler.js";
import { access, constants as fsConstants, unlink } from "node:fs/promises";
import * as path from "node:path";
import { archiveManga } from "@jamra/offline-storage";

export class OfflineArchiveController {
  constructor(private readonly deps: ServerDependencies) {}

  private handleError(res: Response, error: unknown, message: string): void {
    handleAppError(res, error, message);
  }

  /**
   * POST /api/offline/archive
   * Archive manga to ZIP
   */
  async createArchive(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const { items, options } = req.body as {
        items: Array<{
          extensionId: string;
          mangaId: string;
          chapterIds?: string[];
        }>;
        options?: {
          includeMetadata?: boolean;
          includeCover?: boolean;
          compressionLevel?: number;
        };
      };

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "items array is required" });
        return;
      }

      console.log("[OfflineAPI] archive manga", { itemCount: items.length });

      // Create archives directory if it doesn't exist
      const archivesDir = path.join(this.deps.dataRoot, ".archives");
      await import("node:fs/promises").then((fs) =>
        fs.mkdir(archivesDir, { recursive: true }),
      );

      // Generate unique archive name
      const timestamp = Date.now();
      const archiveName =
        items.length === 1
          ? `${items[0].mangaId}-${timestamp}.zip`
          : `bulk-archive-${timestamp}.zip`;
      const outputPath = path.join(archivesDir, archiveName);

      // For now, archive only the first manga (single manga archive)
      if (items.length > 1) {
        res.status(400).json({
          error: "Bulk archiving not yet implemented",
          success: false,
        });
        return;
      }

      const item = items[0];

      // Get manga metadata
      const metadata = await this.deps.downloadWorker.getMangaMetadata(
        item.extensionId,
        item.mangaId,
      );

      if (!metadata) {
        res.status(404).json({
          error: "Manga not found in offline storage",
          success: false,
        });
        return;
      }

      // Filter chapters if specific chapters requested
      let filteredMetadata = metadata;
      if (item.chapterIds && item.chapterIds.length > 0) {
        filteredMetadata = {
          ...metadata,
          chapters: metadata.chapters.filter((ch) =>
            item.chapterIds!.includes(ch.chapterId),
          ),
        };
      }

      // Create archive
      const result = await archiveManga(
        this.deps.dataRoot,
        item.extensionId,
        filteredMetadata,
        outputPath,
        {
          includeMetadata: options?.includeMetadata !== false,
          includeCover: options?.includeCover !== false,
          compressionLevel: options?.compressionLevel || 6,
        },
      );

      if (!result.success) {
        res.status(500).json({
          error: result.error || "Failed to create archive",
          success: false,
        });
        return;
      }

      // Return download URL
      const downloadUrl = `/api/offline/archive/download/${archiveName}`;

      res.json({
        success: true,
        downloadUrl,
        sizeBytes: result.sizeBytes,
      });
    } catch (error) {
      this.handleError(res, error, "Failed to create archive");
    }
  }

  /**
   * GET /api/offline/archive/download/:filename
   * Download archived file
   */
  async downloadArchive(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;

      // Validate filename (prevent directory traversal)
      if (filename.includes("..") || filename.includes("/")) {
        res.status(400).json({ error: "Invalid filename" });
        return;
      }

      const archivePath = path.join(
        this.deps.dataRoot,
        ".archives",
        filename,
      );

      // Check if file exists
      try {
        await access(archivePath, fsConstants.R_OK);
      } catch {
        res.status(404).json({ error: "Archive not found" });
        return;
      }

      console.log("[OfflineAPI] download archive", { filename });

      // Set headers for download
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Send file
      res.sendFile(archivePath);
    } catch (error) {
      this.handleError(res, error, "Failed to download archive");
    }
  }

  /**
   * POST /api/offline/import/validate
   * Validate archive before import
   */
  async validateArchive(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      console.log("[OfflineAPI] validate import archive", {
        filename: req.file.originalname,
        size: req.file.size,
      });

      const { validateArchive } = await import("@jamra/offline-storage");
      const validation = await validateArchive(req.file.path);

      // Clean up uploaded file
      await unlink(req.file.path);

      res.json(validation);
    } catch (error) {
      this.handleError(res, error, "Failed to validate archive");
    }
  }

  /**
   * POST /api/offline/import
   * Import archive
   */
  async importArchive(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      if (!this.deps.downloadWorker) {
        res.status(503).json({ error: "Offline storage not available" });
        return;
      }

      const conflictResolution = (req.body.conflictResolution || "skip") as "skip" | "overwrite" | "rename";

      console.log("[OfflineAPI] import archive", {
        filename: req.file.originalname,
        size: req.file.size,
        conflictResolution,
      });

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendProgress = (current: number, total: number, message?: string) => {
        const progress = total > 0 ? Math.floor((current / total) * 100) : current;
        res.write(`data: ${JSON.stringify({ type: "progress", progress, message })}\n\n`);
      };

      try {
        const { importMangaArchive } = await import("@jamra/offline-storage");

        const result = await importMangaArchive(
          this.deps.dataRoot,
          req.file.path,
          {
            conflictResolution,
            validate: true,
            onProgress: sendProgress,
          },
        );

        if (result.success) {
          res.write(`data: ${JSON.stringify({ type: "complete", result })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ type: "error", error: result.error })}\n\n`);
        }

        res.end();

        // Clean up uploaded file
        await unlink(req.file.path);

        // Reload offline manga list in background
        if (result.success && !result.skipped) {
          console.log("[OfflineAPI] Import successful, reloading manga list");
        }
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Import failed"
        })}\n\n`);
        res.end();

        // Clean up uploaded file
        await unlink(req.file.path);
      }
    } catch (error) {
      this.handleError(res, error, "Failed to import archive");
    }
  }
}

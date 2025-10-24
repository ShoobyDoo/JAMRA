/**
 * Import utility for extracting and importing manga from ZIP archives
 *
 * This module provides functionality to:
 * - Import individual chapters from ZIP files
 * - Import entire manga (all chapters) from ZIP files
 * - Validate archive structure before importing
 * - Handle conflicts (skip, overwrite, or keep both)
 * - Track import progress
 */

import * as fs from "node:fs";
import * as path from "node:path";
import extract from "extract-zip";
import type { OfflineMangaMetadata, OfflineChapterMetadata } from "./types";
import { buildMangaPaths, buildChapterPaths } from "./utils/paths.js";
import { readJSON, fileExists, writeJSON } from "./utils/file-system.js";

export type ConflictResolution = "skip" | "overwrite" | "rename";

export interface ImportOptions {
  /** How to handle conflicts when manga/chapter already exists */
  conflictResolution?: ConflictResolution;
  /** Validate archive structure before importing */
  validate?: boolean;
  /** Progress callback (current, total, message) */
  onProgress?: (current: number, total: number, message?: string) => void;
}

export interface ImportResult {
  success: boolean;
  mangaId?: string;
  extensionId?: string;
  chaptersImported?: number;
  error?: string;
  skipped?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manga?: {
    title: string;
    extensionId: string;
    chapterCount: number;
  };
}

/**
 * Validate the structure of an extracted archive
 */
async function validateArchiveStructure(
  extractedDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let mangaMetadata: OfflineMangaMetadata | null = null;

  try {
    // Check for manga metadata
    const metadataPath = path.join(extractedDir, "metadata.json");
    if (!(await fileExists(metadataPath))) {
      errors.push("Missing metadata.json file");
      return { valid: false, errors, warnings };
    }

    // Read and validate metadata
    try {
      mangaMetadata = await readJSON<OfflineMangaMetadata>(metadataPath);
      if (!mangaMetadata.title || !mangaMetadata.mangaId || !mangaMetadata.extensionId) {
        errors.push("Invalid metadata.json: missing required fields");
      }
    } catch (error) {
      errors.push(`Failed to parse metadata.json: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, errors, warnings };
    }

    // Check for chapters directory
    const chaptersDir = path.join(extractedDir, "chapters");
    if (!(await fileExists(chaptersDir))) {
      warnings.push("No chapters directory found");
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        manga: {
          title: mangaMetadata.title,
          extensionId: mangaMetadata.extensionId,
          chapterCount: 0,
        },
      };
    }

    // Validate chapters
    const chapterDirs = await fs.promises.readdir(chaptersDir);
    let validChapters = 0;

    for (const chapterDir of chapterDirs) {
      const chapterPath = path.join(chaptersDir, chapterDir);
      const stat = await fs.promises.stat(chapterPath);

      if (!stat.isDirectory()) {
        continue;
      }

      // Check for chapter metadata
      const chapterMetadataPath = path.join(chapterPath, "metadata.json");
      if (!(await fileExists(chapterMetadataPath))) {
        warnings.push(`Chapter ${chapterDir}: missing metadata.json`);
        continue;
      }

      // Check for pages directory
      const pagesDir = path.join(chapterPath, "pages");
      if (!(await fileExists(pagesDir))) {
        warnings.push(`Chapter ${chapterDir}: missing pages directory`);
        continue;
      }

      // Count pages
      const pageFiles = await fs.promises.readdir(pagesDir);
      const imageFiles = pageFiles.filter((f) =>
        /\.(jpg|jpeg|png|webp|gif)$/i.test(f),
      );

      if (imageFiles.length === 0) {
        warnings.push(`Chapter ${chapterDir}: no image files found`);
        continue;
      }

      validChapters++;
    }

    if (validChapters === 0) {
      errors.push("No valid chapters found in archive");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      manga: mangaMetadata
        ? {
            title: mangaMetadata.title,
            extensionId: mangaMetadata.extensionId,
            chapterCount: validChapters,
          }
        : undefined,
    };
  } catch (error) {
    errors.push(
      `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { valid: false, errors, warnings };
  }
}

/**
 * Import a manga archive from a ZIP file
 */
export async function importMangaArchive(
  dataDir: string,
  archivePath: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const {
    conflictResolution = "skip",
    validate = true,
    onProgress,
  } = options;

  const tempDir = path.join(dataDir, ".temp", `import-${Date.now()}`);

  try {
    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Extract archive
    onProgress?.(0, 100, "Extracting archive...");
    await extract(archivePath, { dir: tempDir });

    // Validate structure if requested
    if (validate) {
      onProgress?.(10, 100, "Validating archive structure...");
      const validation = await validateArchiveStructure(tempDir);

      if (!validation.valid) {
        return {
          success: false,
          error: `Archive validation failed: ${validation.errors.join(", ")}`,
        };
      }
    }

    // Read manga metadata
    const metadataPath = path.join(tempDir, "metadata.json");
    const mangaMetadata = await readJSON<OfflineMangaMetadata>(metadataPath);

    // Check if manga already exists
    const mangaPaths = buildMangaPaths(
      dataDir,
      mangaMetadata.extensionId,
      mangaMetadata.slug,
    );

    if (await fileExists(mangaPaths.mangaDir)) {
      if (conflictResolution === "skip") {
        return {
          success: true,
          skipped: true,
          mangaId: mangaMetadata.mangaId,
          extensionId: mangaMetadata.extensionId,
          chaptersImported: 0,
        };
      } else if (conflictResolution === "rename") {
        // Generate new slug with timestamp suffix
        const newSlug = `${mangaMetadata.slug}-${Date.now()}`;
        mangaMetadata.slug = newSlug;
      }
      // If overwrite, continue with existing paths
    }

    // Create manga directory
    const finalMangaPaths = buildMangaPaths(
      dataDir,
      mangaMetadata.extensionId,
      mangaMetadata.slug,
    );
    await fs.promises.mkdir(finalMangaPaths.mangaDir, { recursive: true });

    // Copy manga metadata
    onProgress?.(20, 100, "Importing manga metadata...");
    await writeJSON(finalMangaPaths.metadataFile, mangaMetadata);

    // Copy cover if exists
    const coverPath = path.join(tempDir, "cover.jpg");
    if (await fileExists(coverPath)) {
      await fs.promises.copyFile(coverPath, finalMangaPaths.coverFile);
    } else {
      // Try other common cover extensions
      for (const ext of ["png", "jpeg", "webp"]) {
        const altCoverPath = path.join(tempDir, `cover.${ext}`);
        if (await fileExists(altCoverPath)) {
          await fs.promises.copyFile(
            altCoverPath,
            finalMangaPaths.coverFile.replace(/\.[^.]+$/, `.${ext}`),
          );
          break;
        }
      }
    }

    // Import chapters
    const chaptersDir = path.join(tempDir, "chapters");
    let chaptersImported = 0;

    if (await fileExists(chaptersDir)) {
      const chapterDirs = await fs.promises.readdir(chaptersDir);
      const totalChapters = chapterDirs.length;

      for (let i = 0; i < chapterDirs.length; i++) {
        const chapterDir = chapterDirs[i];
        const sourcePath = path.join(chaptersDir, chapterDir);
        const stat = await fs.promises.stat(sourcePath);

        if (!stat.isDirectory()) {
          continue;
        }

        const progress = 20 + Math.floor((i / totalChapters) * 70);
        onProgress?.(progress, 100, `Importing chapter ${i + 1}/${totalChapters}...`);

        // Read chapter metadata
        const chapterMetadataPath = path.join(sourcePath, "metadata.json");
        if (!(await fileExists(chapterMetadataPath))) {
          continue;
        }

        const chapterMetadata = await readJSON<OfflineChapterMetadata>(
          chapterMetadataPath,
        );

        // Create chapter directory
        const chapterPaths = buildChapterPaths(
          dataDir,
          mangaMetadata.extensionId,
          mangaMetadata.slug,
          chapterMetadata.folderName,
        );

        await fs.promises.mkdir(chapterPaths.chapterDir, { recursive: true });

        // Copy chapter metadata
        await writeJSON(chapterPaths.metadataFile, chapterMetadata);

        // Copy pages
        const sourcePagesDir = path.join(sourcePath, "pages");
        const destPagesDir = path.join(chapterPaths.chapterDir, "pages");

        if (await fileExists(sourcePagesDir)) {
          await fs.promises.mkdir(destPagesDir, { recursive: true });

          const pageFiles = await fs.promises.readdir(sourcePagesDir);
          for (const pageFile of pageFiles) {
            const sourcePagePath = path.join(sourcePagesDir, pageFile);
            const destPagePath = path.join(destPagesDir, pageFile);
            await fs.promises.copyFile(sourcePagePath, destPagePath);
          }
        }

        chaptersImported++;
      }
    }

    onProgress?.(100, 100, "Import complete!");

    return {
      success: true,
      mangaId: mangaMetadata.mangaId,
      extensionId: mangaMetadata.extensionId,
      chaptersImported,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Failed to clean up temp directory:", error);
    }
  }
}

/**
 * Validate an archive without importing it
 */
export async function validateArchive(
  archivePath: string,
): Promise<ValidationResult> {
  const tempDir = path.join(
    path.dirname(archivePath),
    `.temp-validate-${Date.now()}`,
  );

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    await extract(archivePath, { dir: tempDir });
    return await validateArchiveStructure(tempDir);
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Failed to extract archive: ${error instanceof Error ? error.message : String(error)}`,
      ],
      warnings: [],
    };
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Failed to clean up temp directory:", error);
    }
  }
}

/**
 * Archive utility for creating ZIP files from offline manga storage
 *
 * This module provides functionality to:
 * - Archive individual chapters as ZIP files
 * - Archive entire manga (all chapters) as ZIP files
 * - Archive multiple manga in bulk as a single ZIP or separate files
 * - Include metadata (cover, chapter info) in archives
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import type { OfflineMangaMetadata, OfflineChapterMetadata } from "./types";
import { buildMangaPaths, buildChapterPaths } from "./utils/paths.js";
import { readJSON, fileExists } from "./utils/file-system.js";

export interface ArchiveOptions {
  /** Include metadata.json files */
  includeMetadata?: boolean;
  /** Include cover image */
  includeCover?: boolean;
  /** Compression level (0-9, where 9 is maximum compression) */
  compressionLevel?: number;
  /** Progress callback (current, total) */
  onProgress?: (current: number, total: number) => void;
}

export interface ArchiveResult {
  success: boolean;
  outputPath: string;
  sizeBytes: number;
  error?: string;
}

/**
 * Archive a single chapter to a ZIP file
 */
export async function archiveChapter(
  dataDir: string,
  extensionId: string,
  mangaSlug: string,
  chapterMetadata: OfflineChapterMetadata,
  outputPath: string,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  const {
    includeMetadata = true,
    compressionLevel = 6,
    onProgress,
  } = options;

  try {
    const chapterPaths = buildChapterPaths(
      dataDir,
      extensionId,
      mangaSlug,
      chapterMetadata.folderName,
    );

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Create archive
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: compressionLevel },
    });

    // Track progress
    let processedFiles = 0;
    const totalFiles = chapterMetadata.totalPages + (includeMetadata ? 1 : 0);

    archive.on("entry", () => {
      processedFiles++;
      onProgress?.(processedFiles, totalFiles);
    });

    // Pipe archive to output file
    archive.pipe(output);

    // Add chapter metadata if requested
    if (includeMetadata && (await fileExists(chapterPaths.metadataFile))) {
      archive.file(chapterPaths.metadataFile, { name: "metadata.json" });
    }

    // Add all page images
    const pagesDir = path.join(chapterPaths.chapterDir, "pages");
    if (await fileExists(pagesDir)) {
      const files = await fs.promises.readdir(pagesDir);
      const imageFiles = files
        .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .sort();

      for (const file of imageFiles) {
        const filePath = path.join(pagesDir, file);
        archive.file(filePath, { name: `pages/${file}` });
      }
    }

    // Finalize archive
    await archive.finalize();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
    });

    const stats = await fs.promises.stat(outputPath);

    return {
      success: true,
      outputPath,
      sizeBytes: stats.size,
    };
  } catch (error) {
    return {
      success: false,
      outputPath,
      sizeBytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Archive an entire manga (all chapters) to a ZIP file
 */
export async function archiveManga(
  dataDir: string,
  extensionId: string,
  mangaMetadata: OfflineMangaMetadata,
  outputPath: string,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  const {
    includeMetadata = true,
    includeCover = true,
    compressionLevel = 6,
    onProgress,
  } = options;

  try {
    const mangaPaths = buildMangaPaths(dataDir, extensionId, mangaMetadata.slug);

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Create archive
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: compressionLevel },
    });

    // Track progress
    let processedFiles = 0;
    const totalPages = mangaMetadata.chapters.reduce(
      (sum, ch) => sum + ch.totalPages,
      0,
    );
    const totalFiles =
      totalPages +
      mangaMetadata.chapters.length + // metadata for each chapter
      (includeMetadata ? 1 : 0) + // manga metadata
      (includeCover ? 1 : 0); // cover image

    archive.on("entry", () => {
      processedFiles++;
      onProgress?.(processedFiles, totalFiles);
    });

    // Pipe archive to output file
    archive.pipe(output);

    // Add manga metadata if requested
    if (includeMetadata && (await fileExists(mangaPaths.metadataFile))) {
      archive.file(mangaPaths.metadataFile, { name: "metadata.json" });
    }

    // Add cover image if requested
    if (includeCover && (await fileExists(mangaPaths.coverFile))) {
      const coverExt = path.extname(mangaPaths.coverFile);
      archive.file(mangaPaths.coverFile, { name: `cover${coverExt}` });
    }

    // Add all chapters
    for (const chapter of mangaMetadata.chapters) {
      const chapterPaths = buildChapterPaths(
        dataDir,
        extensionId,
        mangaMetadata.slug,
        chapter.folderName,
      );

      // Add chapter metadata
      if (includeMetadata && (await fileExists(chapterPaths.metadataFile))) {
        archive.file(chapterPaths.metadataFile, {
          name: `chapters/${chapter.folderName}/metadata.json`,
        });
      }

      // Add chapter pages
      const pagesDir = path.join(chapterPaths.chapterDir, "pages");
      if (await fileExists(pagesDir)) {
        const files = await fs.promises.readdir(pagesDir);
        const imageFiles = files
          .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
          .sort();

        for (const file of imageFiles) {
          const filePath = path.join(pagesDir, file);
          archive.file(filePath, {
            name: `chapters/${chapter.folderName}/pages/${file}`,
          });
        }
      }
    }

    // Finalize archive
    await archive.finalize();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
    });

    const stats = await fs.promises.stat(outputPath);

    return {
      success: true,
      outputPath,
      sizeBytes: stats.size,
    };
  } catch (error) {
    return {
      success: false,
      outputPath,
      sizeBytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Archive multiple manga in bulk
 * Creates separate ZIP files for each manga in the output directory
 */
export async function archiveBulk(
  dataDir: string,
  items: Array<{
    extensionId: string;
    mangaMetadata: OfflineMangaMetadata;
  }>,
  outputDir: string,
  options: ArchiveOptions = {},
): Promise<ArchiveResult[]> {
  const results: ArchiveResult[] = [];

  // Create output directory
  await fs.promises.mkdir(outputDir, { recursive: true });

  let completed = 0;
  const total = items.length;

  for (const item of items) {
    const safeTitle = item.mangaMetadata.title.replace(/[<>:"/\\|?*]/g, "_");
    const outputPath = path.join(outputDir, `${safeTitle}.zip`);

    const result = await archiveManga(
      dataDir,
      item.extensionId,
      item.mangaMetadata,
      outputPath,
      {
        ...options,
        onProgress: (current, chapterTotal) => {
          // Report overall progress
          const itemProgress = current / chapterTotal;
          const overallProgress = (completed + itemProgress) / total;
          options.onProgress?.(
            Math.floor(overallProgress * 100),
            100,
          );
        },
      },
    );

    results.push(result);
    completed++;
  }

  return results;
}

/**
 * Get estimated archive size before creating it
 */
export async function estimateArchiveSize(
  dataDir: string,
  extensionId: string,
  mangaSlug: string,
  chapters: OfflineChapterMetadata[],
): Promise<number> {
  let totalSize = 0;

  for (const chapter of chapters) {
    const chapterPaths = buildChapterPaths(
      dataDir,
      extensionId,
      mangaSlug,
      chapter.folderName,
    );

    // Add chapter size
    totalSize += chapter.sizeBytes;

    // Add metadata size (typically small)
    if (await fileExists(chapterPaths.metadataFile)) {
      const stats = await fs.promises.stat(chapterPaths.metadataFile);
      totalSize += stats.size;
    }
  }

  // Archives are typically 95-100% of original size with default compression
  return Math.floor(totalSize * 0.97);
}

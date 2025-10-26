/**
 * Storage cleanup utilities for enforcing storage limits
 */

import path from "node:path";
import { readdir, stat, readFile } from "node:fs/promises";
import type { OfflineMangaMetadata } from "./types.js";
import { deleteDir } from "./utils/file-system.js";
import { buildMangaPaths } from "./utils/paths.js";

export interface StorageSettings {
  maxStorageGB: number;
  autoCleanupEnabled: boolean;
  cleanupStrategy: "oldest" | "largest" | "least-accessed";
  cleanupThresholdPercent: number;
}

export interface CleanupResult {
  success: boolean;
  freedBytes: number;
  itemsRemoved: number;
  errors?: string[];
}

interface MangaWithStats {
  extensionId: string;
  mangaId: string;
  metadata: OfflineMangaMetadata;
  totalBytes: number;
  lastAccessedAt: number;
}

/**
 * Get the last accessed time for a manga directory
 */
async function getLastAccessedTime(mangaDir: string): Promise<number> {
  try {
    const stats = await stat(mangaDir);
    return stats.atimeMs;
  } catch {
    return 0;
  }
}

/**
 * Calculate total size of a manga
 */
function calculateMangaSize(metadata: OfflineMangaMetadata): number {
  return metadata.chapters.reduce((sum, ch) => sum + ch.sizeBytes, 0);
}

/**
 * Get all manga with their stats
 */
async function getAllMangaWithStats(
  dataDir: string
): Promise<MangaWithStats[]> {
  const results: MangaWithStats[] = [];

  try {
    const extensions = await readdir(dataDir, { withFileTypes: true });

    for (const ext of extensions) {
      if (!ext.isDirectory() || ext.name.startsWith(".")) continue;

      const extensionDir = path.join(dataDir, ext.name);
      const mangas = await readdir(extensionDir, { withFileTypes: true });

      for (const manga of mangas) {
        if (!manga.isDirectory()) continue;

        try {
          const mangaPaths = buildMangaPaths(dataDir, ext.name, manga.name);
          const metadataContent = await readFile(
            mangaPaths.metadataFile,
            "utf-8"
          );
          const metadata: OfflineMangaMetadata = JSON.parse(metadataContent);

          const lastAccessedAt = await getLastAccessedTime(mangaPaths.mangaDir);
          const totalBytes = calculateMangaSize(metadata);

          results.push({
            extensionId: ext.name,
            mangaId: manga.name,
            metadata,
            totalBytes,
            lastAccessedAt,
          });
        } catch (error) {
          console.warn(
            `Failed to read manga stats: ${ext.name}/${manga.name}`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to get manga stats", error);
  }

  return results;
}

/**
 * Check if cleanup is needed based on current storage usage
 */
export async function shouldCleanup(
  dataDir: string,
  settings: StorageSettings
): Promise<boolean> {
  if (!settings.autoCleanupEnabled) {
    return false;
  }

  const allManga = await getAllMangaWithStats(dataDir);
  const totalBytes = allManga.reduce((sum, m) => sum + m.totalBytes, 0);
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  const usagePercent = (totalGB / settings.maxStorageGB) * 100;

  return usagePercent >= settings.cleanupThresholdPercent;
}

/**
 * Perform cleanup to free up storage space
 */
export async function performCleanup(
  dataDir: string,
  settings: StorageSettings,
  targetFreeGB: number = 1
): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    freedBytes: 0,
    itemsRemoved: 0,
    errors: [],
  };

  try {
    // Get all manga with stats
    const allManga = await getAllMangaWithStats(dataDir);

    // Sort based on cleanup strategy
    switch (settings.cleanupStrategy) {
      case "oldest":
        // Sort by download time (oldest first)
        allManga.sort((a, b) => a.metadata.downloadedAt - b.metadata.downloadedAt);
        break;

      case "largest":
        // Sort by size (largest first)
        allManga.sort((a, b) => b.totalBytes - a.totalBytes);
        break;

      case "least-accessed":
        // Sort by last access time (least recently accessed first)
        allManga.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        break;
    }

    // Calculate how much space we need to free
    const currentTotalBytes = allManga.reduce((sum, m) => sum + m.totalBytes, 0);
    const maxBytes = settings.maxStorageGB * 1024 * 1024 * 1024;
    const targetBytes = maxBytes - targetFreeGB * 1024 * 1024 * 1024;
    const needToFreeBytes = currentTotalBytes - targetBytes;

    if (needToFreeBytes <= 0) {
      return result;
    }

    console.log(
      `[Cleanup] Need to free ${(needToFreeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    );

    // Remove manga until we've freed enough space
    let freedBytes = 0;
    let itemsRemoved = 0;

    for (const manga of allManga) {
      if (freedBytes >= needToFreeBytes) {
        break;
      }

      try {
        console.log(
          `[Cleanup] Removing ${manga.metadata.title} (${(manga.totalBytes / (1024 * 1024)).toFixed(2)} MB)`
        );

        // Delete the manga directory
        const mangaPaths = buildMangaPaths(dataDir, manga.extensionId, manga.mangaId);
        await deleteDir(mangaPaths.mangaDir);
        freedBytes += manga.totalBytes;
        itemsRemoved++;
      } catch (error) {
        const errorMsg = `Failed to delete ${manga.extensionId}/${manga.mangaId}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Cleanup] ${errorMsg}`);
        result.errors?.push(errorMsg);
      }
    }

    result.freedBytes = freedBytes;
    result.itemsRemoved = itemsRemoved;

    console.log(
      `[Cleanup] Complete. Freed ${(freedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB by removing ${itemsRemoved} manga`
    );

    if (result.errors && result.errors.length > 0) {
      result.success = false;
    }
  } catch (error) {
    result.success = false;
    result.errors = [
      error instanceof Error ? error.message : "Unknown error during cleanup",
    ];
  }

  return result;
}

/**
 * Get current storage usage
 */
export async function getStorageUsage(
  dataDir: string
): Promise<{ totalBytes: number; mangaCount: number }> {
  const allManga = await getAllMangaWithStats(dataDir);
  const totalBytes = allManga.reduce((sum, m) => sum + m.totalBytes, 0);

  return {
    totalBytes,
    mangaCount: allManga.length,
  };
}

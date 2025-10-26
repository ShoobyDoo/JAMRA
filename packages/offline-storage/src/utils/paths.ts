/**
 * Path Utilities
 *
 * Handles path construction for offline storage directory structure.
 */

import * as path from "node:path";
import type { OfflinePaths } from "../types.js";

/**
 * Generates zero-padded chapter folder name
 * @example "chapter-0001", "chapter-0042", "chapter-0123"
 */
export function generateChapterFolderName(
  chapterNumber: string | number,
): string {
  const num =
    typeof chapterNumber === "string"
      ? Number.parseFloat(chapterNumber)
      : chapterNumber;

  if (Number.isNaN(num)) {
    // Fallback for non-numeric chapter numbers
    return `chapter-${String(chapterNumber).replace(/[^a-z0-9]/gi, "-")}`;
  }

  // Pad to 4 digits
  const paddedNumber = String(Math.floor(num)).padStart(4, "0");
  return `chapter-${paddedNumber}`;
}

/**
 * Generates zero-padded page filename
 * @example "page-0001.jpg", "page-0042.jpg"
 */
export function generatePageFilename(
  pageIndex: number,
  extension: string = "jpg",
): string {
  const paddedIndex = String(pageIndex).padStart(4, "0");
  return `page-${paddedIndex}.${extension}`;
}

/**
 * Extracts file extension from URL or mime type
 */
export function getImageExtension(url: string, mimeType?: string): string {
  // Try to get from mime type first
  if (mimeType) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  }

  // Fallback to URL parsing
  const urlPath = url.split("?")[0]; // Remove query params
  const ext = path.extname(urlPath).toLowerCase().slice(1);

  return ext || "jpg"; // Default to jpg
}

/**
 * Builds all paths for a manga
 */
export function buildMangaPaths(
  dataDir: string,
  extensionId: string,
  mangaSlug: string,
): Pick<
  OfflinePaths,
  | "offlineDir"
  | "extensionDir"
  | "mangaDir"
  | "chaptersDir"
  | "metadataFile"
  | "coverFile"
> {
  const offlineDir = path.join(dataDir, "offline");
  const extensionDir = path.join(offlineDir, extensionId);
  const mangaDir = path.join(extensionDir, mangaSlug);
  const chaptersDir = path.join(mangaDir, "chapters");
  const metadataFile = path.join(mangaDir, "metadata.json");
  const coverFile = path.join(mangaDir, "cover.jpg");

  return {
    offlineDir,
    extensionDir,
    mangaDir,
    chaptersDir,
    metadataFile,
    coverFile,
  };
}

/**
 * Builds paths for a specific chapter
 */
export function buildChapterPaths(
  dataDir: string,
  extensionId: string,
  mangaSlug: string,
  chapterFolderName: string,
): Pick<OfflinePaths, "chapterDir"> & { metadataFile: string } {
  const mangaPaths = buildMangaPaths(dataDir, extensionId, mangaSlug);
  const chapterDir = path.join(mangaPaths.chaptersDir, chapterFolderName);
  const metadataFile = path.join(chapterDir, "metadata.json");

  return {
    chapterDir,
    metadataFile,
  };
}

/**
 * Builds path for a specific page
 */
export function buildPagePath(
  dataDir: string,
  extensionId: string,
  mangaSlug: string,
  chapterFolderName: string,
  pageFilename: string,
): string {
  const chapterPaths = buildChapterPaths(
    dataDir,
    extensionId,
    mangaSlug,
    chapterFolderName,
  );
  return path.join(chapterPaths.chapterDir, pageFilename);
}

/**
 * Sanitizes a slug to be filesystem-safe
 * Enhanced to be more restrictive and prevent path traversal attacks
 */
export function sanitizeSlug(slug: string): string {
  // Remove any null bytes
  let sanitized = slug.replace(/\0/g, "");

  // Convert to lowercase and replace non-alphanumeric characters (except hyphens) with hyphens
  sanitized = sanitized
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Additional safety: reject if the slug contains directory traversal patterns
  // This should never happen after the above replacements, but adds an extra layer of security
  if (sanitized.includes("..") || sanitized.includes("/") || sanitized.includes("\\")) {
    throw new Error("Slug contains invalid characters");
  }

  // Ensure the slug is not empty after sanitization
  if (!sanitized || sanitized.length === 0) {
    throw new Error("Slug cannot be empty after sanitization");
  }

  // Limit length to prevent filesystem issues
  if (sanitized.length > 200) {
    sanitized = sanitized.slice(0, 200);
  }

  return sanitized;
}

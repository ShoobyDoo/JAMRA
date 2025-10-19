/**
 * Image Downloader
 *
 * Handles downloading images with retry logic, progress tracking, and error handling.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ensureDir } from "./file-system.js";
import { getImageExtension } from "./paths.js";

export interface DownloadImageOptions {
  maxRetries?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms
  timeout?: number; // Default: 30000ms (30 seconds)
  onProgress?: (bytesDownloaded: number) => void;
}

export interface DownloadImageResult {
  sizeBytes: number;
  mimeType: string;
  filename: string;
}

/**
 * Downloads an image from a URL and saves it to disk
 */
export class ImageDownloader {
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly timeout: number;

  constructor(options: DownloadImageOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * Downloads an image and saves it to the specified path
   */
  async download(
    url: string,
    destPath: string,
    options: DownloadImageOptions = {},
  ): Promise<DownloadImageResult> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const retryDelay = options.retryDelay ?? this.retryDelay;
    const timeout = options.timeout ?? this.timeout;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        return await this.attemptDownload(
          url,
          destPath,
          timeout,
          options.onProgress,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes("HTTP 4")) {
          throw error;
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delay = retryDelay * attempt; // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to download image after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Single download attempt
   */
  private async attemptDownload(
    url: string,
    destPath: string,
    timeout: number,
    onProgress?: (bytes: number) => void,
  ): Promise<DownloadImageResult> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Fetch the image
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "JAMRA/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content type
      const mimeType = response.headers.get("content-type") || "image/jpeg";

      // Read response as array buffer
      const buffer = await response.arrayBuffer();
      const sizeBytes = buffer.byteLength;

      // Ensure destination directory exists
      await ensureDir(path.dirname(destPath));

      // Determine final filename with correct extension
      const extension = getImageExtension(url, mimeType);
      const baseName = path.basename(destPath, path.extname(destPath));
      const finalPath = path.join(
        path.dirname(destPath),
        `${baseName}.${extension}`,
      );

      // Write file to disk
      await fs.writeFile(finalPath, Buffer.from(buffer));

      // Report progress
      if (onProgress) {
        onProgress(sizeBytes);
      }

      return {
        sizeBytes,
        mimeType,
        filename: path.basename(finalPath),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Downloads multiple images in parallel with concurrency limit
   */
  async downloadBatch(
    downloads: Array<{ url: string; destPath: string }>,
    concurrency: number = 3,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<DownloadImageResult[]> {
    const results: DownloadImageResult[] = [];
    const queue = [...downloads];
    let completed = 0;

    // Process downloads with concurrency limit
    const workers = Array.from(
      { length: Math.min(concurrency, downloads.length) },
      async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;

          const result = await this.download(item.url, item.destPath);
          results.push(result);

          completed++;
          if (onProgress) {
            onProgress(completed, downloads.length);
          }
        }
      },
    );

    await Promise.all(workers);

    return results;
  }

  /**
   * Verifies that an image file is valid
   */
  async verifyImage(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);

      // Check if file exists and has size > 0
      if (stats.size === 0) {
        return false;
      }

      // Read first few bytes to check for valid image headers
      const buffer = await fs.readFile(filePath);
      const header = buffer.slice(0, 12);

      // Check for common image format signatures
      const isJPEG = header[0] === 0xff && header[1] === 0xd8;
      const isPNG = header[0] === 0x89 && header[1] === 0x50;
      const isGIF = header[0] === 0x47 && header[1] === 0x49;
      const isWebP = header[8] === 0x57 && header[9] === 0x45;

      return isJPEG || isPNG || isGIF || isWebP;
    } catch {
      return false;
    }
  }

  /**
   * Helper to sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Creates a singleton instance of ImageDownloader
 */
let defaultDownloader: ImageDownloader | null = null;

export function getDefaultDownloader(): ImageDownloader {
  if (!defaultDownloader) {
    defaultDownloader = new ImageDownloader();
  }
  return defaultDownloader;
}

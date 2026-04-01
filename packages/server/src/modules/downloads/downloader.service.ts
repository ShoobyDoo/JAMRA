import path from "node:path";
import type { ChapterPayload, PagesResult } from "@jamra/extension-sdk";
import { DomainError, ValidationError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";
import type {
  ExtensionRegistry,
  ExtensionRuntime,
} from "../extensions/extensions.types.js";
import type { LibraryItem } from "../library/library.types.js";
import {
  emitDownloadChapterComplete,
  emitDownloadPageComplete,
  emitDownloadProgress,
} from "../../websocket/handlers.js";
import type { DownloadsRepository } from "./downloads.repository.js";
import type { DownloadFileManager } from "./storage/file-manager.js";
import type { Download } from "./downloads.types.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const resolveFileExtension = (
  imageUrl: string,
  contentType?: string | null,
): string | undefined => {
  if (contentType) {
    if (contentType.includes("png")) {
      return ".png";
    }
    if (contentType.includes("webp")) {
      return ".webp";
    }
    if (contentType.includes("gif")) {
      return ".gif";
    }
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      return ".jpg";
    }
  }
  try {
    const url = new URL(imageUrl);
    const ext = path.extname(url.pathname);
    if (ext) {
      return ext;
    }
  } catch {
    // Ignore invalid URL parsing, fall back to default
  }
  return undefined;
};

export class DownloadCancelledError extends Error {
  constructor() {
    super("Download cancelled by user");
    this.name = "DownloadCancelledError";
  }
}

export interface ChapterDownloadOptions {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
}

interface ChapterDownloaderDeps {
  registry: ExtensionRegistry;
  runtime: ExtensionRuntime;
  repository: DownloadsRepository;
  fileManager: DownloadFileManager;
  logger: Logger;
}

export class ChapterDownloader {
  constructor(private readonly deps: ChapterDownloaderDeps) {}

  async downloadChapter(
    download: Download,
    libraryItem: LibraryItem,
    options?: ChapterDownloadOptions,
  ): Promise<void> {
    const extension = await this.deps.registry.findById(download.extensionId);
    if (!extension) {
      throw new ValidationError(
        `Extension ${download.extensionId} not found for download ${download.id}`,
      );
    }

    await this.deps.runtime.initialise(extension);

    const payload: ChapterPayload = {
      mangaId: libraryItem.mangaId,
      chapterId: download.chapterId,
    };

    const result = await this.deps.runtime.execute<ChapterPayload, PagesResult>(
      extension,
      "getPages",
      payload,
    );

    if (!result || !Array.isArray(result.pages) || result.pages.length === 0) {
      throw new DomainError("Extension did not return any pages to download");
    }

    const totalPages = result.pages.length;
    await this.deps.repository.updateTotalPages(download.id, totalPages);

    for (let index = 0; index < result.pages.length; index += 1) {
      if (options?.isCancelled?.()) {
        throw new DownloadCancelledError();
      }

      const page = result.pages[index];
      const pageNumber =
        typeof page.index === "number" ? page.index + 1 : index + 1;

      const { buffer, contentType } = await this.fetchPageWithRetry(
        page.imageUrl,
        page.headers,
        options?.signal,
      );
      const extensionGuess = resolveFileExtension(page.imageUrl, contentType);
      const { filePath, fileSize } =
        await this.deps.fileManager.saveImage(
          buffer,
          download.id,
          pageNumber,
          extensionGuess,
        );

      await this.deps.repository.addDownloadedPage({
        downloadId: download.id,
        pageNumber,
        pageUrl: page.imageUrl,
        filePath,
        fileSize,
      });

      const progress = Math.min(
        100,
        Math.round((pageNumber / totalPages) * 100),
      );
      await this.deps.repository.updateProgress(download.id, progress);

      emitDownloadProgress({
        downloadId: download.id,
        chapterId: download.chapterId,
        currentPage: pageNumber,
        totalPages,
        percentage: progress,
        timestamp: Date.now(),
      });

      emitDownloadPageComplete({
        downloadId: download.id,
        chapterId: download.chapterId,
        pageNumber,
        timestamp: Date.now(),
      });
    }

    emitDownloadChapterComplete({
      downloadId: download.id,
      chapterId: download.chapterId,
      totalPages,
      timestamp: Date.now(),
    });
  }

  private async fetchPageWithRetry(
    url: string,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ buffer: Buffer; contentType?: string | null }> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_RETRIES) {
      attempt += 1;
      try {
        const response = await fetch(url, {
          headers,
          signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to download page: ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          contentType: response.headers.get("content-type"),
        };
      } catch (error) {
        lastError = error;

        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          throw new DownloadCancelledError();
        }

        if (attempt >= MAX_RETRIES) {
          break;
        }
        await delay(RETRY_DELAY_MS * attempt);
      }
    }

    throw lastError ?? new Error("Unknown error downloading page");
  }
}

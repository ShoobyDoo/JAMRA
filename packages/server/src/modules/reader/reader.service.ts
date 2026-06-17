import { ValidationError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";
import type {
  Chapter,
  ChapterPayload,
  MangaDetailsPayload,
  PagesResult,
} from "@jamra/extension-sdk";
import type {
  ExtensionRecord,
  ExtensionRegistry,
  ExtensionRuntime,
} from "../extensions/extensions.types.js";
import type { DownloadsRepository } from "../downloads/downloads.repository.js";
import type { Download } from "../downloads/downloads.types.js";
import type { LibraryRepository } from "../library/library.repository.js";
import type { LibraryItem } from "../library/library.types.js";
import type { ProgressRepository } from "../library/progress.repository.js";
import type {
  ReaderChapter,
  ReaderPage,
  ReaderPageSource,
  RemotePageSource,
} from "./reader.types.js";

const DEFAULT_CHAPTER_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CHAPTER_LIST_TTL_MS = 10 * 60 * 1000;

interface ReaderServiceDeps {
  libraryRepository: LibraryRepository;
  progressRepository: ProgressRepository;
  downloadsRepository: DownloadsRepository;
  registry: ExtensionRegistry;
  runtime: ExtensionRuntime;
  logger: Logger;
  chapterCacheTtlMs?: number;
  chapterListTtlMs?: number;
}

interface CachedChapterEntry {
  chapter: ReaderChapter;
  pageSources: ReaderPageSource[];
  totalPages: number;
  downloadId?: string;
  isDownloaded: boolean;
  expiresAt: number;
}

interface ChapterListCacheEntry {
  chapters: Chapter[];
  expiresAt: number;
}

export class ReaderService {
  private readonly chapterCache = new Map<string, CachedChapterEntry>();
  private readonly chapterListCache = new Map<string, ChapterListCacheEntry>();
  private readonly chapterCacheTtl: number;
  private readonly chapterListTtl: number;

  constructor(private readonly deps: ReaderServiceDeps) {
    this.chapterCacheTtl =
      deps.chapterCacheTtlMs ?? DEFAULT_CHAPTER_CACHE_TTL_MS;
    this.chapterListTtl =
      deps.chapterListTtlMs ?? DEFAULT_CHAPTER_LIST_TTL_MS;
  }

  async getChapter(
    libraryId: string,
    chapterId: string,
  ): Promise<ReaderChapter> {
    const libraryItem = await this.requireLibraryItem(libraryId);
    const download =
      await this.deps.downloadsRepository.findByLibraryAndChapter(
        libraryId,
        chapterId,
      );

    const cacheKey = this.getChapterCacheKey(libraryId, chapterId);
    const cached = this.getChapterFromCache(cacheKey, download);
    if (cached) {
      return cached.chapter;
    }

    const extension = await this.requireExtension(libraryItem.extensionId);
    await this.deps.runtime.initialise(extension);

    const chapters = await this.getChapterList(libraryItem, extension);
    const navigation = this.resolveNavigation(chapters, chapterId);
    const chapterMeta = navigation.current;

    const downloadReady =
      download?.status === "completed" && download.id !== undefined;

    let pageSources = downloadReady && download
      ? await this.buildDownloadedPageSources(download)
      : await this.buildRemotePageSources(
          extension,
          libraryItem,
          chapterId,
        );

    if (pageSources.length === 0 && downloadReady) {
      this.deps.logger.warn(
        "Download missing pages, falling back to remote source",
        {
          libraryId,
          chapterId,
          downloadId: download?.id,
        },
      );
      pageSources = await this.buildRemotePageSources(
        extension,
        libraryItem,
        chapterId,
      );
    }

    if (pageSources.length === 0) {
      throw new ValidationError("Chapter has no available pages");
    }

    const chapter: ReaderChapter = {
      id: chapterId,
      number:
        download?.chapterNumber ??
        (chapterMeta?.chapterNumber !== undefined
          ? chapterMeta.chapterNumber.toString()
          : undefined),
      title: chapterMeta?.title,
      pages: this.toReaderPages(libraryId, chapterId, pageSources),
      isDownloaded: downloadReady,
      nextChapterId: navigation.nextChapterId,
      previousChapterId: navigation.previousChapterId,
    };

    this.chapterCache.set(cacheKey, {
      chapter,
      pageSources,
      totalPages: pageSources.length,
      downloadId: downloadReady ? download?.id : undefined,
      isDownloaded: chapter.isDownloaded,
      expiresAt: Date.now() + this.chapterCacheTtl,
    });

    return chapter;
  }

  async getNextChapter(
    libraryId: string,
    chapterId: string,
  ): Promise<ReaderChapter> {
    const current = await this.getChapter(libraryId, chapterId);
    if (!current.nextChapterId) {
      throw new ValidationError("Next chapter is not available");
    }
    return this.getChapter(libraryId, current.nextChapterId);
  }

  async getPreviousChapter(
    libraryId: string,
    chapterId: string,
  ): Promise<ReaderChapter> {
    const current = await this.getChapter(libraryId, chapterId);
    if (!current.previousChapterId) {
      throw new ValidationError("Previous chapter is not available");
    }
    return this.getChapter(libraryId, current.previousChapterId);
  }

  async getPageSource(
    libraryId: string,
    chapterId: string,
    pageNumber: number,
  ): Promise<ReaderPageSource> {
    const cacheEntry = await this.ensureChapterCached(
      libraryId,
      chapterId,
    );
    const pageSource = cacheEntry.pageSources.find(
      (page) => page.pageNumber === pageNumber,
    );

    if (!pageSource) {
      throw new ValidationError("Requested page does not exist");
    }
    return pageSource;
  }

  async recordPageView(
    libraryId: string,
    chapterId: string,
    pageNumber: number,
  ): Promise<void> {
    const cacheEntry = await this.ensureChapterCached(
      libraryId,
      chapterId,
    );

    await this.deps.progressRepository.upsert({
      libraryId,
      chapterId,
      chapterNumber: cacheEntry.chapter.number,
      pageNumber,
      totalPages: cacheEntry.totalPages,
    });
  }

  private async ensureChapterCached(
    libraryId: string,
    chapterId: string,
  ): Promise<CachedChapterEntry> {
    const download =
      await this.deps.downloadsRepository.findByLibraryAndChapter(
        libraryId,
        chapterId,
      );
    const cacheKey = this.getChapterCacheKey(libraryId, chapterId);
    const cached = this.getChapterFromCache(cacheKey, download);
    if (cached) {
      return cached;
    }
    await this.getChapter(libraryId, chapterId);
    const refreshed = this.getChapterFromCache(cacheKey);
    if (!refreshed) {
      throw new ValidationError("Failed to cache chapter data");
    }
    return refreshed;
  }

  private getChapterFromCache(
    cacheKey: string,
    download?: Download | null,
  ): CachedChapterEntry | null {
    const cached = this.chapterCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt < Date.now()) {
      this.chapterCache.delete(cacheKey);
      return null;
    }
    if (cached.isDownloaded) {
      if (
        !download ||
        download.status !== "completed" ||
        download.id !== cached.downloadId
      ) {
        this.chapterCache.delete(cacheKey);
        return null;
      }
    } else if (
      download &&
      download.status === "completed" &&
      download.id !== cached.downloadId
    ) {
      this.chapterCache.delete(cacheKey);
      return null;
    }
    return cached;
  }

  private toReaderPages(
    libraryId: string,
    chapterId: string,
    sources: ReaderPageSource[],
  ): ReaderPage[] {
    const endpoint = (pageNumber: number): string =>
      `/api/reader/${libraryId}/chapters/${chapterId}/pages/${pageNumber}`;

    return sources
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((source) => ({
        number: source.pageNumber,
        url: endpoint(source.pageNumber),
        width: this.getSourceDimension(source, "width"),
        height: this.getSourceDimension(source, "height"),
      }));
  }

  private getSourceDimension(
    source: ReaderPageSource,
    field: "width" | "height",
  ): number | undefined {
    if (source.type === "remote") {
      return source[field];
    }
    return undefined;
  }

  private async buildDownloadedPageSources(
    download: Download,
  ): Promise<ReaderPageSource[]> {
    const pages = await this.deps.downloadsRepository.listPages(download.id);
    return pages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((page) => ({
        type: "downloaded" as const,
        pageNumber: page.pageNumber,
        filePath: page.filePath,
        downloadId: download.id,
      }));
  }

  private async buildRemotePageSources(
    extension: ExtensionRecord,
    libraryItem: LibraryItem,
    chapterId: string,
  ): Promise<ReaderPageSource[]> {
    const payload: ChapterPayload = {
      mangaId: libraryItem.mangaId,
      chapterId,
    };
    const result = await this.deps.runtime.execute<
      ChapterPayload,
      PagesResult
    >(extension, "getPages", payload);

    if (!result?.pages || result.pages.length === 0) {
      return [];
    }

    return result.pages.map((page, index) => {
      const number =
        typeof page.index === "number" ? page.index + 1 : index + 1;
      const remotePage: RemotePageSource = {
        type: "remote",
        pageNumber: number,
        url: page.imageUrl,
        headers: page.headers,
        width: page.width,
        height: page.height,
      };
      return remotePage;
    });
  }

  private async getChapterList(
    libraryItem: LibraryItem,
    extension: ExtensionRecord,
  ): Promise<Chapter[]> {
    const cacheKey = this.getChapterListCacheKey(libraryItem);
    const cached = this.chapterListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.chapters;
    }

    const payload: MangaDetailsPayload = {
      mangaId: libraryItem.mangaId,
    };
    const chapters = await this.deps.runtime.execute<
      MangaDetailsPayload,
      Chapter[]
    >(extension, "getChapters", payload);

    if (!Array.isArray(chapters)) {
      throw new ValidationError("Extension returned invalid chapter data");
    }

    const sortedChapters = this.sortChaptersAscending(chapters);

    this.chapterListCache.set(cacheKey, {
      chapters: sortedChapters,
      expiresAt: Date.now() + this.chapterListTtl,
    });

    return sortedChapters;
  }

  private resolveNavigation(
    chapters: Chapter[],
    chapterId: string,
  ): {
    current?: Chapter;
    nextChapterId?: string;
    previousChapterId?: string;
  } {
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (index === -1) {
      return { current: undefined };
    }

    const current = chapters[index];
    const previousChapterId =
      index > 0 ? chapters[index - 1]?.id : undefined;
    const nextChapterId =
      index < chapters.length - 1
        ? chapters[index + 1]?.id
        : undefined;

    return {
      current,
      previousChapterId,
      nextChapterId,
    };
  }

  private sortChaptersAscending(chapters: Chapter[]): Chapter[] {
    // Create array with original indices for stable sort
    const indexed = chapters.map((chapter, index) => ({ chapter, index }));

    // Separate chapters with defined chapterNumber from those without
    const withNumber = indexed.filter(
      (item) => item.chapter.chapterNumber !== undefined,
    );
    const withoutNumber = indexed.filter(
      (item) => item.chapter.chapterNumber === undefined,
    );

    // Sort chapters with defined chapterNumber
    withNumber.sort((a, b) => {
      const numA = a.chapter.chapterNumber!;
      const numB = b.chapter.chapterNumber!;

      if (numA !== numB) {
        return numA - numB;
      }

      // Tiebreak by volume ascending
      const volA = a.chapter.volume ?? 0;
      const volB = b.chapter.volume ?? 0;

      if (volA !== volB) {
        return volA - volB;
      }

      // Tiebreak by original index for stability
      return a.index - b.index;
    });

    // Combine: chapters with numbers first, then chapters without, maintaining their relative order
    const sorted = [...withNumber, ...withoutNumber].map(
      (item) => item.chapter,
    );

    return sorted;
  }

  private getChapterCacheKey(
    libraryId: string,
    chapterId: string,
  ): string {
    return `${libraryId}:${chapterId}`;
  }

  private getChapterListCacheKey(libraryItem: LibraryItem): string {
    return `${libraryItem.extensionId}:${libraryItem.mangaId}`;
  }

  private async requireLibraryItem(
    libraryId: string,
  ): Promise<LibraryItem> {
    const item = await this.deps.libraryRepository.get(libraryId);
    if (!item) {
      throw new ValidationError("Library item not found");
    }
    return item;
  }

  private async requireExtension(
    extensionId: string,
  ): Promise<ExtensionRecord> {
    const extension = await this.deps.registry.findById(extensionId);
    if (!extension) {
      throw new ValidationError(`Extension ${extensionId} not found`);
    }
    return extension;
  }
}

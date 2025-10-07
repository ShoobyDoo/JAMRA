import type {
  CatalogueRequest,
  CatalogueResponse,
  ChapterPages,
  ChapterSummary,
  ExtensionFilters,
  MangaDetails,
} from "@jamra/extension-sdk";
import { CatalogRepository, type CatalogDatabase } from "@jamra/catalog-db";
import { ExtensionHost } from "@jamra/extension-host";

export interface CatalogServiceOptions {
  repository?: CatalogRepository;
  database?: CatalogDatabase;
}

export interface CatalogueSyncOptions {
  startPage?: number;
  pageLimit?: number;
  query?: CatalogueRequest["query"];
  filters?: CatalogueRequest["filters"];
  onPage?: (
    page: CatalogueResponse,
    pageNumber: number,
  ) => Promise<void> | void;
}

export interface CatalogueSyncResult {
  pagesFetched: number;
  itemsUpserted: number;
  hasMore: boolean;
}

export interface MangaSyncOptions {
  includeChapters?: boolean;
  forceChapterRefresh?: boolean;
}

export interface MangaSyncResult {
  details: MangaDetails;
  chaptersFetched: number;
}

export interface ChapterPagesSyncResult {
  pages: ChapterPages;
}

export class CatalogService {
  private readonly repository?: CatalogRepository;

  constructor(
    private readonly host: ExtensionHost,
    options: CatalogServiceOptions = {},
  ) {
    if (options.repository) {
      this.repository = options.repository;
    } else if (options.database) {
      this.repository = new CatalogRepository(options.database.db);
    }
  }

  async fetchCataloguePage(
    extensionId: string,
    request: CatalogueRequest,
  ): Promise<CatalogueResponse> {
    const handler = request.query
      ? this.host.invokeSearch.bind(this.host)
      : this.host.invokeCatalogue.bind(this.host);

    const response = await handler(extensionId, request);

    // DO NOT cache catalog results - they should always be fresh from the extension
    // Only cache heavy metadata (manga details, chapters) when explicitly fetched

    return response;
  }

  async syncCatalogue(
    extensionId: string,
    options: CatalogueSyncOptions = {},
  ): Promise<CatalogueSyncResult> {
    const startPage = options.startPage ?? 1;
    const limit = options.pageLimit ?? Number.POSITIVE_INFINITY;

    let currentPage = startPage;
    let pagesFetched = 0;
    let itemsUpserted = 0;
    let hasMore = true;

    while (hasMore && pagesFetched < limit) {
      const response = await this.host.invokeCatalogue(extensionId, {
        page: currentPage,
        query: options.query,
        filters: options.filters,
      });

      // DO NOT cache catalog results - only count items fetched
      itemsUpserted += response.items.length;

      await options.onPage?.(response, currentPage);

      hasMore = response.hasMore;
      currentPage += 1;
      pagesFetched += 1;
    }

    return {
      pagesFetched,
      itemsUpserted,
      hasMore,
    };
  }

  async syncManga(
    extensionId: string,
    mangaId: string,
    options: MangaSyncOptions = {},
  ): Promise<MangaSyncResult> {
    const details = await this.host.invokeMangaDetails(extensionId, {
      mangaId,
    });

    this.repository?.upsertMangaDetails(extensionId, details);

    let chaptersFetched = 0;
    let chapters: ChapterSummary[] | undefined = details.chapters;

    if (options.includeChapters || !chapters || options.forceChapterRefresh) {
      chapters = await this.host.invokeChapterList(extensionId, { mangaId });
    }

    if (chapters && chapters.length > 0) {
      this.repository?.upsertChapters(extensionId, mangaId, chapters);
      chaptersFetched = chapters.length;
    }

    this.repository?.updateSyncState(extensionId, { full: Date.now() });

    return {
      details,
      chaptersFetched,
    };
  }

  async syncChapterPages(
    extensionId: string,
    mangaId: string,
    chapterId: string,
  ): Promise<ChapterPagesSyncResult> {
    const pages = await this.host.invokeChapterPages(extensionId, {
      mangaId,
      chapterId,
    });

    this.repository?.replaceChapterPages(extensionId, mangaId, pages);

    return { pages };
  }

  async getFilters(extensionId: string): Promise<ExtensionFilters | undefined> {
    return this.host.getFilters(extensionId);
  }
}

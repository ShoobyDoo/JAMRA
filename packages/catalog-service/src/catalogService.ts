import type {
  CatalogueRequest,
  CatalogueResponse,
  ChapterPages,
  ChapterPagesChunk,
  ChapterSummary,
  ExtensionFilters,
  MangaDetails,
  MangaSummary,
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

export interface ChapterPagesChunkResult {
  chunk: ChapterPagesChunk;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

function looksLikeSlug(value: string): boolean {
  return SLUG_PATTERN.test(value.trim());
}

function normalizeSlug(value: string): string {
  // Check cache first
  if (SLUG_CACHE.has(value)) {
    return SLUG_CACHE.get(value)!;
  }

  // Perform expensive normalization
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Cache result if under limit
  if (SLUG_CACHE.size < MAX_CACHE_SIZE) {
    SLUG_CACHE.set(value, normalized);
  }

  return normalized;
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
    return this.performMangaSync(extensionId, mangaId, options);
  }

  async syncMangaBySlug(
    extensionId: string,
    slug: string,
    options: MangaSyncOptions = {},
  ): Promise<MangaSyncResult> {
    const mangaId = await this.resolveMangaId(extensionId, slug);

    if (mangaId === slug && looksLikeSlug(slug) && this.repository) {
      throw new Error(`Manga slug "${slug}" could not be resolved to an ID.`);
    }

    return this.performMangaSync(extensionId, mangaId, options);
  }

  async syncChapterPages(
    extensionId: string,
    mangaIdOrSlug: string,
    chapterId: string,
  ): Promise<ChapterPagesSyncResult> {
    const mangaId = await this.resolveMangaId(extensionId, mangaIdOrSlug);

    if (
      mangaId === mangaIdOrSlug &&
      looksLikeSlug(mangaIdOrSlug) &&
      this.repository
    ) {
      throw new Error(
        `Manga slug "${mangaIdOrSlug}" could not be resolved to an ID.`,
      );
    }

    const pages = await this.host.invokeChapterPages(extensionId, {
      mangaId,
      chapterId,
    });

    this.repository?.replaceChapterPages(extensionId, mangaId, pages);

    return { pages };
  }

  async fetchChapterPagesChunk(
    extensionId: string,
    mangaIdOrSlug: string,
    chapterId: string,
    chunk: number,
    chunkSize: number,
  ): Promise<ChapterPagesChunkResult> {
    const mangaId = await this.resolveMangaId(extensionId, mangaIdOrSlug);

    if (
      mangaId === mangaIdOrSlug &&
      looksLikeSlug(mangaIdOrSlug) &&
      this.repository
    ) {
      throw new Error(
        `Manga slug "${mangaIdOrSlug}" could not be resolved to an ID.`,
      );
    }

    const chunkData = await this.host.invokeChapterPagesChunk(extensionId, {
      mangaId,
      chapterId,
      chunk,
      chunkSize,
    });

    return { chunk: chunkData };
  }

  async getFilters(extensionId: string): Promise<ExtensionFilters | undefined> {
    return this.host.getFilters(extensionId);
  }

  private async performMangaSync(
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
    const shouldRefreshChapters =
      options.forceChapterRefresh || !chapters || chapters.length === 0;

    if (shouldRefreshChapters) {
      chapters = await this.host.invokeChapterList(extensionId, { mangaId });
    }

    if (chapters && chapters.length > 0) {
      this.repository?.upsertChapters(extensionId, mangaId, chapters);
      chaptersFetched = chapters.length;
      details.chapters = chapters;
    } else {
      details.chapters = chapters;
    }

    this.repository?.updateSyncState(extensionId, { full: Date.now() });

    return {
      details,
      chaptersFetched,
    };
  }

  private async resolveMangaId(
    extensionId: string,
    identifier: string,
  ): Promise<string> {
    const trimmed = identifier.trim();
    if (trimmed.length === 0) {
      throw new Error("Manga identifier is required.");
    }

    const slugCandidate = trimmed.toLowerCase();

    const repoMatch = this.repository?.getMangaBySlug(
      extensionId,
      slugCandidate,
    );
    if (repoMatch?.id) {
      return repoMatch.id;
    }

    if (!looksLikeSlug(slugCandidate)) {
      return trimmed;
    }

    try {
      const searchResponse = await this.host.invokeSearch(extensionId, {
        page: 1,
        query: trimmed.replace(/-/g, " "),
      });

      if (searchResponse.items.length > 0) {
        const resolved = this.selectBestSlugMatch(
          searchResponse.items,
          slugCandidate,
        );

        if (resolved) {
          this.repository?.upsertMangaSummaries(extensionId, [resolved]);
          return resolved.id;
        }
      }
    } catch (error) {
      console.warn(
        `Failed to resolve manga slug "${identifier}" via search`,
        error,
      );
    }

    return trimmed;
  }

  private selectBestSlugMatch(
    items: MangaSummary[],
    targetSlug: string,
  ): MangaSummary | undefined {
    const normalizedTarget = normalizeSlug(targetSlug);

    const directMatch = items.find((item) => {
      if (item.slug) {
        return normalizeSlug(item.slug) === normalizedTarget;
      }
      return false;
    });

    if (directMatch) return directMatch;

    return items.find((item) => normalizeSlug(item.title) === normalizedTarget);
  }
}

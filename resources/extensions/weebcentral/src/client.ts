import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type {
  Chapter,
  ExtensionContext,
  Manga,
  MangaDetailsResult,
  Page,
} from "@jamra/contracts";
import {
  ChapterListBuilder,
  type ChapterSource,
  CheerioExtractor,
  HtmlScraperClient,
  PagePipeline,
  SlugResolver,
  normalizeSlug,
  runLimited,
  toAbsoluteUrl as resolveAbsoluteUrl,
  extractSlugFromUrl as resolveSlugFromUrl,
  normalizeStatusValue,
  extractChapterNumber as resolveChapterNumber,
} from "@jamra/extension-sdk";

const BASE_URL = "https://weebcentral.com";
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: `${BASE_URL}/`,
};
const CHAPTER_REFERER = `${BASE_URL}/reader`;
const DISPLAY_MODE = "Minimal Display";
const SERIES_PATH_REGEX =
  /\/series\/(?<id>[A-Za-z0-9]+)(?:\/(?<slug>[^/?#]+))?/i;
const CHAPTER_PATH_REGEX =
  /\/chapters\/(?<id>[A-Za-z0-9]+)(?:\/(?<slug>[^/?#]+))?/i;
const HOT_PATH = "/hot-series";
const SEARCH_PATH = "/search/data";
const SERIES_PATH = "/series";

export const HOT_SORTS = [
  "daily_views",
  "weekly_views",
  "monthly_views",
  "total_views",
] as const;
export const SEARCH_SORTS = [
  "Best Match",
  "Alphabet",
  "Popularity",
  "Subscribers",
  "Recently Added",
  "Latest Updates",
] as const;
export const SEARCH_ORDERS = ["Ascending", "Descending"] as const;
export const FILTER_FLAGS = ["Any", "True", "False"] as const;

export type HotSort = (typeof HOT_SORTS)[number];
export type SearchSort = (typeof SEARCH_SORTS)[number];
export type SearchOrder = (typeof SEARCH_ORDERS)[number];
export type FilterFlag = (typeof FILTER_FLAGS)[number];

export interface CatalogSearchFilters {
  sort: SearchSort;
  order: SearchOrder;
  official: FilterFlag;
  anime: FilterFlag;
  adult: FilterFlag;
  includedStatus: string[];
  includedTypes: string[];
  includedTags: string[];
  excludedTags: string[];
}

interface SeriesIdentifier {
  remoteId: string;
  slug: string;
  sourceUrl: string;
}

interface ParsedSeriesDetails {
  manga: Manga;
  chapters: ChapterSource[];
  fullChapterPath?: string;
}

const DEFAULT_CATALOG_FILTERS: CatalogSearchFilters = {
  sort: "Best Match",
  order: "Descending",
  official: "Any",
  anime: "Any",
  adult: "Any",
  includedStatus: [],
  includedTypes: [],
  includedTags: [],
  excludedTags: [],
};

const slugResolver = new SlugResolver({
  normalize: normalizeSlug,
  isRemoteId: (value) => /^[0-9A-Z]{26}$/.test(value),
});

const chapterBuilder = new ChapterListBuilder({
  normalizeSlug,
  defaultLanguage: "en",
});

const seriesDetailsCache = new Map<string, MangaDetailsResult>();

export class WeebCentralClient {
  private readonly scraper: HtmlScraperClient;
  private readonly pagePipeline: PagePipeline;

  constructor(private readonly context: ExtensionContext) {
    this.scraper = new HtmlScraperClient({
      baseUrl: BASE_URL,
      allowedHosts: ["weebcentral.com", "www.weebcentral.com"],
      defaultHeaders: DEFAULT_HEADERS,
    });

    this.pagePipeline = new PagePipeline({
      scraper: this.scraper,
      buildRequest: (remoteChapterId) => ({
        path: `/chapters/${remoteChapterId}/images`,
        headers: {
          "HX-Request": "true",
          Referer: `${BASE_URL}/chapters/${remoteChapterId}`,
        },
        params: {
          is_prev: "False",
          current_page: "1",
          reading_style: "long_strip",
        },
      }),
      parser: (html) => parseChapterImages(html),
    });
  }

  async searchCatalog(
    query: string,
    page: number,
    filters: CatalogSearchFilters,
  ): Promise<Manga[]> {
    const searchParams = buildSearchParams(query, page, filters);
    const html = await this.scraper.get(SEARCH_PATH, { params: searchParams });
    const results = parseSearchResults(html);
    this.context.logger.debug("Parsed search results", {
      query,
      page,
      count: results.length,
    });
    return results;
  }

  async fetchHotCatalog(
    sort: HotSort,
    concurrencyLimit: number,
  ): Promise<Manga[]> {
    const html = await this.scraper.get(HOT_PATH, {
      params: { sort },
    });
    const seriesList = parseHotSeries(html);
    if (seriesList.length === 0) {
      return [];
    }

    const limit = Math.max(1, Math.min(concurrencyLimit, 10));
    const results: Manga[] = [];
    await runLimited(seriesList, limit, async (series) => {
      try {
        const details = await this.getSeriesDetails(series.slug);
        results.push(details.manga);
      } catch (error) {
        this.context.logger.warn("Failed to hydrate hot series entry", {
          seriesSlug: series.slug,
          error: error instanceof Error ? error.message : error,
        });
      }
    });
    return results;
  }

  async getSeriesDetails(
    seriesSlug: string,
    options?: { includeChapters?: boolean },
  ): Promise<MangaDetailsResult> {
    const normalizedSlug = normalizeSlug(seriesSlug);
    const useRemoteId = slugResolver.isRemoteId(seriesSlug);
    const cacheKey = useRemoteId
      ? slugResolver.getSlug(seriesSlug) ?? normalizedSlug
      : normalizedSlug;

    const cached =
      options?.includeChapters === false
        ? undefined
        : seriesDetailsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const remoteId = useRemoteId
      ? seriesSlug
      : await this.resolveSeriesRemoteId(normalizedSlug);

    const html = await this.scraper.get(`${SERIES_PATH}/${remoteId}`);
    const parsed = parseSeriesDetails(html, remoteId, cacheKey);

    slugResolver.register(parsed.manga.id, remoteId);

    let parsedChapters = parsed.chapters;
    if (parsed.fullChapterPath) {
      try {
        const fullHtml = await this.scraper.get(parsed.fullChapterPath, {
          headers: { "HX-Request": "true" },
        });
        const fullChapters = parseFullChapterList(fullHtml);
        if (fullChapters.length > parsedChapters.length) {
          parsedChapters = fullChapters;
        }
      } catch (error) {
        this.context.logger.warn("Failed to fetch full chapter list", {
          seriesSlug,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const chapters =
      options?.includeChapters === false
        ? []
        : chapterBuilder.build(parsed.manga.id, parsedChapters);
    const details: MangaDetailsResult = {
      manga: parsed.manga,
      chapters,
    };
    if (options?.includeChapters !== false) {
      seriesDetailsCache.set(parsed.manga.id, details);
      if (parsed.manga.id !== cacheKey) {
        seriesDetailsCache.set(cacheKey, details);
      }
    }
    return details;
  }

  async getChapters(seriesSlug: string): Promise<Chapter[]> {
    const details = await this.getSeriesDetails(seriesSlug);
    return details.chapters;
  }

  async getPages(
    seriesSlug: string,
    chapterSlug: string,
    options?: { cdnHost?: string },
  ): Promise<Page[]> {
    const remoteChapterId = await this.ensureRemoteChapterId(
      seriesSlug,
      chapterSlug,
    );
    const transformers = options?.cdnHost
      ? [PagePipeline.rewriteHosts(options.cdnHost)]
      : undefined;
    return this.pagePipeline.fetch(remoteChapterId, { transformers });
  }

  private async ensureRemoteChapterId(
    seriesSlug: string,
    chapterSlug: string,
  ): Promise<string> {
    const normalizedSeries = slugResolver.isRemoteId(seriesSlug)
      ? slugResolver.getSlug(seriesSlug) ?? normalizeSlug(seriesSlug)
      : normalizeSlug(seriesSlug);

    const normalizedChapter = normalizeSlug(chapterSlug);
    let remoteChapterId = chapterBuilder.getRemoteChapterId(
      normalizedSeries,
      normalizedChapter,
    );
    if (!remoteChapterId) {
      await this.getSeriesDetails(seriesSlug);
      remoteChapterId = chapterBuilder.getRemoteChapterId(
        normalizedSeries,
        normalizedChapter,
      );
    }
    if (!remoteChapterId) {
      throw new Error(
        `Unable to resolve remote chapter id for ${seriesSlug}/${chapterSlug}`,
      );
    }
    return remoteChapterId;
  }

  private async resolveSeriesRemoteId(slug: string): Promise<string> {
    return slugResolver.ensureRemoteId(slug, (normalized) =>
      this.lookupRemoteSeriesId(normalized),
    );
  }

  private async lookupRemoteSeriesId(slug: string): Promise<string> {
    const results = await this.searchCatalog(
      slug,
      1,
      DEFAULT_CATALOG_FILTERS,
    );
    const match =
      results.find((manga) => manga.id === slug) ?? results[0];
    if (!match) {
      throw new Error(`Unable to resolve series slug "${slug}"`);
    }
    const remoteId = slugResolver.getRemoteId(match.id);
    if (!remoteId) {
      throw new Error(`Missing remote id mapping for slug "${match.id}"`);
    }
    return remoteId;
  }
}

const buildSearchParams = (
  query: string,
  page: number,
  filters: CatalogSearchFilters,
): Record<string, string> => {
  const params = new URLSearchParams();
  params.set("text", query);
  params.set("page", `${page}`);
  params.set("display_mode", DISPLAY_MODE);
  params.set("sort", filters.sort);
  params.set("order", filters.order);
  params.set("official", filters.official);
  params.set("anime", filters.anime);
  params.set("adult", filters.adult);

  for (const value of filters.includedStatus) {
    params.append("included_status", value);
  }
  for (const value of filters.includedTypes) {
    params.append("included_type", value);
  }
  for (const value of filters.includedTags) {
    params.append("included_tag", value);
  }
  for (const value of filters.excludedTags) {
    params.append("excluded_tag", value);
  }

  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
};

const parseSearchResults = (html: string): Manga[] => {
  const $ = load(html);
  const results: Manga[] = [];

  $("article.bg-base-300").each((_: number, element: Element) => {
    const anchor = $(element).find("a[href*='/series/']").first();
    const href = anchor.attr("href");
    if (!href) {
      return;
    }

    const identifier = parseSeriesLink(href);
    if (!identifier) {
      return;
    }

    slugResolver.register(identifier.slug, identifier.remoteId);

    const title =
      anchor.find("h2").first().text().trim() ||
      anchor.attr("data-tip")?.trim() ||
      identifier.slug.replace(/[-_]+/g, " ") ||
      identifier.remoteId;

    const metaDivs = $(element).find("section.flex.gap-2 div");
    const type = metaDivs.eq(0).text().trim();
    const statusText = metaDivs.eq(2).text().trim();

    const tags = extractTagTexts($, element);
    if (type && !tags.includes(type)) {
      tags.unshift(type);
    }

    results.push({
      id: identifier.slug,
      title,
      description: undefined,
      coverUrl: buildCoverUrl(identifier.remoteId),
      authors: [],
      tags,
      status: normalizeStatusValue(statusText),
      language: "en",
      sourceUrl: identifier.sourceUrl,
    });
  });

  return results;
};

const parseHotSeries = (html: string): SeriesIdentifier[] => {
  const $ = load(html);
  const seen = new Set<string>();
  const entries: SeriesIdentifier[] = [];

  $("a[href*='/series/']").each((_: number, element: Element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }
    const identifier = parseSeriesLink(href);
    if (!identifier || seen.has(identifier.slug)) {
      return;
    }
    seen.add(identifier.slug);
    slugResolver.register(identifier.slug, identifier.remoteId);
    entries.push(identifier);
  });

  return entries;
};

const parseSeriesDetails = (
  html: string,
  remoteId: string,
  slugHint: string,
): ParsedSeriesDetails => {
  const $ = load(html);
  const canonical =
    $('link[rel="canonical"]').attr("href") ??
    `${BASE_URL}/series/${remoteId}`;

  const title =
    $("h1")
      .first()
      .text()
      .trim() || $("title").first().text().trim() || remoteId;

  const canonicalSlug =
    resolveSlugFromUrl(canonical, { baseUrl: BASE_URL }) ??
    slugHint ??
    normalizeSlug(title) ??
    normalizeSlug(remoteId);

  const extractor = CheerioExtractor.for($, {
    manga: {
      id: canonicalSlug,
      title,
      language: "en",
      sourceUrl: canonical,
    } as Manga,
    meta: {},
  });

  extractor
    .text({ into: "manga.description", label: "Description" })
    .list({ into: "manga.authors", label: "Author" })
    .list({ into: "manga.artists", label: "Artist" })
    .list({ into: "manga.tags", label: "Tags" })
    .text({ into: "meta.status", label: "Status" });

  const state = extractor.result() as {
    manga: Manga;
    meta: { status?: string };
  };

  const coverCandidate = $("picture img").first().attr("src");
  state.manga.coverUrl = coverCandidate
    ? resolveAbsoluteUrl(coverCandidate, BASE_URL)
    : buildCoverUrl(remoteId);
  state.manga.status = normalizeStatusValue(state.meta?.status);

  const chapters = parseChapterBlocks($, "#chapter-list > div");
  const fullChapterAttr = $("[hx-get*='full-chapter-list']").attr("hx-get");
  const fullChapterPath = fullChapterAttr
    ? resolveAbsoluteUrl(fullChapterAttr, BASE_URL)
    : undefined;
  return { manga: state.manga, chapters, fullChapterPath };
};

const parseFullChapterList = (html: string): ChapterSource[] => {
  const $ = load(html);
  return parseChapterBlocks($, "div[x-data*='checkNewChapter']");
};

const parseChapterImages = (html: string): Page[] => {
  const $ = load(html);
  const pages: Page[] = [];
  $("img")
    .filter((_: number, element: Element) => Boolean($(element).attr("src")))
    .each((index, element: Element) => {
      const src = $(element).attr("src");
      if (!src) {
        return;
      }

      const width = Number.parseInt($(element).attr("width") ?? "", 10);
      const height = Number.parseInt($(element).attr("height") ?? "", 10);
      pages.push({
        index: index + 1,
        imageUrl: resolveAbsoluteUrl(src, BASE_URL),
        headers: {
          Referer: CHAPTER_REFERER,
        },
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      });
    });
  return pages;
};

type HtmlParser = ReturnType<typeof load>;

const parseChapterBlocks = (
  dom: HtmlParser,
  selector: string,
): ChapterSource[] => {
  const entries: ChapterSource[] = [];

  dom(selector).each((_: number, element: AnyNode) => {
    const block = dom(element);
    const anchor = block
      .find("a[href*='/chapters/']")
      .first() as Cheerio<Element>;
    if (!anchor.length) {
      return;
    }
    const href = anchor.attr("href");
    if (!href) {
      return;
    }
    const match = CHAPTER_PATH_REGEX.exec(href);
    if (!match?.groups?.id) {
      return;
    }
    const remoteChapterId = match.groups.id;
    const title = extractChapterTitle(dom, anchor);
    const chapterNumber = resolveChapterNumber(title);
    const publishedAt = extractPublishedAt(block.attr("x-data"));
    entries.push({
      remoteId: remoteChapterId,
      title,
      chapterNumber,
      publishedAt,
      language: "en",
    });
  });

  return entries;
};

const extractChapterTitle = (
  dom: HtmlParser,
  anchor: Cheerio<Element>,
): string => {
  const titleCandidate = anchor
    .find(".grow span")
    .filter((_: number, span: Element) => dom(span).children().length === 0)
    .map((_: number, span: Element) =>
      dom(span)
        .text()
        .replace(/\s+/g, " ")
        .trim(),
    )
    .get()
    .find((text: string) => text.length > 0);
  if (titleCandidate) {
    return titleCandidate;
  }
  const fallback = anchor.text().replace(/\s+/g, " ").trim();
  return fallback || "Chapter";
};

const parseSeriesLink = (href: string): SeriesIdentifier | null => {
  const match = SERIES_PATH_REGEX.exec(href);
  if (!match?.groups?.id) {
    return null;
  }
  const remoteId = match.groups.id;
  const slugSegment = match.groups.slug
    ? decodeURIComponent(match.groups.slug)
    : undefined;
  const slug = slugSegment
    ? normalizeSlug(slugSegment)
    : normalizeSlug(remoteId);
  const url = resolveAbsoluteUrl(href, BASE_URL);
  return { remoteId, slug, sourceUrl: url };
};

const extractTagTexts = (
  api: CheerioAPI,
  element: Element,
): string[] => {
  const wrapper = api(element);
  const tagSection = wrapper
    .find("section")
    .filter((_: number, node: Element) =>
      api(node).find("strong").text().toLowerCase().includes("tag"),
    )
    .first();
  if (!tagSection.length) {
    return [];
  }

  return tagSection
    .find("span")
    .map((_: number, node: Element) =>
      api(node).text().replace(/,/g, "").trim(),
    )
    .get()
    .filter(Boolean);
};

const extractPublishedAt = (xData: string | undefined): string | undefined => {
  if (!xData) {
    return undefined;
  }
  const match = xData.match(/checkNewChapter\('([^']+)'/);
  return match?.[1];
};

const buildCoverUrl = (seriesId: string): string => {
  return `https://temp.compsci88.com/cover/normal/${seriesId}.webp`;
};

import * as cheerio from "cheerio";
import type {
  MangaSummary,
  MangaDetails,
  ChapterPages,
  ChapterPagesChunk,
  ExtensionCache,
} from "@jamra/extension-sdk";
import { RateLimiter } from "./rate-limiter.js";

const BASE_URL = "https://weebcentral.com";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://weebcentral.com/",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const SERIES_CACHE_NAMESPACE = "series-names";
const CHAPTER_CACHE_NAMESPACE = "chapter-list";
const CHAPTER_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
const CHAPTER_PAGES_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

interface SeriesMetadata {
  id: string;
  name: string;
}

interface CatalogueResult {
  page: number;
  hasMore: boolean;
  items: MangaSummary[];
}

export class WeebCentralScraper {
  private rateLimiter: RateLimiter;
  private seriesCache: Map<string, SeriesMetadata> = new Map();
  private cache?: ExtensionCache;
  private chapterPagesCache: Map<string, { images: ChapterPages["images"]; fetchedAt: number }> = new Map();

  constructor(rateLimiter: RateLimiter, cache?: ExtensionCache) {
    this.rateLimiter = rateLimiter;
    this.cache = cache;
  }

  setCache(cache: ExtensionCache): void {
    this.cache = cache;
  }

  private async fetchChapterPageList(chapterId: string): Promise<ChapterPages["images"]> {
    const cached = this.chapterPagesCache.get(chapterId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CHAPTER_PAGES_CACHE_TTL_MS) {
      return cached.images;
    }

    const url = `${BASE_URL}/chapters/${chapterId}/images?reading_style=long_strip`;

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    });

    const $ = cheerio.load(html);
    const images: ChapterPages["images"] = [];

    $('section[x-data] img, section img[src*="manga"]').each((i, el) => {
      const src = $(el).attr("src");
      if (src && src.includes("manga") && !src.includes("logo")) {
        const width = $(el).attr("width");
        const height = $(el).attr("height");

        images.push({
          index: i,
          url: src,
          width: width ? parseInt(width) : undefined,
          height: height ? parseInt(height) : undefined,
        });
      }
    });

    this.chapterPagesCache.set(chapterId, { images, fetchedAt: now });
    return images;
  }

  async getHotUpdates(page: number = 1): Promise<CatalogueResult> {
    const url = `${BASE_URL}/hot-updates`;

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    });

    const $ = cheerio.load(html);
    const items: MangaSummary[] = [];
    const seenIds = new Set<string>();

    // Parse articles - hot-updates shows both desktop and mobile versions
    $("article").each((i, el) => {
      const $article = $(el);

      // Get the series link (exists in mobile version)
      const $seriesLink = $article.find('a[href*="/series/"]').first();
      const seriesHref = $seriesLink.attr("href");

      // Get title from data-tip attribute
      const title = $article.attr("data-tip") || $article.find("img").first().attr("alt")?.replace(" cover", "") || "";

      // Get cover image
      const thumbnail = $article.find("img").first().attr("src");

      if (seriesHref && title) {
        const match = seriesHref.match(/\/series\/([^\/]+)\/(.+)/);
        if (match) {
          const [, id, name] = match;

          // Skip duplicates (desktop + mobile versions)
          if (seenIds.has(id)) return;
          seenIds.add(id);

          // Cache series metadata
          this.seriesCache.set(id, { id, name });
          this.cache?.set(SERIES_CACHE_NAMESPACE, id, name).catch((err) => {
            console.warn(`Failed to cache series name for ${id}:`, err);
          });

          items.push({
            id,
            slug: name,
            title,
            coverUrl: thumbnail || `https://temp.compsci88.com/cover/fallback/${id}.jpg`,
          });
        }
      }
    });

    // Hot-updates doesn't have pagination in the traditional sense
    return {
      page,
      hasMore: false,
      items,
    };
  }

  async searchManga(
    query: string,
    page: number,
    filters?: Record<string, unknown>
  ): Promise<CatalogueResult> {
    const limit = 32;
    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      text: query,
      limit: String(limit),
      offset: String(offset),
      display_mode: "Full Display",
      sort: (filters?.sort as string) || "Popularity",
    });

    // Add filters
    if (filters?.status && Array.isArray(filters.status)) {
      filters.status.forEach((s: string) =>
        params.append("included_status", s)
      );
    }

    if (filters?.type && Array.isArray(filters.type)) {
      filters.type.forEach((t: string) => params.append("included_type", t));
    }

    if (filters?.genres && Array.isArray(filters.genres)) {
      filters.genres.forEach((g: string) => params.append("included_tag", g));
    }

    if (filters?.excludeGenres && Array.isArray(filters.excludeGenres)) {
      filters.excludeGenres.forEach((g: string) =>
        params.append("excluded_tag", g)
      );
    }

    const url = `${BASE_URL}/search/data?${params.toString()}`;

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    });

    const $ = cheerio.load(html);
    const items: MangaSummary[] = [];

    $("article").each((i, el) => {
      const $article = $(el);

      // Find the first link to the series page (usually in the cover section)
      const $link = $article.find('a[href*="/series/"]').first();
      const href = $link.attr("href");

      if (!href) return;

      // Extract title from multiple possible locations:
      // 1. h3 tag (desktop)
      // 2. div with text-lg class (mobile)
      // 3. img alt attribute
      let title = $article.find("h3").first().text().trim();
      if (!title) {
        title = $article.find(".text-lg").first().text().trim();
      }
      if (!title) {
        title = $article.find("img").first().attr("alt")?.replace(" cover", "") || "";
      }

      // Get thumbnail
      const thumbnail = $article.find("img").first().attr("src");

      if (href && title) {
        const match = href.match(/\/series\/([^\/]+)\/(.+)/);
        if (match) {
          const [, id, name] = match;
          // Cache series metadata in memory and persistent cache
          this.seriesCache.set(id, { id, name });
          // Persist to database cache asynchronously (fire-and-forget)
          this.cache?.set(SERIES_CACHE_NAMESPACE, id, name).catch((err) => {
            console.warn(`Failed to cache series name for ${id}:`, err);
          });

          items.push({
            id,
            slug: name,
            title,
            coverUrl: thumbnail || `https://temp.compsci88.com/cover/fallback/${id}.jpg`,
          });
        }
      }
    });

    return {
      page,
      hasMore: items.length === limit,
      items,
    };
  }

  async getMangaDetails(mangaId: string): Promise<MangaDetails> {
    // Get series metadata from cache or fetch
    let metadata = this.seriesCache.get(mangaId);
    if (!metadata) {
      // Try persistent cache first
      const cachedName = await this.cache?.get<string>(SERIES_CACHE_NAMESPACE, mangaId);
      if (cachedName) {
        metadata = { id: mangaId, name: cachedName };
        this.seriesCache.set(mangaId, metadata);
      } else {
        // Fallback to fetching metadata
        metadata = await this.fetchSeriesMetadata(mangaId);
      }
    }

    const chapterPromise = this.getChapterList(mangaId);
    const url = `${BASE_URL}/series/${mangaId}/${metadata.name}`;

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    });

    const $ = cheerio.load(html);

    // Extract metadata - WeebCentral uses <strong>Label: </strong> pattern in <li> elements
    const getMetadata = (label: string): string => {
      const $li = $(`li:has(strong:contains("${label}"))`);
      if ($li.length === 0) return "";

      // Clone and remove the strong tag to get just the value
      const $clone = $li.clone();
      $clone.find("strong").remove();
      return $clone.text().trim();
    };

    const getMetadataLinks = (label: string): string[] => {
      const $li = $(`li:has(strong:contains("${label}"))`);
      if ($li.length === 0) return [];

      return $li.find("a")
        .map((i, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
    };

    const title = $("h1").first().text().trim();
    const description = $('section[x-data] p').first().text().trim() ||
                       $('section p').first().text().trim() ||
                       "No description available.";

    const authorsText = getMetadata("Author(s)");
    const authors = authorsText ? authorsText.split(",").map((s) => s.trim()).filter(Boolean) : getMetadataLinks("Author(s)");

    const artistsText = getMetadata("Artist(s)");
    const artists = artistsText ? artistsText.split(",").map((s) => s.trim()).filter(Boolean) : getMetadataLinks("Artist(s)");

    const genres = getMetadataLinks("Tags(s)") || getMetadataLinks("Genre(s)") || getMetadataLinks("Genres");
    const statusText = getMetadata("Status").toLowerCase();
    const released = getMetadata("Released");

    // Map status to SDK enum
    let status: MangaDetails["status"] = "unknown";
    if (statusText.includes("ongoing")) status = "ongoing";
    else if (statusText.includes("complete")) status = "completed";
    else if (statusText.includes("hiatus")) status = "hiatus";
    else if (statusText.includes("cancel")) status = "cancelled";

    let chapters: NonNullable<MangaDetails["chapters"]> = [];
    try {
      chapters = await chapterPromise;
    } catch (error) {
      console.warn(`Failed to fetch chapter list for ${mangaId}:`, error);
      chapters = [];
    }

    return {
      id: mangaId,
      slug: metadata?.name,
      title,
      description,
      coverUrl: `https://temp.compsci88.com/cover/fallback/${mangaId}.jpg`,
      authors,
      artists: artists.length > 0 ? artists : authors,
      chapters,
      genres,
      tags: [],
      rating: undefined,
      year: released ? parseInt(released) : undefined,
      links: {},
      status,
      demographic: undefined,
      altTitles: [],
    };
  }

  private async fetchSeriesMetadata(mangaId: string): Promise<SeriesMetadata> {
    // This is called when we don't have cached metadata
    // We'll make a best-effort attempt by using a generic name
    // In practice, this shouldn't happen often as searchManga caches metadata
    return { id: mangaId, name: "series" };
  }

  private async getChapterList(
    seriesId: string
  ): Promise<NonNullable<MangaDetails["chapters"]>> {
    const cacheKey = `${seriesId}:v2`;
    if (this.cache) {
      try {
        const cached = await this.cache.get<NonNullable<MangaDetails["chapters"]>>(
          CHAPTER_CACHE_NAMESPACE,
          cacheKey
        );
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
      } catch (error) {
        console.warn(`Failed to read cached chapters for ${seriesId}:`, error);
      }
    }

    const url = `${BASE_URL}/series/${seriesId}/full-chapter-list`;

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    });

    const $ = cheerio.load(html);
    const chapters: NonNullable<MangaDetails["chapters"]> = [];

    const cleanScanlatorName = (value: string) => {
      return value
        .replace(/\s+/g, " ")
        .replace(/^(?:scanlation|scanlator|group|by)[:\-\s]+/i, "")
        .replace(/^(?:scanlated|scans?|team|teams?)\s+by\s+/i, "")
        .trim();
    };

    $('div[x-data] > a, section a[href*="/chapters/"]').each((i, el) => {
      const href = $(el).attr("href");

      // Get only the chapter number/title - be very aggressive about removing junk
      const $link = $(el);

      // Extract publish date from time element before removing it
      const $timeElement = $link.find("time");
      let publishedAt: string | undefined;
      if ($timeElement.length > 0) {
        // Try datetime attribute first, then text content
        const datetime = $timeElement.attr("datetime");
        if (datetime) {
          publishedAt = new Date(datetime).toISOString();
        } else {
          const timeText = $timeElement.text().trim();
          if (timeText) {
            try {
              publishedAt = new Date(timeText).toISOString();
            } catch {
              // If parsing fails, leave undefined
            }
          }
        }
      }

      const scanlatorSet = new Set<string>();
      const attributeCandidates = [
        "data-credits",
        "data-credit",
        "data-credits-json",
        "data-scanlators",
        "data-scanlator",
        "data-groups",
        "data-group",
        "data-team",
        "data-teams",
      ] as const;

      const pushScanlator = (raw?: string | null) => {
        if (!raw) return;
        const cleaned = cleanScanlatorName(raw);
        if (!cleaned) return;
        if (/^chapter\s+/i.test(cleaned)) return;
        if (/^vol(?:ume)?\s+/i.test(cleaned)) return;
        if (/^\d+(?:\.\d+)?$/.test(cleaned)) return;
        if (/^last\s+read/i.test(cleaned)) return;
        if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(cleaned)) return;
        scanlatorSet.add(cleaned);
      };

      attributeCandidates.forEach((attr) => {
        const value = $link.attr(attr);
        if (!value) return;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            parsed.forEach((entry) => {
              if (typeof entry === "string") {
                pushScanlator(entry);
              } else if (entry && typeof entry.name === "string") {
                pushScanlator(entry.name);
              }
            });
          } else if (typeof parsed === "object" && parsed !== null) {
            const possibleName =
              typeof parsed.name === "string"
                ? parsed.name
                : typeof parsed.label === "string"
                  ? parsed.label
                  : undefined;
            if (possibleName) {
              pushScanlator(possibleName);
            }
          } else if (typeof parsed === "string") {
            pushScanlator(parsed);
          }
        } catch {
          value
            .split(/[,|/]/)
            .map((segment) => segment.trim())
            .filter(Boolean)
            .forEach((segment) => pushScanlator(segment));
        }
      });

      $link
        .find("[data-credits], [data-credit], [data-group], [data-team]")
        .each((_, element) => {
          const text = $(element).text();
          pushScanlator(text);
        });

      $link
        .find("span, small, div")
        .get()
        .forEach((node) => {
          const text = $(node).text().replace(/\s+/g, " ").trim();
          if (!text) return;
          if (/chapter\s+\d+/i.test(text)) return;
          if (/last\s+read/i.test(text)) return;
          if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(text)) return;
          if (/^\d+(?:\.\d+)?$/.test(text)) return;
          if (/^(?:vol|volume)\s+/i.test(text)) return;
          if (/^\w+\s+ago$/i.test(text)) return;
          if (/^\d+\s+(?:minutes|minute|hours|hour|days|day)\s+ago$/i.test(text)) return;
          if (text.length <= 2) return;
          // Prefer texts that explicitly mention scans/translation/groups
          if (/(scan|group|team|translat)/i.test(text)) {
            pushScanlator(text);
            return;
          }
          // As a fallback, if we have no scanlators yet, allow short names without numbers
          if (scanlatorSet.size === 0 && !/\d/.test(text)) {
            pushScanlator(text);
          }
        });

      // Remove all unwanted elements
      const $clone = $link.clone();
      $clone.find("svg, time, style, script, div, span").remove();

      // Get text and aggressively clean it
      let chapterText = $clone.text();

      // Remove everything after "Last Read" or any dates/timestamps
      chapterText = chapterText.split("Last Read")[0];
      chapterText = chapterText.split(/\d{4}-\d{2}-\d{2}/)[0];

      // Clean up whitespace
      chapterText = chapterText.replace(/\s+/g, " ").trim();

      // If we still don't have clean text, try to extract just "Chapter X" pattern
      if (!chapterText || chapterText.includes("{") || chapterText.includes(".st0")) {
        const cleanMatch = $link.text().match(/Chapter\s+(\d+(?:\.\d+)?)/i);
        if (cleanMatch) {
          chapterText = `Chapter ${cleanMatch[1]}`;
        }
      }

      if (href && chapterText && !chapterText.includes("{")) {
        const match = href.match(/\/chapters\/([^\/\?]+)/);
        if (match) {
          const chapterId = match[1];

          // Extract chapter number from text like "Chapter 212" or "Ch. 100.5"
          const numberMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
          const chapterNumber = numberMatch ? numberMatch[1] : String(chapters.length + 1);

          chapters.push({
            id: chapterId,
            title: chapterText,
            number: chapterNumber,
            publishedAt: publishedAt || new Date().toISOString(),
            languageCode: "en",
            scanlators: Array.from(scanlatorSet),
          });
        }
      }
    });

    // Site lists oldest first, so reverse to get newest first (latest to oldest)
    const ordered = chapters.reverse();

    if (this.cache) {
      this.cache
        .set(CHAPTER_CACHE_NAMESPACE, cacheKey, ordered, CHAPTER_CACHE_TTL_MS)
        .catch((error) => {
          console.warn(`Failed to cache chapters for ${seriesId}:`, error);
        });
    }

    return ordered;
  }

  async getChapterPages(chapterId: string): Promise<ChapterPages> {
    const images = await this.fetchChapterPageList(chapterId);

    return {
      chapterId,
      mangaId: "", // Not available from this endpoint
      images,
    };
  }

  async getChapterPagesChunk(
    mangaId: string,
    chapterId: string,
    chunk: number,
    chunkSize: number,
  ): Promise<ChapterPagesChunk> {
    const images = await this.fetchChapterPageList(chapterId);
    const totalPages = images.length;
    const totalChunks = Math.max(1, Math.ceil(totalPages / chunkSize));
    const start = chunk * chunkSize;
    const end = Math.min(totalPages, start + chunkSize);
    const slice = images.slice(start, end).map((page, index) => ({
      ...page,
      index: start + index,
    }));

    return {
      chapterId,
      mangaId,
      chunk,
      chunkSize,
      totalChunks,
      totalPages,
      images: slice,
      hasMore: end < totalPages,
    };
  }
}

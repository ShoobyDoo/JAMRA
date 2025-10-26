import * as cheerio from "cheerio";
import type {
  MangaSummary,
  MangaDetails,
  ChapterPages,
  ChapterPagesChunk,
  ExtensionCache,
  ExtensionLogger,
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
  private logger: ExtensionLogger;
  private chapterPagesCache: Map<
    string,
    { pages: ChapterPages["pages"]; fetchedAt: number }
  > = new Map();

  constructor(rateLimiter: RateLimiter, logger: ExtensionLogger, cache?: ExtensionCache) {
    this.rateLimiter = rateLimiter;
    this.logger = logger;
    this.cache = cache;
  }

  setCache(cache: ExtensionCache): void {
    this.cache = cache;
  }

  private async fetchChapterPageList(
    chapterId: string,
  ): Promise<ChapterPages["pages"]> {
    this.logger.debug("Fetching chapter page list", { chapterId });

    const cached = this.chapterPagesCache.get(chapterId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CHAPTER_PAGES_CACHE_TTL_MS) {
      this.logger.debug("Using cached chapter pages", {
        chapterId,
        pageCount: cached.pages.length,
      });
      return cached.pages;
    }

    const url = `${BASE_URL}/chapters/${chapterId}/images?reading_style=long_strip`;
    this.logger.debug("Fetching chapter pages from URL", { url });

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      this.logger.debug("HTTP response received", {
        status: response.status,
        statusText: response.statusText,
      });
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error("HTTP error response", {
          status: response.status,
          preview: errorText.substring(0, 500),
        });

        // Check for rate limiting or temporary errors
        if (response.status === 429 || response.status === 503) {
          throw new Error(`Server temporarily unavailable (${response.status}): Please try again later`);
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();

      // Validate that we got actual HTML, not an error page
      if (!text.includes('<html') && !text.includes('<img')) {
        this.logger.error("Invalid response from server", {
          preview: text.substring(0, 500),
        });
        throw new Error('Invalid response from server - possible rate limiting or maintenance');
      }

      return text;
    });

    this.logger.debug("HTML fetched", { length: html.length });

    // Log first part of HTML to debug parsing issues
    if (html.length < 2000 || !html.includes("<img")) {
      this.logger.warn("Suspicious HTML response", {
        length: html.length,
        preview: html.substring(0, 1000),
      });
    }

    const $ = cheerio.load(html);
    const images: ChapterPages["pages"] = [];

    // Count all section and img tags for debugging
    this.logger.debug("DOM stats", {
      sections: $("section").length,
      images: $("img").length,
    });

    // Try multiple selectors to find images
    const selectors = [
      "section[x-data] img",
      "section img",
      'img[src*="official.lowee.us"]',
      'img[src*="manga"]',
      'img[alt*="Page"]',
      "img",
    ];

    for (const selector of selectors) {
      if (images.length > 0) break; // Stop if we found images

      this.logger.debug("Trying selector", { selector });
      $(selector).each((i, el) => {
        const src = $(el).attr("src");
        this.logger.debug("Found image", {
          index: i,
          srcPreview: src?.substring(0, 50),
        });

        if (
          src &&
          !src.includes("logo") &&
          !src.includes("icon") &&
          !src.includes("avatar") &&
          !src.includes("broken_image")
        ) {
          const width = $(el).attr("width");
          const height = $(el).attr("height");

          images.push({
            index: images.length,
            url: src,
            width: width ? parseInt(width) : undefined,
            height: height ? parseInt(height) : undefined,
          });
        }
      });

      this.logger.debug("Selector result", {
        selector,
        imageCount: images.length,
      });
    }

    this.logger.debug("Final extraction result", {
      chapterId,
      imageCount: images.length,
    });

    if (images.length === 0) {
      this.logger.warn("No images found", {
        chapterId,
        htmlLength: html.length,
        htmlPreview: html.substring(0, 500),
      });
    }

    this.chapterPagesCache.set(chapterId, { pages: images, fetchedAt: now });
    this.logger.debug("Returning chapter images", { count: images.length });
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
      const title =
        $article.attr("data-tip") ||
        $article.find("img").first().attr("alt")?.replace(" cover", "") ||
        "";

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
            this.logger.warn("Failed to cache series name", { id, error: String(err) });
          });

          // Build cover URLs in priority order
          // Hot-updates has desktop + mobile articles. Desktop has /normal/ URLs but no series link.
          // Mobile has series link but only /small/ URLs.
          const thumbnailUrls: string[] = [];

          // 1. Extract sources from HTML (most reliable)
          $article.find('picture source[type="image/webp"]').each((i, el) => {
            const srcset = $(el).attr("srcset")?.split(" ")[0];
            if (srcset && !thumbnailUrls.includes(srcset)) {
              thumbnailUrls.push(srcset);
            }
          });

          // 2. Add img src
          const imgSrc = $article.find("img").first().attr("src");
          if (imgSrc && !thumbnailUrls.includes(imgSrc)) {
            thumbnailUrls.push(imgSrc);
          }

          // 3. Add data-src (lazy loading)
          const dataSrc = $article.find("img").first().attr("data-src");
          if (dataSrc && !thumbnailUrls.includes(dataSrc)) {
            thumbnailUrls.push(dataSrc);
          }

          // 4. Constructed URL as fallback (may be incorrect on WeebCentral's CDN)
          const constructedUrl = `https://temp.compsci88.com/cover/normal/${id}.webp`;
          if (!thumbnailUrls.includes(constructedUrl)) {
            thumbnailUrls.push(constructedUrl);
          }

          items.push({
            id,
            slug: name,
            title,
            coverUrl: thumbnailUrls[0],
            coverUrls: thumbnailUrls.slice(0, 5), // Limit to 5 URLs to prevent payload explosion
            links: {
              source: `${BASE_URL}/series/${id}/${name}`,
            },
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
    filters?: Record<string, unknown>,
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
        params.append("included_status", s),
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
        params.append("excluded_tag", g),
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
        title =
          $article.find("img").first().attr("alt")?.replace(" cover", "") || "";
      }

      if (href && title) {
        const match = href.match(/\/series\/([^\/]+)\/(.+)/);
        if (match) {
          const [, id, name] = match;
          // Cache series metadata in memory and persistent cache
          this.seriesCache.set(id, { id, name });
          // Persist to database cache asynchronously (fire-and-forget)
          this.cache?.set(SERIES_CACHE_NAMESPACE, id, name).catch((err) => {
            this.logger.warn("Failed to cache series name", { id, error: String(err) });
          });

          // Build cover URLs in priority order
          // Prioritize HTML-extracted URLs over constructed fallbacks
          const thumbnailUrls: string[] = [];

          // 1. Extract sources from HTML (most reliable)
          $article.find('picture source[type="image/webp"]').each((i, el) => {
            const srcset = $(el).attr("srcset")?.split(" ")[0];
            if (srcset && !thumbnailUrls.includes(srcset)) {
              thumbnailUrls.push(srcset);
            }
          });

          // 2. Add img src
          const imgSrc = $article.find("img").first().attr("src");
          if (imgSrc && !thumbnailUrls.includes(imgSrc)) {
            thumbnailUrls.push(imgSrc);
          }

          // 3. Add data-src (lazy loading)
          const dataSrc = $article.find("img").first().attr("data-src");
          if (dataSrc && !thumbnailUrls.includes(dataSrc)) {
            thumbnailUrls.push(dataSrc);
          }

          // 4. Constructed URL as fallback (may be incorrect on WeebCentral's CDN)
          const constructedUrl = `https://temp.compsci88.com/cover/normal/${id}.webp`;
          if (!thumbnailUrls.includes(constructedUrl)) {
            thumbnailUrls.push(constructedUrl);
          }

          items.push({
            id,
            slug: name,
            title,
            coverUrl: thumbnailUrls[0],
            coverUrls: thumbnailUrls.slice(0, 5), // Limit to 5 URLs to prevent payload explosion
            links: {
              source: `${BASE_URL}/series/${id}/${name}`,
            },
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
      const cachedName = await this.cache?.get<string>(
        SERIES_CACHE_NAMESPACE,
        mangaId,
      );
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
    this.logger.debug("Fetching manga details", { url });

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      this.logger.debug("Manga details response", {
        status: response.status,
        statusText: response.statusText,
      });
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

      return $li
        .find("a")
        .map((i, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
    };

    const title = $("h1").first().text().trim();
    const description =
      $("section[x-data] p").first().text().trim() ||
      $("section p").first().text().trim() ||
      "No description available.";

    const authorsText = getMetadata("Author(s)");
    const authors = authorsText
      ? authorsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : getMetadataLinks("Author(s)");

    const artistsText = getMetadata("Artist(s)");
    const artists = artistsText
      ? artistsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : getMetadataLinks("Artist(s)");

    const genres =
      getMetadataLinks("Tags(s)") ||
      getMetadataLinks("Genre(s)") ||
      getMetadataLinks("Genres");
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
      this.logger.warn("Failed to fetch chapter list", { mangaId, error: String(error) });
      chapters = [];
    }

    // Extract all cover image sources from <picture> element in priority order
    // Prioritize HTML-extracted URLs over constructed fallbacks
    const coverUrls: string[] = [];

    // 1. Get all <source> elements (priority order, excluding /small/ variants)
    $('picture source[type="image/webp"]').each((i, el) => {
      const srcset = $(el).attr("srcset")?.split(" ")[0];
      if (srcset && !srcset.includes("/small/")) {
        coverUrls.push(srcset);
      }
    });

    // 2. Add <img> fallback
    const imgSrc = $('img[alt*="cover"], img.cover').first().attr("src");
    if (imgSrc && !coverUrls.includes(imgSrc)) {
      coverUrls.push(imgSrc);
    }

    // 3. Add meta tag fallback
    const metaSrc = $('meta[property="og:image"]').attr("content");
    if (metaSrc && !coverUrls.includes(metaSrc)) {
      coverUrls.push(metaSrc);
    }

    // 4. Add /small/ variants
    $('picture source[type="image/webp"]').each((i, el) => {
      const srcset = $(el).attr("srcset")?.split(" ")[0];
      if (srcset && srcset.includes("/small/") && !coverUrls.includes(srcset)) {
        coverUrls.push(srcset);
      }
    });

    // 5. Constructed URL as last resort fallback (may be incorrect on WeebCentral's CDN)
    const constructedUrl = `https://temp.compsci88.com/cover/normal/${mangaId}.webp`;
    if (!coverUrls.includes(constructedUrl)) {
      coverUrls.push(constructedUrl);
    }

    // Use first URL as primary, keep array for fallbacks
    const coverUrl = coverUrls[0];

    return {
      id: mangaId,
      slug: metadata?.name,
      title,
      description,
      coverUrl,
      coverUrls,
      authors,
      artists: artists.length > 0 ? artists : authors,
      chapters,
      genres,
      tags: [],
      rating: undefined,
      year: released ? parseInt(released) : undefined,
      links: {
        source: url,
      },
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
    seriesId: string,
  ): Promise<NonNullable<MangaDetails["chapters"]>> {
    const cacheKey = `${seriesId}:v2`;
    if (this.cache) {
      try {
        const cached = await this.cache.get<
          NonNullable<MangaDetails["chapters"]>
        >(CHAPTER_CACHE_NAMESPACE, cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
      } catch (error) {
        this.logger.warn("Failed to read cached chapters", { seriesId, error: String(error) });
      }
    }

    const url = `${BASE_URL}/series/${seriesId}/full-chapter-list`;
    this.logger.debug("Fetching chapter list", { url });

    const html = await this.rateLimiter.throttle(async () => {
      const response = await fetch(url, { headers: HEADERS });
      this.logger.debug("Chapter list response", {
        status: response.status,
        statusText: response.statusText,
      });
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
          if (
            /^\d+\s+(?:minutes|minute|hours|hour|days|day)\s+ago$/i.test(text)
          )
            return;
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
      if (
        !chapterText ||
        chapterText.includes("{") ||
        chapterText.includes(".st0")
      ) {
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
          const chapterNumber = numberMatch
            ? numberMatch[1]
            : String(chapters.length + 1);

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
          this.logger.warn("Failed to cache chapters", { seriesId, error: String(error) });
        });
    }

    return ordered;
  }

  async getChapterPages(chapterId: string): Promise<ChapterPages> {
    const images = await this.fetchChapterPageList(chapterId);

    // Ensure images is always an array
    if (!images || !Array.isArray(images)) {
      this.logger.error("Invalid chapter page data", {
        chapterId,
        receivedData: images,
      });
      return {
        chapterId,
        mangaId: "",
        pages: [],
      };
    }

    return {
      chapterId,
      mangaId: "",
      pages: images,
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
      pages: slice,
      hasMore: end < totalPages,
    };
  }
}

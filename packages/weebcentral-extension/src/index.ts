import type {
  ExtensionModule,
  CatalogueResponse,
  ExtensionFilters,
} from "@jamra/extension-sdk";
import { WeebCentralScraper } from "./scraper.js";
import { RateLimiter } from "./rate-limiter.js";

const rateLimiter = new RateLimiter({
  requestsPerSecond: 2,
  maxConcurrentImages: 10,
});

const scraper = new WeebCentralScraper(rateLimiter);

const extension: ExtensionModule = {
  manifest: {
    id: "com.weebcentral.manga",
    name: "WeebCentral",
    version: "1.0.0",
    author: { name: "JAMRA Team" },
    languageCodes: ["en"],
    capabilities: {
      catalogue: true,
      mangaDetails: true,
      chapters: true,
      pages: true,
      search: true,
      settings: false,
    },
    description:
      "WeebCentral manga source (formerly MangaSee). Comprehensive manga library with official and fan scanlations.",
    source: {
      baseUrl: "https://weebcentral.com",
    },
  },
  handlers: {
    async catalogue(context, request) {
      scraper.setCache(context.cache);

      // Check if hot-updates are requested via filters
      const useHotUpdates = request.filters?.useHotUpdates === true;

      console.log('[WeebCentral] Catalogue request:', {
        page: request.page,
        query: request.query,
        filters: request.filters,
        useHotUpdates
      });

      const result = useHotUpdates
        ? await scraper.getHotUpdates(request.page)
        : await scraper.searchManga(
            request.query || "",
            request.page,
            request.filters,
          );

      console.log('[WeebCentral] Returning', result.items.length, 'items, first:', result.items[0]?.title);

      const response: CatalogueResponse = {
        items: result.items,
        hasMore: result.hasMore,
      };
      return response;
    },

    async search(context, request) {
      scraper.setCache(context.cache);
      const result = await scraper.searchManga(
        request.query || "",
        request.page,
        request.filters,
      );
      const response: CatalogueResponse = {
        items: result.items,
        hasMore: result.hasMore,
      };
      return response;
    },

    async fetchMangaDetails(context, request) {
      scraper.setCache(context.cache);
      const details = await scraper.getMangaDetails(request.mangaId);
      return details;
    },

    async fetchChapters(context, request) {
      scraper.setCache(context.cache);
      const details = await scraper.getMangaDetails(request.mangaId);
      return details.chapters || [];
    },

    async fetchChapterPages(context, request) {
      scraper.setCache(context.cache);
      const pages = await scraper.getChapterPages(request.chapterId);
      return pages;
    },

    async fetchChapterPagesChunk(context, request) {
      scraper.setCache(context.cache);
      return scraper.getChapterPagesChunk(
        request.mangaId,
        request.chapterId,
        request.chunk,
        request.chunkSize,
      );
    },

    async getFilters() {
      const filters: ExtensionFilters = {
        definitions: [
          {
            type: "select",
            id: "sort",
            label: "Sort",
            defaultValue: "Popularity",
            options: [
              { value: "Popularity", label: "Popularity" },
              { value: "Latest Updates", label: "Latest Updates" },
              { value: "Recently Added", label: "Recently Added" },
              { value: "Alphabet", label: "Alphabetical" },
              { value: "Subscribers", label: "Subscribers" },
            ],
          },
          {
            type: "toggle",
            id: "useHotUpdates",
            label: "Hot Updates Only",
            truthyLabel: "Show Hot Updates",
            falsyLabel: "Show All",
            defaultValue: false,
          },
          {
            type: "multi-select",
            id: "status",
            label: "Status",
            options: [
              { value: "Ongoing", label: "Ongoing" },
              { value: "Complete", label: "Complete" },
              { value: "Hiatus", label: "Hiatus" },
              { value: "Canceled", label: "Canceled" },
            ],
          },
          {
            type: "multi-select",
            id: "type",
            label: "Type",
            options: [
              { value: "Manga", label: "Manga (Japanese)" },
              { value: "Manhwa", label: "Manhwa (Korean)" },
              { value: "Manhua", label: "Manhua (Chinese)" },
              { value: "OEL", label: "OEL (English)" },
            ],
          },
          {
            type: "multi-select",
            id: "genres",
            label: "Genres (Include)",
            options: [
              { value: "Action", label: "Action" },
              { value: "Adventure", label: "Adventure" },
              { value: "Comedy", label: "Comedy" },
              { value: "Drama", label: "Drama" },
              { value: "Ecchi", label: "Ecchi" },
              { value: "Fantasy", label: "Fantasy" },
              { value: "Horror", label: "Horror" },
              { value: "Isekai", label: "Isekai" },
              { value: "Martial Arts", label: "Martial Arts" },
              { value: "Mecha", label: "Mecha" },
              { value: "Mystery", label: "Mystery" },
              { value: "Psychological", label: "Psychological" },
              { value: "Romance", label: "Romance" },
              { value: "School Life", label: "School Life" },
              { value: "Sci-fi", label: "Sci-fi" },
              { value: "Seinen", label: "Seinen" },
              { value: "Shoujo", label: "Shoujo" },
              { value: "Shounen", label: "Shounen" },
              { value: "Slice of Life", label: "Slice of Life" },
              { value: "Sports", label: "Sports" },
              { value: "Supernatural", label: "Supernatural" },
            ],
          },
          {
            type: "multi-select",
            id: "excludeGenres",
            label: "Genres (Exclude)",
            options: [
              { value: "Action", label: "Action" },
              { value: "Adventure", label: "Adventure" },
              { value: "Comedy", label: "Comedy" },
              { value: "Drama", label: "Drama" },
              { value: "Ecchi", label: "Ecchi" },
              { value: "Fantasy", label: "Fantasy" },
              { value: "Horror", label: "Horror" },
              { value: "Hentai", label: "Hentai" },
              { value: "Adult", label: "Adult" },
              { value: "Smut", label: "Smut" },
            ],
          },
        ],
      };
      return filters;
    },
  },
};

export default extension;

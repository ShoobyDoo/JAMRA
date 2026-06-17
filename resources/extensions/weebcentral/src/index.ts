import type {
  Chapter,
  ChapterPayload,
  ExtensionModule,
  ExtensionSettingsValues,
  MangaDetailsPayload,
  MangaDetailsResult,
  MangaSearchResult,
  SearchPayload,
} from "@jamra/contracts";
import {
  createSearchController,
  defineExtensionManifest,
  SettingsBinder,
  type FilterNormalizationContext,
  type SettingsAccessors,
} from "@jamra/extension-sdk";
import manifestJson from "../manifest.json" with { type: "json" };
import {
  FILTER_FLAGS,
  HOT_SORTS,
  SEARCH_ORDERS,
  SEARCH_SORTS,
  WeebCentralClient,
  type CatalogSearchFilters,
  type HotSort,
  type SearchOrder,
  type SearchSort,
} from "./client.ts";

type ExtensionMode = "hot" | "search";

interface NormalizedFilters extends Record<string, unknown> {
  hotSort: HotSort;
  catalog: CatalogSearchFilters;
}

const DEFAULT_MODE: ExtensionMode = "hot";
const DEFAULT_HOT_SORT: HotSort = "monthly_views";
const DEFAULT_SEARCH_SORT: SearchSort = "Best Match";
const POPULARITY_SORT: SearchSort = "Popularity";
const DEFAULT_ORDER: SearchOrder = "Descending";
const MAX_CONCURRENCY = 6;

const manifestConfig = defineExtensionManifest(manifestJson);

const searchController = createSearchController<
  ExtensionMode,
  NormalizedFilters
>({
  modes: ["hot", "search"],
  defaultMode: DEFAULT_MODE,
  hotMode: "hot",
  searchMode: "search",
  initialState: () => ({
    hotSort: DEFAULT_HOT_SORT,
    catalog: {
      sort: DEFAULT_SEARCH_SORT,
      order: DEFAULT_ORDER,
      official: "Any",
      anime: "Any",
      adult: "Any",
      includedStatus: [],
      includedTypes: [],
      includedTags: [],
      excludedTags: [],
    },
  }),
  filters: [
    {
      key: "hotSort",
      kind: "enum",
      values: HOT_SORTS,
      default: DEFAULT_HOT_SORT,
      aliases: ["hotSort", "hot_sort"],
    },
    {
      key: "catalog.sort",
      kind: "enum",
      values: SEARCH_SORTS,
      default: (ctx: FilterNormalizationContext<ExtensionMode>) =>
        ctx.query.length > 0 ? DEFAULT_SEARCH_SORT : POPULARITY_SORT,
      aliases: ["sort"],
    },
    {
      key: "catalog.order",
      kind: "enum",
      values: SEARCH_ORDERS,
      default: DEFAULT_ORDER,
      aliases: ["order"],
    },
    {
      key: "catalog.official",
      kind: "enum",
      values: FILTER_FLAGS,
      default: "Any",
      aliases: ["official"],
    },
    {
      key: "catalog.anime",
      kind: "enum",
      values: FILTER_FLAGS,
      default: "Any",
      aliases: ["anime"],
    },
    {
      key: "catalog.adult",
      kind: "enum",
      values: FILTER_FLAGS,
      default: "Any",
      aliases: ["adult"],
    },
    {
      key: "catalog.includedStatus",
      kind: "string[]",
      aliases: ["included_status", "includedStatus"],
    },
    {
      key: "catalog.includedTypes",
      kind: "string[]",
      aliases: ["included_type", "includedTypes"],
    },
    {
      key: "catalog.includedTags",
      kind: "string[]",
      aliases: ["included_tag", "includedTag", "includedTags"],
    },
    {
      key: "catalog.excludedTags",
      kind: "string[]",
      aliases: ["excluded_tag", "excludedTag", "excludedTags"],
    },
  ],
});

const resolveExtensionSettings = (
  values: ExtensionSettingsValues,
): SettingsAccessors => {
  return SettingsBinder.from(values ?? {})
    .number("requests.concurrency", {
      min: 1,
      max: MAX_CONCURRENCY,
      default: 3,
      integer: true,
    })
    .string("image.cdnHost", {
      normalize: (value) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      },
    })
    .result();
};

const extension = {
  manifest: manifestConfig,

  async init(context) {
    context.logger.info("WeebCentral extension ready");
  },

  async search(payload: SearchPayload, context): Promise<MangaSearchResult> {
    const trimmedQuery = payload.query?.trim() ?? "";
    const searchState = searchController.normalize(
      payload.filters,
      trimmedQuery,
    );
    const filters = searchState.filters;
    const client = new WeebCentralClient(context);

    if (searchController.shouldHydrateHot(searchState)) {
      const settings = resolveExtensionSettings(context.settings);
      const concurrency =
        settings.getNumber("requests.concurrency") ??
        Math.min(3, MAX_CONCURRENCY);
      const results = await client.fetchHotCatalog(
        filters.hotSort,
        concurrency,
      );
      return { results, hasMore: false, totalResults: results.length };
    }

    const results = await client.searchCatalog(
      trimmedQuery,
      payload.page ?? 1,
      filters.catalog,
    );
    return { results, hasMore: false, totalResults: results.length };
  },

  async getMangaDetails(
    payload: MangaDetailsPayload,
    context,
  ): Promise<MangaDetailsResult> {
    const client = new WeebCentralClient(context);
    return client.getSeriesDetails(payload.mangaId, {
      includeChapters: payload.includeChapters !== false,
    });
  },

  async getChapters(payload: MangaDetailsPayload, context): Promise<Chapter[]> {
    const client = new WeebCentralClient(context);
    return client.getChapters(payload.mangaId);
  },

  async getPages(payload: ChapterPayload, context) {
    const client = new WeebCentralClient(context);
    const settings = resolveExtensionSettings(context.settings);
    const cdnHost = settings.getString("image.cdnHost");
    const pages = await client.getPages(payload.mangaId, payload.chapterId, {
      cdnHost,
    });
    return { pages };
  },
} satisfies ExtensionModule;

export default extension;

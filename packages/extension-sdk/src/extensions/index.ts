export { defineExtensionManifest } from "./manifest.js";
export {
  createSearchController,
  type FilterDescriptor,
  type FilterNormalizationContext,
  type SearchController,
  type SearchControllerOptions,
  type SearchControllerResult,
} from "./search-controller.js";
export {
  SettingsBinder,
  type NumberSettingOptions,
  type StringSettingOptions,
  type BooleanSettingOptions,
  type SettingsAccessors,
} from "./settings-binder.js";
export {
  SlugResolver,
  normalizeSlug,
  type SlugResolverOptions,
  type SlugHydrator,
} from "./slug-resolver.js";
export {
  HtmlScraperClient,
  type HtmlScraperClientOptions,
  type HtmlRequestOptions,
} from "./html-scraper-client.js";
export {
  CheerioExtractor,
  type CanonicalFieldOptions,
  type ListFieldOptions,
  type TextFieldOptions,
} from "./cheerio-extractor.js";
export {
  ChapterListBuilder,
  type ChapterListBuilderOptions,
  type ChapterSource,
} from "./chapter-list-builder.js";
export {
  PagePipeline,
  type PagePipelineOptions,
  type PagePipelineFetchOptions,
  type PageTransformer,
} from "./page-pipeline.js";
export {
  LanguageNormalizer,
  normalizeSearchFilters,
  detectUnsupportedFilters,
  pruneUnsupportedFilters,
  stripUnsupportedRawFilters,
  type NormalizedSearchFilters,
  type NormalizedFilterKey,
  type NormalizedSort,
  type NormalizedSortDirection,
  type NormalizedSortField,
} from "./filter-normalizer.js";
export {
  toAbsoluteUrl,
  runLimited,
  extractSlugFromUrl,
  normalizeStatusValue,
  extractChapterNumber,
  type ExtractSlugOptions,
} from "./utils.js";

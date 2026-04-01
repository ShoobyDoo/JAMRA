// Re-export all types from @jamra/contracts
export type {
  LocaleCode,
  NormalizedSearchFilters,
  NormalizedSortField,
  NormalizedSortDirection,
  NormalizedSort,
  NormalizedFilterKey,
  ExtensionCapabilities,
  ExtensionFilterCapabilities,
  ExtensionSettingType,
  ExtensionSettingOption,
  ExtensionSettingField,
  ExtensionSettingsSchema,
  ExtensionSettingsValues,
  ExtensionHttpRequestOptions,
  ExtensionHttpClient,
  ExtensionLogger,
  ExtensionContext,
  ExtensionManifest,
  Manga,
  Chapter,
  Page,
  SearchPayload,
  MangaDetailsPayload,
  ChapterPayload,
  MangaSearchResult,
  MangaDetailsResult,
  PagesResult,
  ExtensionLifecycle,
  ExtensionModule,
} from "@jamra/contracts";

import type { ExtensionModule, ExtensionSettingsSchema } from "@jamra/contracts";

/**
 * @deprecated Use direct export instead
 */
export const createExtension = (module: ExtensionModule): ExtensionModule => {
  return module;
};

/**
 * @deprecated Use direct export instead
 */
export const defineSettings = (
  schema: ExtensionSettingsSchema,
): ExtensionSettingsSchema => schema;

// Export all SDK utilities and helpers
export * from "./extensions/index.js";

export type LanguageCode = string;

export interface ExtensionAuthor {
  name: string;
  url?: string;
  contact?: string;
}

export interface ExtensionCapabilities {
  catalogue: boolean;
  mangaDetails?: boolean;
  chapters?: boolean;
  pages?: boolean;
  search?: boolean;
  settings?: boolean;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  icon?: string;
  author: ExtensionAuthor;
  languageCodes: LanguageCode[];
  capabilities: ExtensionCapabilities;
  tags?: string[];
  source?: {
    baseUrl: string;
    headers?: Record<string, string>;
  };
}

export interface CachedCover {
  dataUrl: string;
  sourceUrl: string;
  updatedAt: string;
  expiresAt?: string;
  mimeType?: string;
  bytes?: number;
}

export interface CatalogueRequest {
  page: number;
  query?: string;
  filters?: Record<string, FilterValue | undefined>;
  signal?: AbortSignal;
}

export interface CatalogueResponse {
  items: MangaSummary[];
  hasMore: boolean;
}

export interface MangaSummary {
  id: string;
  slug?: string;
  title: string;
  altTitles?: string[];
  coverUrl?: string;
  /**
   * Multiple cover image URLs to try in order of priority.
   * First URL is highest quality/preferred, last is lowest quality fallback.
   * If provided, takes precedence over coverUrl.
   */
  coverUrls?: string[];
  cachedCover?: CachedCover;
  description?: string;
  status?: "ongoing" | "completed" | "hiatus" | "cancelled" | "unknown";
  tags?: string[];
  demographic?: "shounen" | "shoujo" | "seinen" | "josei" | "kids" | string;
  languageCode?: LanguageCode;
  updatedAt?: string;
  links?: Record<string, string>;
}

export interface MangaDetails extends MangaSummary {
  authors?: string[];
  artists?: string[];
  chapters?: ChapterSummary[];
  genres?: string[];
  rating?: number;
  year?: number;
  links?: Record<string, string>;
}

export interface ChapterSummary {
  id: string;
  title?: string;
  number?: string;
  volume?: string;
  languageCode?: LanguageCode;
  publishedAt?: string;
  externalUrl?: string;
  scanlators?: string[];
}

export interface PageImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface ChapterPages {
  chapterId: string;
  mangaId: string;
  pages: PageImage[];
}

export interface ChapterPagesChunk {
  chapterId: string;
  mangaId: string;
  chunk: number;
  chunkSize: number;
  totalChunks: number;
  totalPages: number;
  pages: PageImage[];
  hasMore: boolean;
}

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | undefined;

export interface ExtensionFilters {
  definitions: FilterDefinition[];
}

export type FilterDefinition =
  | TextFilterDefinition
  | SelectFilterDefinition
  | MultiSelectFilterDefinition
  | ToggleFilterDefinition
  | StepperFilterDefinition;

export interface BaseFilterDefinition<TType extends string, TValue> {
  type: TType;
  id: string;
  label: string;
  defaultValue?: TValue;
  helperText?: string;
}

export interface TextFilterDefinition
  extends BaseFilterDefinition<"text", string | undefined> {
  placeholder?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFilterDefinition
  extends BaseFilterDefinition<"select", string | undefined> {
  options: SelectOption[];
}

export interface MultiSelectFilterDefinition
  extends BaseFilterDefinition<"multi-select", string[] | undefined> {
  options: SelectOption[];
  maxSelections?: number;
}

export interface ToggleFilterDefinition
  extends BaseFilterDefinition<"toggle", boolean | undefined> {
  truthyLabel?: string;
  falsyLabel?: string;
}

export interface StepperFilterDefinition
  extends BaseFilterDefinition<"stepper", number | undefined> {
  min?: number;
  max?: number;
  step?: number;
}

export interface MangaDetailsRequest {
  mangaId: string;
  signal?: AbortSignal;
}

export interface ChapterListRequest {
  mangaId: string;
  signal?: AbortSignal;
}

export interface ChapterPagesRequest {
  mangaId: string;
  chapterId: string;
  signal?: AbortSignal;
}

export interface ChapterPagesChunkRequest {
  mangaId: string;
  chapterId: string;
  chunk: number;
  chunkSize: number;
  signal?: AbortSignal;
}

export interface ExtensionSettingsSchema {
  fields: SettingsFieldDefinition[];
}

export type SettingsFieldDefinition =
  | SettingsTextField
  | SettingsNumberField
  | SettingsToggleField
  | SettingsSelectField
  | SettingsSecretField;

export interface BaseSettingsField<TType extends string, TValue> {
  type: TType;
  key: string;
  label: string;
  defaultValue?: TValue;
  helperText?: string;
  required?: boolean;
}

export interface SettingsTextField
  extends BaseSettingsField<"text", string | undefined> {
  placeholder?: string;
}

export interface SettingsSecretField
  extends BaseSettingsField<"secret", string | undefined> {
  placeholder?: string;
}

export interface SettingsNumberField
  extends BaseSettingsField<"number", number | undefined> {
  min?: number;
  max?: number;
  step?: number;
}

export interface SettingsToggleField
  extends BaseSettingsField<"toggle", boolean | undefined> {
  truthyLabel?: string;
  falsyLabel?: string;
}

export interface SettingsSelectField
  extends BaseSettingsField<"select", string | undefined> {
  options: SelectOption[];
}

export interface SettingsValidationError {
  field: string;
  message: string;
}

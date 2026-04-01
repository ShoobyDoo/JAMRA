import type {
  ExtensionCapabilities,
  ExtensionFilterCapabilities,
} from "../index.js";

export type NormalizedSortField =
  | "relevance"
  | "alphabetical"
  | "updated"
  | "created"
  | "views"
  | "views_total"
  | "views_year"
  | "views_month"
  | "views_week"
  | "views_day"
  | "views_hour"
  | "subscriptions";

export type NormalizedSortDirection = "asc" | "desc";

export interface NormalizedSort {
  field: NormalizedSortField;
  direction: NormalizedSortDirection;
}

export interface NormalizedSearchFilters {
  language?: string;
  originalLanguage?: string;
  contentRating?: "safe" | "suggestive" | "mature" | "adult";
  status?: "ongoing" | "completed" | "hiatus" | "cancelled";
  includeTags: string[];
  excludeTags: string[];
  sort?: NormalizedSort;
}

export type NormalizedFilterKey = keyof NormalizedSearchFilters;

const LANGUAGE_KEYS = [
  "lang",
  "language",
  "languages",
  "translatedLanguage",
  "tl",
] as const;
const ORIGINAL_LANGUAGE_KEYS = ["originalLanguage", "ol", "orig"] as const;
const CONTENT_RATING_KEYS = ["rating", "contentRating"] as const;
const STATUS_KEYS = ["status", "publicationStatus"] as const;
const INCLUDE_TAG_KEYS = [
  "includeTags",
  "includedTags",
  "include_tags",
  "tags",
  "tag",
  "genres",
  "genre",
] as const;
const EXCLUDE_TAG_KEYS = [
  "excludeTags",
  "excludedTags",
  "exclude_tags",
  "withoutTags",
  "withoutGenres",
  "blockedTags",
] as const;
const SORT_FIELD_KEYS = ["sort", "orderBy"] as const;
const SORT_DIRECTION_KEYS = ["order", "direction", "dir"] as const;

const RAW_FILTER_KEY_MAP: Record<NormalizedFilterKey, readonly string[]> = {
  language: LANGUAGE_KEYS,
  originalLanguage: ORIGINAL_LANGUAGE_KEYS,
  contentRating: CONTENT_RATING_KEYS,
  status: STATUS_KEYS,
  includeTags: INCLUDE_TAG_KEYS,
  excludeTags: EXCLUDE_TAG_KEYS,
  sort: [...SORT_FIELD_KEYS, ...SORT_DIRECTION_KEYS],
};

export const LanguageNormalizer = {
  normalize(value: string | undefined | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const sanitized = value.toString().trim();
    if (!sanitized) {
      return undefined;
    }
    const key = sanitizeLanguageKey(sanitized);
    if (!key) {
      return undefined;
    }
    const mapped = LANGUAGE_ALIASES[key];
    if (mapped) {
      return mapped;
    }
    if (BCP47_TAG_PATTERN.test(key)) {
      return canonicalizeLanguage(key);
    }
    return undefined;
  },
  matches(candidate: string | undefined, target: string | undefined): boolean {
    if (!candidate || !target) {
      return false;
    }
    const normalizedCandidate = this.normalize(candidate);
    const normalizedTarget = this.normalize(target);
    if (!normalizedCandidate || !normalizedTarget) {
      return false;
    }
    if (normalizedCandidate.toLowerCase() === normalizedTarget.toLowerCase()) {
      return true;
    }
    return (
      extractPrimaryLanguage(normalizedCandidate) ===
      extractPrimaryLanguage(normalizedTarget)
    );
  },
};

export const normalizeSearchFilters = (
  raw: Record<string, unknown> | undefined,
): NormalizedSearchFilters => {
  const filters: NormalizedSearchFilters = {
    includeTags: [],
    excludeTags: [],
  };
  if (!raw) {
    return filters;
  }

  filters.language = LanguageNormalizer.normalize(
    readFirstString(raw, LANGUAGE_KEYS),
  );
  filters.originalLanguage = LanguageNormalizer.normalize(
    readFirstString(raw, ORIGINAL_LANGUAGE_KEYS),
  );
  filters.contentRating = normalizeContentRating(
    readFirstString(raw, CONTENT_RATING_KEYS),
  );
  filters.status = normalizeStatus(readFirstString(raw, STATUS_KEYS));

  filters.includeTags = normalizeList(readStringList(raw, INCLUDE_TAG_KEYS));
  filters.excludeTags = normalizeList(readStringList(raw, EXCLUDE_TAG_KEYS));
  filters.sort = normalizeSort(
    readFirstString(raw, SORT_FIELD_KEYS),
    readFirstString(raw, SORT_DIRECTION_KEYS),
  );
  return filters;
};

export const detectUnsupportedFilters = (
  capabilities: ExtensionCapabilities | undefined,
  filters: NormalizedSearchFilters,
): string[] => {
  const unsupported: string[] = [];
  const available = capabilities?.filters ?? {};
  const requireCapability = (
    key: keyof ExtensionFilterCapabilities,
    condition: boolean,
  ) => {
    if (!condition) {
      return;
    }
    const supported = available[key];
    if (key === "sort" && filters.sort) {
      const allowed = available.sort;
      if (!Array.isArray(allowed) || !allowed.includes(filters.sort.field)) {
        unsupported.push("sort");
      }
      return;
    }
    if (supported !== true) {
      unsupported.push(key);
    }
  };

  requireCapability("language", Boolean(filters.language));
  requireCapability("language", Boolean(filters.originalLanguage));
  requireCapability("contentRating", Boolean(filters.contentRating));
  requireCapability("status", Boolean(filters.status));
  requireCapability("includeTags", filters.includeTags.length > 0);
  requireCapability("excludeTags", filters.excludeTags.length > 0);
  requireCapability("sort", Boolean(filters.sort));

  return Array.from(new Set(unsupported));
};

export const pruneUnsupportedFilters = (
  capabilities: ExtensionCapabilities | undefined,
  filters: NormalizedSearchFilters,
): { filters: NormalizedSearchFilters; removed: NormalizedFilterKey[] } => {
  const available = capabilities?.filters ?? {};
  const sanitized: NormalizedSearchFilters = {
    ...filters,
    includeTags: [...filters.includeTags],
    excludeTags: [...filters.excludeTags],
  };
  const removed = new Set<NormalizedFilterKey>();

  const drop = (
    key: NormalizedFilterKey,
    condition: boolean,
    action: () => void,
  ): void => {
    if (!condition) {
      return;
    }
    action();
    removed.add(key);
  };

  drop(
    "language",
    Boolean(sanitized.language) && available.language !== true,
    () => {
      sanitized.language = undefined;
    },
  );

  drop(
    "originalLanguage",
    Boolean(sanitized.originalLanguage) && available.language !== true,
    () => {
      sanitized.originalLanguage = undefined;
    },
  );

  drop(
    "contentRating",
    Boolean(sanitized.contentRating) && available.contentRating !== true,
    () => {
      sanitized.contentRating = undefined;
    },
  );

  drop("status", Boolean(sanitized.status) && available.status !== true, () => {
    sanitized.status = undefined;
  });

  drop(
    "includeTags",
    sanitized.includeTags.length > 0 && available.includeTags !== true,
    () => {
      sanitized.includeTags = [];
    },
  );

  drop(
    "excludeTags",
    sanitized.excludeTags.length > 0 && available.excludeTags !== true,
    () => {
      sanitized.excludeTags = [];
    },
  );

  if (sanitized.sort) {
    const allowed = available.sort;
    const supported =
      Array.isArray(allowed) && allowed.includes(sanitized.sort.field);
    drop("sort", !supported, () => {
      sanitized.sort = undefined;
    });
  }

  return { filters: sanitized, removed: Array.from(removed) };
};

export const stripUnsupportedRawFilters = (
  raw: Record<string, unknown> | undefined,
  removedKeys: NormalizedFilterKey[],
): Record<string, unknown> | undefined => {
  if (!raw || removedKeys.length === 0) {
    return raw;
  }
  let clone: Record<string, unknown> | undefined;
  const ensureClone = (): Record<string, unknown> => {
    if (!clone) {
      clone = { ...raw };
    }
    return clone;
  };
  for (const key of removedKeys) {
    const aliases = RAW_FILTER_KEY_MAP[key];
    if (!aliases) {
      continue;
    }
    for (const alias of aliases) {
      const target = clone ?? raw;
      if (Object.prototype.hasOwnProperty.call(target, alias)) {
        const working = ensureClone();
        delete working[alias];
      }
    }
  }
  return clone ?? raw;
};

const normalizeSort = (
  rawField: string | undefined,
  rawDirection: string | undefined,
): NormalizedSort | undefined => {
  if (!rawField) {
    return undefined;
  }
  const lowered = rawField.toLowerCase();
  const shorthand = lowered.replace(/\./g, "_");
  const splitKey = lowered.split(/[:.]/)[0] ?? lowered;
  const normalizedField =
    SORT_ALIASES[lowered] ??
    SORT_ALIASES[shorthand] ??
    SORT_ALIASES[splitKey] ??
    lowered;
  if (!isSortField(normalizedField)) {
    return undefined;
  }
  const direction = normalizeSortDirection(rawDirection);
  return { field: normalizedField, direction };
};

const normalizeSortDirection = (
  raw: string | undefined,
): NormalizedSortDirection => {
  if (!raw) {
    return "desc";
  }
  const lower = raw.toLowerCase();
  if (["asc", "ascending", "a", "up"].includes(lower)) {
    return "asc";
  }
  return "desc";
};

const normalizeStatus = (
  raw: string | undefined,
): NormalizedSearchFilters["status"] => {
  if (!raw) {
    return undefined;
  }
  const normalized = STATUS_ALIASES[raw.toLowerCase()];
  return normalized ?? undefined;
};

const normalizeContentRating = (
  raw: string | undefined,
): NormalizedSearchFilters["contentRating"] => {
  if (!raw) {
    return undefined;
  }
  const normalized = CONTENT_RATING_ALIASES[raw.toLowerCase()];
  return normalized ?? undefined;
};

const readFirstString = (
  raw: Record<string, unknown>,
  keys: readonly string[],
): string | undefined => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value)) {
      const first = value.find(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      );
      if (first) {
        return first;
      }
    }
  }
  return undefined;
};

const readStringList = (
  raw: Record<string, unknown>,
  keys: readonly string[],
): string[] => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") {
      return value.split(",");
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry : undefined))
        .filter((entry): entry is string => Boolean(entry));
    }
  }
  return [];
};

const normalizeList = (values: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const canonical = trimmed.toLowerCase();
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    normalized.push(trimmed);
  }
  return normalized;
};

const isSortField = (value: string): value is NormalizedSortField => {
  return SORT_FIELDS.has(value as NormalizedSortField);
};

const SORT_FIELDS = new Set<NormalizedSortField>([
  "relevance",
  "alphabetical",
  "updated",
  "created",
  "views",
  "views_total",
  "views_year",
  "views_month",
  "views_week",
  "views_day",
  "views_hour",
  "subscriptions",
]);

const SORT_ALIASES: Record<string, NormalizedSortField> = {
  relevance: "relevance",
  popular: "views",
  popularity: "views",
  views: "views",
  view: "views",
  "views-total": "views_total",
  views_all: "views_total",
  views_a: "views_total",
  "views_a.za": "views_total",
  views_total: "views_total",
  total: "views_total",
  "views-year": "views_year",
  views_y: "views_year",
  "views_y.za": "views_year",
  yearly: "views_year",
  "views-month": "views_month",
  views_m: "views_month",
  "views_m.za": "views_month",
  monthly: "views_month",
  "views-week": "views_week",
  views_w: "views_week",
  "views_w.za": "views_week",
  weekly: "views_week",
  "views-day": "views_day",
  views_d: "views_day",
  "views_d.za": "views_day",
  daily: "views_day",
  "views-hour": "views_hour",
  views_h: "views_hour",
  "views_h.za": "views_hour",
  hourly: "views_hour",
  subscribers: "subscriptions",
  subscriptions: "subscriptions",
  favorite: "subscriptions",
  favourites: "subscriptions",
  favorites: "subscriptions",
  alphabet: "alphabetical",
  alphabetical: "alphabetical",
  title: "alphabetical",
  az: "alphabetical",
  "a-z": "alphabetical",
  updated: "updated",
  latest: "updated",
  recent: "updated",
  create: "created",
  created: "created",
  added: "created",
};

const STATUS_ALIASES: Record<string, NormalizedSearchFilters["status"]> = {
  ongoing: "ongoing",
  "on-going": "ongoing",
  publishing: "ongoing",
  completed: "completed",
  complete: "completed",
  hiatus: "hiatus",
  paused: "hiatus",
  cancelled: "cancelled",
  canceled: "cancelled",
  dropped: "cancelled",
};

const CONTENT_RATING_ALIASES: Record<
  string,
  NormalizedSearchFilters["contentRating"]
> = {
  safe: "safe",
  clean: "safe",
  suggestive: "suggestive",
  teen: "suggestive",
  mature: "mature",
  erotica: "mature",
  adult: "adult",
  nsfw: "adult",
  hentai: "adult",
};

const BCP47_TAG_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

const CANONICAL_LANGUAGE_CODES = {
  ar: "ar",
  cs: "cs",
  de: "de",
  en: "en",
  "en-us": "en-US",
  "en-gb": "en-GB",
  "en-ca": "en-CA",
  es: "es",
  "es-419": "es-419",
  fil: "fil",
  fr: "fr",
  "fr-ca": "fr-CA",
  hu: "hu",
  id: "id",
  it: "it",
  ja: "ja",
  ko: "ko",
  ms: "ms",
  nl: "nl",
  pl: "pl",
  pt: "pt",
  "pt-br": "pt-BR",
  ro: "ro",
  ru: "ru",
  th: "th",
  tr: "tr",
  uk: "uk",
  vi: "vi",
  zh: "zh",
  "zh-hans": "zh-Hans",
  "zh-hant": "zh-Hant",
  "zh-hk": "zh-HK",
  "zh-tw": "zh-TW",
} as const;

type CanonicalLanguageKey = keyof typeof CANONICAL_LANGUAGE_CODES;

const LANGUAGE_ALIAS_GROUPS: Partial<
  Record<CanonicalLanguageKey, readonly string[]>
> = {
  ar: ["arabic"],
  cs: ["czech"],
  de: ["german"],
  en: ["english", "eng"],
  "en-ca": ["english-ca", "canadian-english", "english (ca)"],
  "en-gb": [
    "english-uk",
    "british-english",
    "british",
    "uk-english",
    "english (uk)",
  ],
  "en-us": [
    "english-us",
    "american-english",
    "american",
    "us-english",
    "english (us)",
  ],
  es: ["spanish", "spanish-es", "espanol"],
  "es-419": [
    "spanish (latam)",
    "spanish-latam",
    "spanish-la",
    "latin-american-spanish",
    "latam",
    "es_419",
    "es419",
    "latam-spanish",
    "espanol-latam",
    "espanol-la",
  ],
  fil: ["filipino", "tagalog"],
  fr: ["french", "francais"],
  "fr-ca": ["french-ca", "canadian-french", "francais-canada"],
  hu: ["hungarian"],
  id: ["indonesian", "bahasa", "bahasa-indonesia"],
  it: ["italian"],
  ja: ["japanese"],
  ko: ["korean"],
  ms: ["malay", "bahasa-melayu", "bahasa-malaysia", "malaysian"],
  nl: ["dutch", "nederlands"],
  pl: ["polish", "polski"],
  pt: ["portuguese", "portuguese-pt", "portugues"],
  "pt-br": [
    "ptbr",
    "pt_br",
    "portuguese-br",
    "portuguese (br)",
    "brazilian-portuguese",
    "brazilian",
    "portugues-br",
    "portugues (br)",
  ],
  ro: ["romanian", "romana"],
  ru: ["russian"],
  th: ["thai"],
  tr: ["turkish"],
  uk: ["ukrainian"],
  vi: ["vietnamese", "viet"],
  zh: ["chinese", "zh-cn", "zh_cn", "chinese-mainland"],
  "zh-hans": [
    "chinese-simplified",
    "simplified-chinese",
    "chinese (simplified)",
    "zh_hans",
    "zhhans",
  ],
  "zh-hant": [
    "chinese-traditional",
    "traditional-chinese",
    "chinese (traditional)",
    "zh_hant",
    "zhhant",
  ],
  "zh-hk": [
    "zh_hk",
    "hong-kong",
    "hongkong",
    "chinese-hk",
    "chinese-hong-kong",
  ],
  "zh-tw": ["zh_tw", "taiwan", "taiwanese", "chinese-taiwan"],
};

const LANGUAGE_ALIASES = buildLanguageAliasMap(
  CANONICAL_LANGUAGE_CODES,
  LANGUAGE_ALIAS_GROUPS,
);

function buildLanguageAliasMap(
  canonical: Record<string, string>,
  aliasGroups: Partial<Record<string, readonly string[]>>,
): Record<string, string> {
  const lookup: Record<string, string> = {};
  const keys = Object.keys(canonical) as CanonicalLanguageKey[];
  for (const key of keys) {
    const canonicalValue = canonicalizeLanguage(canonical[key]);
    const sanitizedKey = sanitizeLanguageKey(key);
    if (sanitizedKey) {
      lookup[sanitizedKey] = canonicalValue;
    }
    const sanitizedCanonical = sanitizeLanguageKey(canonicalValue);
    if (sanitizedCanonical) {
      lookup[sanitizedCanonical] = canonicalValue;
    }
    const aliases = aliasGroups[key] ?? [];
    for (const alias of aliases) {
      const sanitizedAlias = sanitizeLanguageKey(alias);
      if (!sanitizedAlias) {
        continue;
      }
      lookup[sanitizedAlias] = canonicalValue;
    }
  }
  return lookup;
}

function sanitizeLanguageKey(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalizeLanguage(value: string): string {
  const segments = value.split(/[-_]/).filter(Boolean);
  if (segments.length === 0) {
    return value.toLowerCase();
  }
  const normalized = segments.map((segment, index) => {
    if (index === 0) {
      return segment.toLowerCase();
    }
    if (segment.length === 4 && /^[a-z]+$/i.test(segment)) {
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    }
    if (segment.length === 2 && /^[a-z]{2}$/i.test(segment)) {
      return segment.toUpperCase();
    }
    if (/^\d{3}$/.test(segment)) {
      return segment.toUpperCase();
    }
    return segment.toLowerCase();
  });
  return normalized.join("-");
}

function extractPrimaryLanguage(value: string): string {
  return value.split("-")[0]?.toLowerCase() ?? value.toLowerCase();
}

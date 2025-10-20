/**
 * UI layout constants
 */
export const SIDEBAR_WIDTH = {
  COLLAPSED: 64,
  EXPANDED: 260,
} as const;

export const HEADER_HEIGHT = 56; // px (h-14 in Tailwind)
export const HEADER_HEIGHT_CLASS = "h-14";

export const CONTENT_MAX_WIDTH = "max-w-6xl"; // Tailwind class

export const MANGA_COVER_ASPECT = "3/4"; // width/height ratio

/**
 * Animation/transition constants
 */
export const TRANSITION_DURATION = {
  DEFAULT: "300", // ms - for Tailwind duration-300
  FAST: "150",
  SLOW: "500",
} as const;

/**
 * API configuration
 */
export const API_CONFIG = {
  DEFAULT_PORT: 4545,
  DEFAULT_HOST: "localhost",
  get DEFAULT_URL() {
    return `http://${this.DEFAULT_HOST}:${this.DEFAULT_PORT}`;
  },
} as const;

/**
 * Common style patterns
 */
export const STYLES = {
  CARD_CONTAINER: "overflow-hidden rounded-lg border border-border bg-card",
  CARD_HOVER: "shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
  IMAGE_HOVER: "transition duration-300 hover:scale-105",
  TEXT_TRUNCATE: "block max-w-full truncate",
  TEXT_TRUNCATE_INLINE: "max-w-full truncate",
  BADGE_COUNTER:
    "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-0 text-[0.625rem] leading-4",
  get CARD() {
    return `${this.CARD_CONTAINER} ${this.CARD_HOVER}`;
  },
} as const;

export const TIMEOUTS = {
  HYDRATION: 2000,
  IMAGE_REFRESH: 3000,
} as const;

export const DOWNLOAD_HISTORY_LIMIT = 100;

export const DOWNLOAD_THRESHOLDS = {
  FROZEN_INITIAL_MS: 30_000,
  FROZEN_SLOW_MS: 120_000,
  FROZEN_MIN_PROGRESS_PERCENT: 10,
} as const;

export const CACHE_DEFAULTS = {
  ENABLED: true,
  TTL_DAYS: 7,
  MAX_ENTRIES: 32,
} as const;

export const COVER_REPORT_LIMITS = {
  MAX_PAYLOAD_BYTES: 40 * 1024,
  FALLBACK_MAX_BYTES: 30 * 1024,
  BASE_JSON_OVERHEAD: 200,
  MAX_URL_OVERHEAD: 10,
  MIN_URLS: 10,
  FALLBACK_MIN_URLS: 5,
  MERGED_MAX_BYTES: 80 * 1024,
} as const;

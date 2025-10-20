/**
 * Server configuration constants
 */
export const SERVER_CONFIG = {
  /** Default API server port */
  DEFAULT_PORT: 4545,

  /** Timeout for SSE heartbeat in milliseconds */
  SSE_HEARTBEAT_INTERVAL_MS: 15000,

  /** Maximum request timeout in milliseconds */
  REQUEST_TIMEOUT_MS: 120000,
} as const;

/**
 * Offline storage and download configuration
 */
export const OFFLINE_CONFIG = {
  /** Number of concurrent downloads */
  DOWNLOAD_CONCURRENCY: 3,

  /** Download worker polling interval in milliseconds */
  DOWNLOAD_POLL_INTERVAL_MS: 1000,

  /** Download retry attempts */
  MAX_RETRY_ATTEMPTS: 3,

  /** Download timeout in milliseconds */
  DOWNLOAD_TIMEOUT_MS: 30000,
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /** Default number of items to return in paginated cache results */
  DEFAULT_LIMIT: 12,

  /** Maximum number of items to return in paginated cache results */
  MAX_LIMIT: 50,

  /** Cover image fetch timeout in milliseconds */
  COVER_FETCH_TIMEOUT_MS: 8000,

  /** Default cover cache TTL in days */
  DEFAULT_COVER_CACHE_TTL_DAYS: 30,

  /** Maximum cover cache entries */
  DEFAULT_MAX_CACHE_ENTRIES: 500,
} as const;

/**
 * History configuration
 */
export const HISTORY_CONFIG = {
  /** Default history entry limit */
  DEFAULT_LIMIT: 50,

  /** Maximum history entry limit */
  MAX_LIMIT: 500,
} as const;

/**
 * Extension configuration
 */
export const EXTENSION_CONFIG = {
  /** Extension load timeout in milliseconds */
  LOAD_TIMEOUT_MS: 10000,
} as const;

/**
 * Environment variable keys
 */
export const ENV_KEYS = {
  JAMRA_API_PORT: "JAMRA_API_PORT",
  JAMRA_NEXT_PORT: "JAMRA_NEXT_PORT",
  JAMRA_EXTENSION_PATH: "JAMRA_EXTENSION_PATH",
  JAMRA_EXTENSION_ID: "JAMRA_EXTENSION_ID",
  JAMRA_DISABLE_SQLITE: "JAMRA_DISABLE_SQLITE",
  JAMRA_DATA_DIR: "JAMRA_DATA_DIR",
  JAMRA_EXTENSION_REGISTRIES: "JAMRA_EXTENSION_REGISTRIES",
  JAMRA_EXTENSION_REGISTRIES_JSON: "JAMRA_EXTENSION_REGISTRIES_JSON",
  NEXT_PUBLIC_JAMRA_API_URL: "NEXT_PUBLIC_JAMRA_API_URL",
  LOG_LEVEL: "LOG_LEVEL",
  NODE_ENV: "NODE_ENV",
} as const;

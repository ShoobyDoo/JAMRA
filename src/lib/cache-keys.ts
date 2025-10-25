/**
 * Centralized localStorage cache keys for JAMRA.
 *
 * This file documents all localStorage keys used in the application
 * and provides utilities for managing them during operations like nuke.
 */

/**
 * Cache keys that contain USER DATA and should be cleared during nuke operations.
 * These typically duplicate data that's also stored in the database.
 */
export const USER_DATA_CACHE_KEYS = {
  /** Cover image URL fallback cache (AutoRefreshImage component) - v3 with versioning */
  COVER_URLS: "jamra_cover_urls_v3",
  /** Legacy cover URL cache keys to clean up */
  COVER_URLS_V2: "jamra_cover_urls_v2",
  /** Reading progress cache (Zustand store) */
  READING_PROGRESS: "reader-progress-storage",
} as const;

/**
 * Cache keys that contain USER PREFERENCES and should be PRESERVED during nuke.
 * These represent user interface preferences and settings.
 */
export const USER_PREFERENCE_KEYS = {
  /** Downloads page active tab selection */
  DOWNLOADS_TAB: "downloads-active-tab",
  /** Homepage view mode (card/list) */
  CONTINUE_READING_VIEW: "continue-reading-view",
  /** Sidebar width and collapsed state (Zustand store) */
  UI_STORAGE: "ui-storage",
  /** Global application settings (Zustand store) */
  SETTINGS: "jamra-settings",
  /** Reader mode preferences (Zustand store) */
  READER_SETTINGS: "reader-settings-storage",
} as const;

/**
 * Clears all user data caches from localStorage.
 * This should be called during nuke operations.
 */
export function clearUserDataCaches(): void {
  if (typeof window === "undefined") return;

  Object.values(USER_DATA_CACHE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

/**
 * Clears all localStorage data including preferences.
 * ⚠️ WARNING: This will reset ALL user preferences to defaults!
 */
export function clearAllLocalStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.clear();
}

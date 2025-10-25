"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { logger } from "@/lib/logger";

export interface ImageCacheSettings {
  enabled: boolean;
  /**
   * Cover image cache lifetime in days.
   */
  ttlDays: number;
  /**
   * Maximum number of cached covers to retain locally.
   */
  maxEntries: number;
  /**
   * TTL for remembered working cover URLs (fallback preferences).
   * Defaults to the same value as ttlDays but can be tweaked separately later.
   */
  workingUrlTtlDays: number;
  fetchTimeoutMs: number;
}

interface SettingsState {
  imageCache: ImageCacheSettings;
  imageCacheSynced: boolean;
  devModeEnabled: boolean;
  setImageCache: (settings: Partial<ImageCacheSettings>) => void;
  setDevModeEnabled: (enabled: boolean) => void;
  applyServerImageCacheSettings: (settings: {
    enabled: boolean;
    ttlMs: number;
    maxEntries: number;
    fetchTimeoutMs?: number;
  }) => void;
}

const DEFAULT_IMAGE_CACHE: ImageCacheSettings = {
  enabled: true,
  ttlDays: 7,
  maxEntries: 32,
  workingUrlTtlDays: 7,
  fetchTimeoutMs: 8000,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      imageCache: DEFAULT_IMAGE_CACHE,
      imageCacheSynced: false,
      devModeEnabled: false,
      setImageCache: (settings) =>
        set({
          imageCache: {
            ...get().imageCache,
            ...settings,
            ...(settings.ttlDays !== undefined &&
            settings.workingUrlTtlDays === undefined
              ? { workingUrlTtlDays: settings.ttlDays }
              : null),
          },
        }),
      setDevModeEnabled: (enabled) => set({ devModeEnabled: enabled }),
      applyServerImageCacheSettings: (settings) =>
        set({
          imageCache: {
            ...get().imageCache,
            enabled: settings.enabled,
            ttlDays: settings.ttlMs / (24 * 60 * 60 * 1000),
            workingUrlTtlDays: settings.ttlMs / (24 * 60 * 60 * 1000),
            maxEntries: settings.maxEntries,
            fetchTimeoutMs:
              settings.fetchTimeoutMs ?? get().imageCache.fetchTimeoutMs,
          },
          imageCacheSynced: true,
        }),
    }),
    {
      name: "jamra-settings",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // Prevent automatic hydration to avoid SSR/CSR mismatch
      onRehydrateStorage: () => () => {
        logger.info("Settings store rehydrated", {
          component: "SettingsStore",
          action: "rehydrate",
        });
      },
    },
  ),
);

export const DEFAULT_IMAGE_CACHE_TTL_MS =
  DEFAULT_IMAGE_CACHE.ttlDays * 24 * 60 * 60 * 1000;
export const DEFAULT_WORKING_URL_TTL_MS =
  DEFAULT_IMAGE_CACHE.workingUrlTtlDays * 24 * 60 * 60 * 1000;

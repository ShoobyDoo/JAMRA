"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  _hasHydrated: boolean;
  imageCache: ImageCacheSettings;
  imageCacheSynced: boolean;
  setImageCache: (settings: Partial<ImageCacheSettings>) => void;
  applyServerImageCacheSettings: (settings: {
    enabled: boolean;
    ttlMs: number;
    maxEntries: number;
    fetchTimeoutMs?: number;
  }) => void;
  setHasHydrated: (hydrated: boolean) => void;
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
      _hasHydrated: false,
      imageCache: DEFAULT_IMAGE_CACHE,
      imageCacheSynced: false,
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
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
    }),
    {
      name: "jamra-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export const DEFAULT_IMAGE_CACHE_TTL_MS =
  DEFAULT_IMAGE_CACHE.ttlDays * 24 * 60 * 60 * 1000;
export const DEFAULT_WORKING_URL_TTL_MS =
  DEFAULT_IMAGE_CACHE.workingUrlTtlDays * 24 * 60 * 60 * 1000;

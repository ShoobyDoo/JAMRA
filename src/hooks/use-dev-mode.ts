"use client";

import { useSettingsStore } from "@/store/settings";

/**
 * Hook to access developer mode state.
 * Returns true if developer mode is enabled in settings.
 */
export function useDevMode(): boolean {
  return useSettingsStore((state) => state.devModeEnabled);
}

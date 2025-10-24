"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";

/**
 * Hook that tracks when Zustand stores have been rehydrated from localStorage.
 * Works with manual rehydration triggered by StoreHydration component.
 * Polls hasHydrated() until both stores are ready, with a fallback timeout.
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check if stores are already hydrated
    const checkHydration = () => {
      const uiHydrated = useUIStore.persist?.hasHydrated() ?? true;
      const settingsHydrated = useSettingsStore.persist?.hasHydrated() ?? true;
      return uiHydrated && settingsHydrated;
    };

    // Check immediately
    if (checkHydration()) {
      setIsHydrated(true);
      return;
    }

    // Poll for hydration completion
    const interval = setInterval(() => {
      if (checkHydration()) {
        setIsHydrated(true);
        clearInterval(interval);
      }
    }, 50);

    // Fallback: assume hydrated after timeout
    const timeout = setTimeout(() => {
      setIsHydrated(true);
      clearInterval(interval);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return isHydrated;
}

"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";
import { logger } from "@/lib/logger";

/**
 * Component that manually triggers Zustand store rehydration from localStorage.
 * This is necessary when using `skipHydration: true` in the persist middleware
 * to avoid SSR/CSR hydration mismatches with Next.js 15 + React 19.
 *
 * Place this component early in the component tree, after the first client-side mount.
 */
export function StoreHydration(): null {
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    // Only run once
    if (hasHydratedRef.current) {
      return;
    }
    hasHydratedRef.current = true;

    logger.info("Starting manual store rehydration", {
      component: "StoreHydration",
      action: "rehydrate-start",
    });

    // Manually rehydrate both stores
    // These will load state from localStorage and trigger onRehydrateStorage callbacks
    useUIStore.persist.rehydrate();
    useSettingsStore.persist.rehydrate();

    logger.info("Store rehydration triggered", {
      component: "StoreHydration",
      action: "rehydrate-triggered",
    });
  }, []);

  return null;
}

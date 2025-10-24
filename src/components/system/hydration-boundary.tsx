"use client";

import { useEffect, useRef } from "react";
import { Loader, Stack, Title } from "@mantine/core";
import { fetchCacheSettings } from "@/lib/api";
import { useSettingsStore } from "@/store/settings";
import { useHydration } from "@/hooks/use-hydration";
import { logger } from "@/lib/logger";

export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  const isHydrated = useHydration();
  const imageCacheSynced = useSettingsStore((state) => state.imageCacheSynced);
  const applyServerImageCacheSettings = useSettingsStore(
    (state) => state.applyServerImageCacheSettings
  );
  const logRef = useRef({ cacheSuccess: false, cacheFail: false, ready: false });

  // Sync cache settings from server after stores hydrate
  useEffect(() => {
    if (!isHydrated || imageCacheSynced) {
      return;
    }

    let cancelled = false;

    fetchCacheSettings()
      .then(({ enabled, ttlMs, maxEntries, fetchTimeoutMs }) => {
        if (cancelled) return;
        if (!logRef.current.cacheSuccess) {
          logger.info("Synced cache settings from server", {
            component: "HydrationBoundary",
            action: "cache-settings-synced",
            enabled,
            ttlMs,
            maxEntries,
            fetchTimeoutMs,
          });
          logRef.current.cacheSuccess = true;
        }
        applyServerImageCacheSettings({
          enabled,
          ttlMs,
          maxEntries,
          fetchTimeoutMs,
        });
      })
      .catch((error) => {
        if (!logRef.current.cacheFail) {
          logRef.current.cacheFail = true;
          logger.warn("Failed to load server cache settings", {
            component: "HydrationBoundary",
            action: "sync-cache-settings",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyServerImageCacheSettings, imageCacheSynced, isHydrated]);

  // Log when hydration completes
  useEffect(() => {
    if (isHydrated && !logRef.current.ready) {
      logRef.current.ready = true;
      logger.info("HydrationBoundary rendered children", {
        component: "HydrationBoundary",
        action: "hydrated",
      });
    }
  }, [isHydrated]);

  if (!isHydrated) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <Stack align="center" gap="xl">
          <Title
            order={1}
            className="text-5xl font-bold tracking-[0.05em] text-foreground"
          >
            JAMRA
          </Title>
          <Loader type="bars" size="lg" color="var(--primary)" />
        </Stack>
      </div>
    );
  }

  return <>{children}</>;
}

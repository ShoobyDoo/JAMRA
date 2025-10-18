"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader, Stack, Title } from "@mantine/core";
import { fetchCacheSettings } from "@/lib/api";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";

export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const uiHydrated = useUIStore((state) => state._hasHydrated);
  const settingsHydrated = useSettingsStore((state) => state._hasHydrated);
  const imageCacheSynced = useSettingsStore((state) => state.imageCacheSynced);
  const applyServerImageCacheSettings = useSettingsStore(
    (state) => state.applyServerImageCacheSettings,
  );

  const storesHydrated = useMemo(
    () => uiHydrated && settingsHydrated,
    [uiHydrated, settingsHydrated],
  );

  useEffect(() => {
    if (storesHydrated) {
      setIsHydrated(true);
    }
  }, [storesHydrated]);

  useEffect(() => {
    if (!storesHydrated || imageCacheSynced) {
      return;
    }

    let cancelled = false;

    fetchCacheSettings()
      .then(({ enabled, ttlMs, maxEntries, fetchTimeoutMs }) => {
        if (cancelled) return;
        applyServerImageCacheSettings({
          enabled,
          ttlMs,
          maxEntries,
          fetchTimeoutMs,
        });
      })
      .catch((error) => {
        console.warn("Failed to load cache settings", error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    applyServerImageCacheSettings,
    imageCacheSynced,
    storesHydrated,
  ]);

  useEffect(() => {
    // Failsafe: if hydration takes too long (>2s), show content anyway
    const timeout = setTimeout(() => {
      if (!isHydrated) {
        console.warn("Hydration timeout - forcing render");
        setIsHydrated(true);
      }
    }, 2000);

    return () => clearTimeout(timeout);
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

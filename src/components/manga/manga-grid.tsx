"use client";

import { useMemo } from "react";
import { Skeleton } from "@mantine/core";
import { MangaCard } from "./manga-card";
import type { CatalogueItem } from "@/lib/api";

interface MangaGridProps {
  items: CatalogueItem[];
  extensionId?: string;
  /**
   * Optional flag to render skeleton placeholders instead of cards.
   * Useful when parent needs to keep layout stable during streaming/Suspense.
   */
  isLoading?: boolean;
}

export function MangaGrid({
  items,
  extensionId,
  isLoading = false,
}: MangaGridProps) {
  const hasItems = items.length > 0;

  const skeletonSlots = useMemo(() => {
    if (hasItems) return items.length;
    // default skeleton count for empty state
    return 6;
  }, [hasItems, items.length]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: skeletonSlots }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="rounded-lg border border-border bg-card p-3 space-y-3"
          >
            <Skeleton height={160} radius="md" />
            <Skeleton height={14} width="85%" />
            <Skeleton height={12} width="60%" />
            <Skeleton height={10} width="70%" />
          </div>
        ))}
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="rounded-lg border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
        No manga available yet. Try refreshing or adjusting your filters.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <MangaCard key={item.id} item={item} extensionId={extensionId} />
      ))}
    </div>
  );
}

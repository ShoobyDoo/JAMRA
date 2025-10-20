"use client";

import { Skeleton } from "@mantine/core";
import { cn } from "@/lib/utils";

export interface MangaCardSkeletonProps {
  imageHeight?: number;
  showMeta?: boolean;
  className?: string;
}

export function MangaCardSkeleton({
  imageHeight = 160,
  showMeta = true,
  className,
}: MangaCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 space-y-3",
        className,
      )}
    >
      <Skeleton height={imageHeight} radius="md" />
      <Skeleton height={14} width="85%" />
      <Skeleton height={12} width="60%" />
      {showMeta && <Skeleton height={10} width="70%" />}
    </div>
  );
}

"use client";

import { Skeleton } from "@mantine/core";
import { cn } from "@/lib/utils";

export interface ContinueReadingCardSkeletonProps {
  className?: string;
}

export function ContinueReadingCardSkeleton({
  className,
}: ContinueReadingCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm space-y-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <Skeleton height={128} width={96} radius="md" />
        <div className="flex-1 space-y-3">
          <Skeleton height={18} width="80%" />
          <Skeleton height={14} width="60%" />
          <Skeleton height={10} width="90%" />
          <Skeleton height={10} width="70%" />
          <Skeleton height={10} width="75%" />
        </div>
      </div>
      <Skeleton height={12} width="50%" />
    </div>
  );
}

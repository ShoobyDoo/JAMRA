"use client";

import { cn } from "@/lib/utils";
import {
  MangaCardSkeleton,
  type MangaCardSkeletonProps,
} from "./MangaCardSkeleton";

export interface MangaGridSkeletonProps extends MangaCardSkeletonProps {
  count?: number;
  className?: string;
}

export function MangaGridSkeleton({
  count = 12,
  className,
  ...cardProps
}: MangaGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <MangaCardSkeleton key={index} {...cardProps} />
      ))}
    </div>
  );
}

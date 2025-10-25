"use client";

import { Skeleton } from "@mantine/core";

export default function MangaLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted">
          <Skeleton height="100%" radius="lg" />
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton height={32} width="70%" />
            <Skeleton height={16} width="45%" />
          </div>

          <div className="space-y-3">
            <Skeleton height={12} width="100%" />
            <Skeleton height={12} width="95%" />
            <Skeleton height={12} width="90%" />
            <Skeleton height={12} width="80%" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} height={70} radius="md" />
            ))}
          </div>

          <div className="space-y-2">
            <Skeleton height={16} width="30%" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} height={28} width={80} radius="xl" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton height={24} width={140} />
            <Skeleton height={16} width={200} />
          </div>
          <Skeleton height={36} width={140} radius="lg" />
        </div>

        <Skeleton height={56} radius="md" />

        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="p-4">
              <Skeleton height={16} width="40%" />
              <Skeleton height={12} width="30%" mt={8} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

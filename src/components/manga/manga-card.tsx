"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader } from "@mantine/core";
import type { CatalogueItem } from "@/lib/api";

interface MangaCardProps {
  item: CatalogueItem;
}

export function MangaCard({ item }: MangaCardProps) {
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <Link
      href={`/manga/${encodeURIComponent(item.id)}`}
      onClick={() => setIsNavigating(true)}
      className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg relative"
    >
      {isNavigating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <Loader size="md" />
        </div>
      )}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {item.coverUrl ? (
          <Image
            src={item.coverUrl}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No cover
          </div>
        )}

        {/* Status Badge */}
        {item.status && (
          <div className="absolute top-2 right-2">
            <span className="rounded bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground capitalize backdrop-blur-sm">
              {item.status}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <h2 className="line-clamp-2 text-sm font-semibold leading-tight">
          {item.title}
        </h2>

        {item.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>
        ) : null}

        {/* Tags */}
        {(item.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(item.tags ?? []).slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

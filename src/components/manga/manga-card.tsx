"use client";

import Link from "next/link";
import type { CatalogueItem } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";
import { resolveCoverSources } from "@/lib/cover-sources";

interface MangaCardProps {
  item: CatalogueItem;
  extensionId?: string;
}

export function MangaCard({ item, extensionId }: MangaCardProps) {
  const computedSlug = slugify(item.slug ?? item.title);
  const destination = computedSlug ?? item.id;
  const { primary, fallbacks } = resolveCoverSources(item);

  return (
    <Link
      href={`/manga/${encodeURIComponent(destination)}`}
      className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg cursor-pointer"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {primary ? (
          <AutoRefreshImage
            src={primary}
            fallbackUrls={fallbacks}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            mangaId={item.id}
            extensionId={extensionId}
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

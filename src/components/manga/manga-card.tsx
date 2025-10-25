"use client";

import Link from "next/link";
import type { CatalogueItem } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";
import { resolveCoverSources } from "@/lib/cover-sources";
import { DevBadge } from "@/components/dev/dev-badge";

interface MangaCardProps {
  item: CatalogueItem;
  extensionId?: string;
}

export function MangaCard({ item, extensionId }: MangaCardProps) {
  const computedSlug = slugify(item.slug ?? item.title);
  const destination = computedSlug ?? item.id;
  const { primary, fallbacks } = resolveCoverSources(item);

  const hasMeta = !!item.description || (item.tags ?? []).length > 0;

  return (
    <Link
      href={`/manga/${encodeURIComponent(destination)}`}
      className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 cursor-pointer"
    >
      <div className="relative aspect-3/4 overflow-hidden bg-muted">
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
        <div className="absolute top-2 right-2 flex gap-1">
          {item.status && (
            <span className="rounded bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground capitalize backdrop-blur-sm">
              {item.status}
            </span>
          )}
          <DevBadge
            label="Manga Debug Info"
            info={[
              { label: "Manga ID", value: item.id, copyable: true },
              ...(extensionId
                ? [{ label: "Extension ID", value: extensionId, copyable: true }]
                : []),
              ...(primary
                ? [
                    {
                      label: "Cover URL",
                      value: primary,
                      copyable: true,
                      clickable: true,
                      url: primary,
                    },
                  ]
                : []),
            ]}
          />
        </div>

        {/* Title band: bottom ~2/3 coverage, dithered top edge, title anchored to bottom */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-linear-to-t from-black/90 via-black/70 to-transparent">
          {/* Dithered fade at top edge to melt into the cover */}
          <div
            aria-hidden
            className="
              pointer-events-none absolute left-0 right-0 top-0 h-8
              mask-[linear-gradient(to_bottom,black,transparent)]
              mask-no-repeat mask-size-[100%_100%]
              bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%221%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.05%22/></svg>')]
            "
          />
          <div className="min-h-14 flex items-end">
            <h2
              className="line-clamp-2 text-sm font-semibold leading-tight text-white"
              title={item.title}
            >
              {item.title}
            </h2>
          </div>
        </div>
      </div>

      {/* Meta (render only if present to avoid blank white space on Discover) */}
      {hasMeta && (
        <div className="space-y-2 p-3">
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
      )}
    </Link>
  );
}

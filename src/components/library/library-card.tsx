"use client";

import Link from "next/link";
import { Heart, Star } from "lucide-react";
import type { EnrichedLibraryEntry } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";
import { resolveCoverSources } from "@/lib/cover-sources";
import { Badge } from "@mantine/core";
import { DevBadge } from "@/components/dev/dev-badge";

interface LibraryCardProps {
  entry: EnrichedLibraryEntry;
  priority?: boolean;
}

const STATUS_COLORS = {
  reading: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  plan_to_read: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  dropped: "bg-red-500/10 text-red-500 border-red-500/20",
};

const STATUS_LABELS = {
  reading: "Reading",
  plan_to_read: "Plan to Read",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export function LibraryCard({ entry }: LibraryCardProps) {
  const {
    manga,
    mangaId,
    extensionId,
    status,
    personalRating,
    favorite,
    totalChapters,
    readChapters,
  } = entry;

  const destination = slugify(manga.title) ?? mangaId;
  const { primary: coverPrimary, fallbacks: coverFallbacks } =
    resolveCoverSources({
      ...manga,
      coverUrl: manga.coverUrl ?? undefined,
      coverUrls: manga.coverUrls ?? undefined,
    });

  const progress = totalChapters > 0 ? (readChapters / totalChapters) * 100 : 0;
  const isComplete = readChapters > 0 && readChapters === totalChapters;

  return (
    <Link
      href={`/manga/${encodeURIComponent(destination)}`}
      className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md hover:border-primary/30"
    >
      {/* Cover */}
      <div className="relative aspect-2/3 overflow-hidden bg-muted">
        {coverPrimary ? (
          <AutoRefreshImage
            src={coverPrimary}
            fallbackUrls={coverFallbacks}
            alt={manga.title}
            fill
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            mangaId={mangaId}
            extensionId={extensionId}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <svg
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        )}

        {/* Favorite Badge & Dev Badge */}
        <div className="absolute top-2 right-2 flex gap-1">
          {favorite && (
            <div className="rounded-full bg-red-500/90 p-1.5 shadow-lg">
              <Heart className="h-4 w-4 text-white fill-white" />
            </div>
          )}
          <DevBadge
            label="Library Item Debug Info"
            info={[
              { label: "Manga ID", value: mangaId, copyable: true },
              { label: "Extension ID", value: extensionId, copyable: true },
              ...(coverPrimary
                ? [
                    {
                      label: "Cover URL",
                      value: coverPrimary,
                      copyable: true,
                      clickable: true,
                      url: coverPrimary,
                    },
                  ]
                : []),
            ]}
          />
        </div>

        {/* Status Badge */}
        <div className="absolute top-2 left-2">
          <Badge className={STATUS_COLORS[status]}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>

        {/* Title band (gradient-only by default; stable height + dithered top fade) */}
        <div className="inset-x-0 bottom-0 p-3 bg-linear-to-t from-black/80 via-black/40 to-transparent absolute">
          {/* Dithered fade at top edge to melt into the cover */}
          <div
            aria-hidden
            className="
              pointer-events-none absolute left-0 right-0 top-0 h-6
              mask-[linear-gradient(to_bottom,black,transparent)]
              mask-no-repeat mask-size-[100%_100%]
              bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%221%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.05%22/></svg>')]
            "
          />
          <div className="min-h-14">
            <h3
              className="text-sm font-semibold leading-tight line-clamp-2 text-white group-hover:text-white transition-colors"
              title={manga.title}
            >
              {manga.title}
            </h3>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 space-y-1">
        {/* Rating */}
        {personalRating && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
            <span className="font-medium">{personalRating}/10</span>
          </div>
        )}

        {/* Progress */}
        {status === "reading" && totalChapters > 0 && (
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {readChapters}/{totalChapters}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${
                  isComplete ? "bg-green-500" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === "completed" && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            ✓ {totalChapters} chapters read
          </p>
        )}
      </div>
    </Link>
  );
}

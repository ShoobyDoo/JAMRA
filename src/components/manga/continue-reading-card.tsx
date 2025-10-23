"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertCircle, BookOpen } from "lucide-react";
import { Tooltip } from "@mantine/core";
import type { MangaDetails } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { withChapterSlugs } from "@/lib/chapter-slug";
import { formatChapterTitle, sortChaptersAsc } from "@/lib/chapter-meta";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";
import { resolveCoverSources } from "@/lib/cover-sources";
import { formatTimeAgo } from "@/lib/time";

interface ContinueReadingCardProps {
  manga: MangaDetails | null;
  mangaId: string;
  currentChapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
  error?: string | null;
  extensionId?: string;
  priority?: boolean;
  viewMode?: "card" | "list";
}

export function ContinueReadingCard({
  manga,
  mangaId,
  currentChapterId,
  currentPage,
  totalPages,
  lastReadAt,
  error,
  extensionId,
  priority = false,
  viewMode = "card",
}: ContinueReadingCardProps) {
  // Format last read time
  const timeAgo = formatTimeAgo(lastReadAt);

  const chaptersWithSlugs = useMemo(
    () => withChapterSlugs(manga?.chapters ?? []),
    [manga?.chapters]
  );
  const sortedChaptersAsc = useMemo(
    () => sortChaptersAsc(chaptersWithSlugs),
    [chaptersWithSlugs]
  );

  // Error state - show unavailable manga
  if (error || !manga) {
    return (
      <div className="group relative overflow-hidden rounded-lg border border-destructive/50 bg-card/50 shadow-sm opacity-60">
        <div className="flex gap-4 p-4">
          {/* Cover Image - grayed out */}
          <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            {/* Title & Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <h3 className="truncate font-semibold text-destructive">
                  Unavailable Manga
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">ID: {mangaId}</p>
              <p className="text-xs text-muted-foreground">
                Last read: {timeAgo}
              </p>
            </div>

            {/* Error Details */}
            <div className="mt-2 rounded-md bg-destructive/10 p-2">
              <p className="text-xs text-destructive font-medium">
                {error || "Failed to load manga details"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The extension for this manga may be disabled or unavailable.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Find the current chapter info
  const currentChapter = chaptersWithSlugs.find(
    (ch) => ch.id === currentChapterId
  );

  // Calculate chapter progress
  const totalChapters = sortedChaptersAsc.length;
  const currentChapterIndex = sortedChaptersAsc.findIndex(
    (ch) => ch.id === currentChapterId
  );
  const readChapters = currentChapterIndex >= 0 ? currentChapterIndex + 1 : 0; // +1 because we're currently reading this chapter

  // Calculate page progress percentage
  const pageProgress =
    totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  const destination = slugify(manga.slug ?? manga.title) ?? mangaId;
  const { primary: coverPrimary, fallbacks: coverFallbacks } =
    resolveCoverSources(manga);

  const pageQuery = new URLSearchParams({
    page: String(currentPage),
  }).toString();

  // List view - compact horizontal layout
  if (viewMode === "list") {
    return (
      <div className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30">
        <Link
          href={`/read/${encodeURIComponent(destination)}/chapter/${encodeURIComponent(currentChapter?.slug ?? currentChapterId)}?${pageQuery}`}
          className="flex items-start gap-2.5 p-2.5"
        >
          {/* Cover Image */}
          <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-muted">
            {coverPrimary ? (
              <AutoRefreshImage
                src={coverPrimary}
                fallbackUrls={coverFallbacks}
                alt={manga.title}
                fill
                className="object-cover"
                sizes="56px"
                mangaId={mangaId}
                extensionId={extensionId}
                priority={priority}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <BookOpen className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div>
              <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                {manga.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentChapter
                  ? formatChapterTitle(currentChapter)
                  : `Chapter ${currentChapterId}`}
              </p>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Page {currentPage + 1}/{totalPages}
                </span>
                <span className="font-medium">{Math.round(pageProgress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all"
                  style={{ width: `${pageProgress}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </Link>

        {/* Details button - absolute positioned */}
        <Tooltip label="View manga details" position="left" withArrow>
          <Link
            href={`/manga/${encodeURIComponent(destination)}`}
            className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded bg-background/95 backdrop-blur-sm border border-border hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all shadow-sm text-xs font-medium"
          >
            <BookOpen className="h-3 w-3" />
            <span className="sr-only">Details</span>
          </Link>
        </Tooltip>
      </div>
    );
  }

  // Card view - better responsive design
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      <Link
        href={`/read/${encodeURIComponent(destination)}/chapter/${encodeURIComponent(currentChapter?.slug ?? currentChapterId)}?${pageQuery}`}
        className="block p-2.5"
      >
        <div className="flex gap-2.5">
          {/* Cover Image */}
          <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded bg-muted">
            {coverPrimary ? (
              <AutoRefreshImage
                src={coverPrimary}
                fallbackUrls={coverFallbacks}
                alt={manga.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="96px"
                mangaId={mangaId}
                extensionId={extensionId}
                priority={priority}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <BookOpen className="h-8 w-8" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
            {/* Title & Chapter */}
            <div>
              <h3 className="font-bold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {manga.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {currentChapter
                  ? formatChapterTitle(currentChapter)
                  : `Chapter ${currentChapterId}`}
              </p>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">
                    {Math.round(pageProgress)}%
                  </span>
                  {totalChapters > 0 && (
                    <span className="text-muted-foreground">
                      ({readChapters}/{totalChapters})
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-300"
                  style={{ width: `${pageProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
          </div>
        </div>
      </Link>

      {/* Details Button - Top right corner */}
      <div className="absolute top-2 right-2 z-10">
        <Tooltip label="View manga details" position="left" withArrow>
          <Link
            href={`/manga/${encodeURIComponent(destination)}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1 rounded bg-background/95 backdrop-blur-sm border border-border hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all shadow-sm text-xs font-medium"
          >
            <BookOpen className="h-3 w-3" />
            <span className="sr-only">Details</span>
          </Link>
        </Tooltip>
      </div>
    </div>
  );
}

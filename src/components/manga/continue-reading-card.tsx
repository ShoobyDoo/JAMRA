"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import type { MangaDetails } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { withChapterSlugs } from "@/lib/chapter-slug";
import { formatChapterTitle, sortChaptersAsc } from "@/lib/chapter-meta";
import { AutoRefreshImage } from "@/components/ui/auto-refresh-image";

interface ContinueReadingCardProps {
  manga: MangaDetails | null;
  mangaId: string;
  currentChapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
  error?: string | null;
  extensionId?: string;
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
}: ContinueReadingCardProps) {
  // Format last read time
  const lastReadDate = new Date(lastReadAt);
  const now = new Date();
  const diffMs = now.getTime() - lastReadDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo: string;
  if (diffMins < 1) {
    timeAgo = "Just now";
  } else if (diffMins < 60) {
    timeAgo = `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    timeAgo = `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  } else {
    timeAgo = lastReadDate.toLocaleDateString();
  }

  const chaptersWithSlugs = useMemo(
    () => withChapterSlugs(manga?.chapters ?? []),
    [manga?.chapters],
  );
  const sortedChaptersAsc = useMemo(
    () => sortChaptersAsc(chaptersWithSlugs),
    [chaptersWithSlugs],
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
              <p className="text-sm text-muted-foreground">
                ID: {mangaId}
              </p>
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
  const currentChapter = chaptersWithSlugs.find((ch) => ch.id === currentChapterId);

  // Calculate chapter progress
  const totalChapters = sortedChaptersAsc.length;
  const currentChapterIndex = sortedChaptersAsc.findIndex((ch) => ch.id === currentChapterId);
  const readChapters = currentChapterIndex >= 0 ? currentChapterIndex + 1 : 0; // +1 because we're currently reading this chapter
  const chapterProgress = totalChapters > 0 ? (readChapters / totalChapters) * 100 : 0;

  // Calculate page progress percentage
  const pageProgress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  const destination = slugify(manga.slug ?? manga.title) ?? mangaId;

  const pageQuery = new URLSearchParams({
    page: String(currentPage),
  }).toString();

  return (
    <Link
      href={`/read/${encodeURIComponent(destination)}/chapter/${encodeURIComponent(currentChapter?.slug ?? currentChapterId)}?${pageQuery}`}
      className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
    >
      <div className="flex gap-4 p-4">
        {/* Cover Image */}
        <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {manga.coverUrl ? (
            <AutoRefreshImage
              src={manga.coverUrl}
              alt={manga.title}
              fill
              className="object-cover transition group-hover:scale-105"
              sizes="96px"
              mangaId={mangaId}
              extensionId={extensionId}
              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3C/svg%3E"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          {/* Title & Info */}
          <div className="space-y-1">
            <h3 className="truncate font-semibold text-foreground group-hover:text-primary">
              {manga.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentChapter ? formatChapterTitle(currentChapter) : `Chapter ${currentChapterId}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Page {currentPage + 1} of {totalPages} • {timeAgo}
            </p>
          </div>

          {/* Progress Bars */}
          <div className="space-y-2">
            {/* Page Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Page Progress</span>
                <span>{Math.round(pageProgress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pageProgress}%` }}
                />
              </div>
            </div>

            {/* Chapter Progress */}
            {totalChapters > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Chapter Progress</span>
                  <span>{readChapters} / {totalChapters} chapters</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${chapterProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </Link>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader } from "@mantine/core";
import { getAllReadingProgress } from "@/lib/api";
import type { ReadingProgressData } from "@/lib/api";
import type { ChapterWithSlug } from "@/lib/chapter-slug";
import { formatChapterTitle, sortChaptersDesc } from "@/lib/chapter-meta";

interface ChapterListProps {
  chapters: ChapterWithSlug[];
  mangaId: string;
  mangaSlug: string;
}

export function ChapterList({ chapters, mangaId, mangaSlug }: ChapterListProps) {
  const [progressMap, setProgressMap] = useState<Map<string, ReadingProgressData>>(new Map());
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const allProgress = await getAllReadingProgress();
        // Create a map of chapterId -> progress for this manga only
        const map = new Map<string, ReadingProgressData>();
        allProgress.forEach((progress) => {
          if (progress.mangaId === mangaId) {
            map.set(progress.chapterId, progress);
          }
        });
        setProgressMap(map);
      } catch (error) {
        console.error("Failed to fetch reading progress:", error);
      } finally {
        setLoadingProgress(false);
      }
    }

    fetchProgress();
  }, [mangaId]);

  const getChapterStatus = (chapterId: string) => {
    const progress = progressMap.get(chapterId);
    if (!progress) {
      return { label: "Unread", isRead: false, progress: null };
    }
    // Consider a chapter read if we've reached the last page or are within 1 page of the end
    const isRead = progress.currentPage >= progress.totalPages - 1;
    return {
      label: isRead ? "Read" : "In Progress",
      isRead,
      progress
    };
  };

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {chapters.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No chapters available.
        </div>
      ) : (
        sortChaptersDesc(chapters).map((chapter) => {
          const { label, isRead, progress } = getChapterStatus(chapter.id);
          const hasProgress = progress !== null;
          const progressPercent = hasProgress
            ? Math.round((progress.currentPage / progress.totalPages) * 100)
            : 0;
          const scanlatorNames =
            chapter.scanlators?.filter((name) => name.trim().length > 0) ?? [];
          const scanlatorLabel =
            scanlatorNames.length > 0 ? scanlatorNames.join(", ") : "Unknown";
          const publishedLabel = chapter.publishedAt
            ? new Date(chapter.publishedAt).toLocaleDateString()
            : null;

          return (
            <Link
              key={chapter.id}
              href={`/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(chapter.slug)}`}
              className={`flex items-center justify-between gap-2 p-4 transition hover:bg-secondary relative ${
                hasProgress && !isRead
                  ? "border-l-4 border-l-blue-500"
                  : hasProgress && isRead
                    ? "border-l-4 border-l-green-500"
                    : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">{formatChapterTitle(chapter)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-muted-foreground/90">
                    Scanlator: {scanlatorLabel}
                  </span>
                  {publishedLabel && <span>• {publishedLabel}</span>}
                  {hasProgress && (
                    <span>
                      • {progress.currentPage + 1}/{progress.totalPages} pages
                    </span>
                  )}
                </div>
                {hasProgress && !isRead && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
              {loadingProgress ? (
                <Loader size="xs" />
              ) : (
                <span
                  className={`text-xs font-medium shrink-0 ${
                    isRead
                      ? "text-green-600 dark:text-green-400"
                      : label === "In Progress"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })
      )}
    </div>
  );
}

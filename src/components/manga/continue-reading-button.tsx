"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button, type ButtonProps } from "@mantine/core";
import { BookOpen } from "lucide-react";
import { getAllReadingProgress } from "@/lib/api";
import type { ReadingProgressData } from "@/lib/api";
import type { ChapterWithSlug } from "@/lib/chapter-slug";
import {
  formatChapterTitle,
  getChapterSortValue,
  sortChaptersDesc,
} from "@/lib/chapter-meta";
import { logger } from "@/lib/logger";

interface ContinueReadingButtonProps {
  chapters: ChapterWithSlug[];
  mangaId: string;
  mangaSlug: string;
}

const buttonClassNames: ButtonProps["classNames"] = {
  label:
    "flex w-full flex-col items-start gap-1 text-left whitespace-normal overflow-visible leading-snug",
};

export function ContinueReadingButton({
  chapters,
  mangaId,
  mangaSlug,
}: ContinueReadingButtonProps) {
  const [lastReadChapter, setLastReadChapter] = useState<{
    chapter: ChapterWithSlug;
    progress: ReadingProgressData;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const sortedChapters = useMemo(() => sortChaptersDesc(chapters), [chapters]);

  const earliestChapter = useMemo(() => {
    if (sortedChapters.length === 0) {
      return null;
    }

    const numericCandidates = sortedChapters
      .map((chapter) => ({
        chapter,
        value: getChapterSortValue(chapter),
      }))
      .filter(
        (entry): entry is { chapter: ChapterWithSlug; value: number } =>
          entry.value !== null,
      )
      .sort((a, b) => a.value - b.value);

    if (numericCandidates.length > 0) {
      return numericCandidates[0].chapter;
    }

    return sortedChapters[sortedChapters.length - 1];
  }, [sortedChapters]);

  useEffect(() => {
    async function fetchLastRead() {
      try {
        const allProgress = await getAllReadingProgress();
        // Filter to this manga's progress
        const mangaProgress = allProgress.filter((p) => p.mangaId === mangaId);

        if (mangaProgress.length === 0) {
          setLastReadChapter(null);
          return;
        }

        // Find the most recently read chapter
        const mostRecent = mangaProgress.reduce((prev, current) =>
          current.lastReadAt > prev.lastReadAt ? current : prev,
        );

        // Find the corresponding chapter
        const chapter = sortedChapters.find(
          (ch) => ch.id === mostRecent.chapterId,
        );
        if (chapter) {
          setLastReadChapter({ chapter, progress: mostRecent });
        }
      } catch (error) {
        logger.error("Failed to load continue reading progress", {
          component: "ContinueReadingButton",
          action: "load-progress",
          mangaId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLastRead();
  }, [mangaId, sortedChapters]);

  if (loading) {
    return null;
  }

  if (!lastReadChapter) {
    if (!earliestChapter) {
      return null;
    }

    const startLabel = formatChapterTitle(earliestChapter);

    return (
      <Link
        href={`/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(earliestChapter.slug)}`}
        className="block"
      >
        <Button
          fullWidth
          size="lg"
          leftSection={<BookOpen size={20} />}
          variant="filled"
          h="auto"
          px="lg"
          py="md"
          classNames={buttonClassNames}
        >
          <span className="font-semibold">Start Reading</span>
          <span className="text-xs opacity-90">{startLabel}</span>
        </Button>
      </Link>
    );
  }

  const { chapter, progress } = lastReadChapter;
  const isComplete = progress.currentPage >= progress.totalPages - 1;
  const progressPercent = Math.round(
    (progress.currentPage / progress.totalPages) * 100,
  );

  const pageQuery = new URLSearchParams({
    page: String(progress.currentPage),
  }).toString();

  return (
    <Link
      href={`/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(chapter.slug)}?${pageQuery}`}
      className="block"
    >
      <Button
        fullWidth
        size="lg"
        leftSection={<BookOpen size={20} />}
        variant="filled"
        h="auto"
        px="lg"
        py="md"
        classNames={buttonClassNames}
      >
        <span className="font-semibold">
          {isComplete ? "Read Again" : "Continue Reading"}
        </span>
        <span className="text-xs opacity-90">
          {formatChapterTitle(chapter)}
          {" · "}
          Page {progress.currentPage + 1} of {progress.totalPages}
          {" · "}
          {progressPercent}% complete
        </span>
      </Button>
    </Link>
  );
}

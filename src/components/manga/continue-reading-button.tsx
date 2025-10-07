"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@mantine/core";
import { BookOpen } from "lucide-react";
import { getAllReadingProgress } from "@/lib/api";
import type { ChapterSummary, ReadingProgressData } from "@/lib/api";

interface ContinueReadingButtonProps {
  chapters: ChapterSummary[];
  mangaSlug: string;
}

export function ContinueReadingButton({
  chapters,
  mangaSlug,
}: ContinueReadingButtonProps) {
  const [lastReadChapter, setLastReadChapter] = useState<{
    chapter: ChapterSummary;
    progress: ReadingProgressData;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLastRead() {
      try {
        const allProgress = await getAllReadingProgress();
        // Filter to this manga's progress
        const mangaProgress = allProgress.filter(
          (p) => p.mangaId === mangaSlug
        );

        if (mangaProgress.length === 0) {
          setLastReadChapter(null);
          return;
        }

        // Find the most recently read chapter
        const mostRecent = mangaProgress.reduce((prev, current) =>
          current.lastReadAt > prev.lastReadAt ? current : prev
        );

        // Find the corresponding chapter
        const chapter = chapters.find((ch) => ch.id === mostRecent.chapterId);
        if (chapter) {
          setLastReadChapter({ chapter, progress: mostRecent });
        }
      } catch (error) {
        console.error("Failed to fetch reading progress:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLastRead();
  }, [mangaSlug, chapters]);

  if (loading || !lastReadChapter) {
    return null;
  }

  const { chapter, progress } = lastReadChapter;
  const isComplete = progress.currentPage >= progress.totalPages - 1;
  const progressPercent = Math.round(
    (progress.currentPage / progress.totalPages) * 100
  );

  return (
    <Link
      href={`/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(chapter.id)}`}
      className="block"
    >
      <Button
        fullWidth
        size="lg"
        leftSection={<BookOpen size={20} />}
        variant="filled"
        className="h-auto py-4"
      >
        <div className="flex flex-col items-start gap-1 text-left">
          <span className="font-semibold">
            {isComplete ? "Read Again" : "Continue Reading"}
          </span>
          <span className="text-xs opacity-90">
            {chapter.title ?? `Chapter ${chapter.number ?? chapter.id}`}
            {" · "}
            Page {progress.currentPage + 1} of {progress.totalPages}
            {" · "}
            {progressPercent}% complete
          </span>
        </div>
      </Button>
    </Link>
  );
}

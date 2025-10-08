import assert from "node:assert/strict";
import {
  hydrateProgressWithDetails,
  setFetchMangaDetailsImplementation,
} from "@/lib/reading-history";
import { logger } from "@/lib/logger";
import type { MangaDetails, ReadingProgressData } from "@/lib/api";

function buildProgress(overrides: Partial<ReadingProgressData> = {}): ReadingProgressData {
  return {
    mangaId: overrides.mangaId ?? "manga-1",
    chapterId: overrides.chapterId ?? "chapter-1",
    currentPage: overrides.currentPage ?? 0,
    totalPages: overrides.totalPages ?? 10,
    lastReadAt: overrides.lastReadAt ?? Date.now(),
  };
}

export async function runReadingHistoryTests(): Promise<void> {
  const calls: string[] = [];

  const restore = setFetchMangaDetailsImplementation(async (mangaId) => {
    calls.push(mangaId);
    if (mangaId === "manga-error") {
      throw new Error("boom");
    }

    return {
      details: {
        id: mangaId,
        title: `Title ${mangaId}`,
      } as MangaDetails,
      chaptersFetched: 0,
    };
  });

  const previousLevel = logger.getCurrentLogLevel();
  logger.disableLogging();

  try {
    const data: ReadingProgressData[] = [
      buildProgress({ mangaId: "manga-1", chapterId: "chapter-a" }),
      buildProgress({ mangaId: "manga-1", chapterId: "chapter-b" }),
      buildProgress({ mangaId: "manga-error", chapterId: "chapter-c" }),
    ];

    const enriched = await hydrateProgressWithDetails(data);

    assert.equal(calls.filter((id) => id === "manga-1").length, 1, "manga-1 should be fetched once");
    assert.equal(enriched.length, 3);
    const successEntry = enriched.find((entry) => entry.mangaId === "manga-1");
    assert(successEntry?.manga, "Successful entry should include manga details");

    const errorEntry = enriched.find((entry) => entry.mangaId === "manga-error");
    assert(errorEntry);
    assert.equal(errorEntry.error, "boom");
    assert.equal(errorEntry.manga, null);
  } finally {
    restore();
    logger.setMinLevel(previousLevel);
  }
}

import { cache } from "react";
import {
  fetchMangaDetails,
  type EnrichedReadingProgress,
  type MangaDetails,
  type ReadingProgressData,
} from "./api";
import { logger } from "./logger";

interface MangaDetailsResult {
  manga: MangaDetails | null;
  error: string | null;
}

type FetchMangaDetails = typeof fetchMangaDetails;

let fetchDetailsImpl: FetchMangaDetails = fetchMangaDetails;

const cachedFetchMangaDetails = cache(async (mangaId: string) => {
  return fetchDetailsImpl(mangaId);
});

export function setFetchMangaDetailsImplementation(
  implementation: FetchMangaDetails,
): () => void {
  const previous = fetchDetailsImpl;
  fetchDetailsImpl = implementation;
  return () => {
    fetchDetailsImpl = previous;
  };
}

const MAX_HISTORY_ITEMS = 12;

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Failed to fetch manga details";
}

function selectHistoryWindow(progressData: ReadingProgressData[]): ReadingProgressData[] {
  if (progressData.length <= MAX_HISTORY_ITEMS) {
    return progressData;
  }

  return [...progressData]
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, MAX_HISTORY_ITEMS);
}

export async function hydrateProgressWithDetails(
  progressData: ReadingProgressData[],
): Promise<EnrichedReadingProgress[]> {
  if (progressData.length === 0) {
    return [];
  }

  const progressWindow = selectHistoryWindow(progressData);
  const uniqueMangaIds = Array.from(new Set(progressWindow.map((entry) => entry.mangaId)));
  const detailResults = new Map<string, MangaDetailsResult>();

  await Promise.all(
    uniqueMangaIds.map(async (mangaId) => {
      try {
        const { details } = await cachedFetchMangaDetails(mangaId);
        if (!details) {
          const message = `No details returned for manga ${mangaId}`;
          logger.warn(message, {
            component: "reading-history",
            action: "missing-details",
            mangaId,
          });
          detailResults.set(mangaId, { manga: null, error: message });
          return;
        }

        detailResults.set(mangaId, { manga: details, error: null });
      } catch (error) {
        const message = sanitizeError(error);
        logger.error(`Failed to fetch manga details for ${mangaId}`, {
          component: "reading-history",
          action: "fetch-failed",
          mangaId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        detailResults.set(mangaId, { manga: null, error: message });
      }
    }),
  );

  return progressWindow.map((entry) => {
    const detail = detailResults.get(entry.mangaId) ?? {
      manga: null,
      error: "Manga details not available",
    };

    return {
      ...entry,
      manga: detail.manga,
      error: detail.error,
    };
  });
}

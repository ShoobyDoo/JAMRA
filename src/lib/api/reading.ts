import { request } from "./client";
import type { MangaDetails } from "./manga";

export interface ChapterPages {
  chapterId: string;
  mangaId: string;
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
    bytes?: number;
  }>;
}

export interface ChapterPagesResponse {
  pages: ChapterPages;
  extensionId?: string;
}

export interface ChapterPagesChunk {
  chapterId: string;
  mangaId: string;
  chunk: number;
  chunkSize: number;
  totalChunks: number;
  totalPages: number;
  pages: ChapterPages["pages"];
  hasMore: boolean;
}

export interface ChapterPagesChunkResponse {
  chunk: ChapterPagesChunk;
  extensionId?: string;
}

export async function fetchChapterPages(
  mangaId: string,
  chapterId: string,
  extensionId?: string,
): Promise<ChapterPagesResponse> {
  const params = new URLSearchParams();
  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  return request<ChapterPagesResponse>(
    `/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/pages${suffix}`,
  );
}

export async function fetchChapterPagesChunk(
  mangaId: string,
  chapterId: string,
  chunk: number,
  chunkSize: number,
  extensionId?: string,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ChapterPagesChunk> {
  const params = new URLSearchParams({
    size: String(chunkSize),
  });

  if (extensionId) {
    params.set("extensionId", extensionId);
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  const response = await request<ChapterPagesChunkResponse>(
    `/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/pages/chunk/${chunk}${suffix}`,
    {
      signal: options?.signal,
    },
  );

  return response.chunk;
}

export interface ReadingProgressData {
  mangaId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}

export interface EnrichedReadingProgress extends ReadingProgressData {
  manga: MangaDetails | null;
  error: string | null;
  extensionId?: string;
}

export async function saveReadingProgress(
  mangaId: string,
  chapterId: string,
  currentPage: number,
  totalPages: number,
): Promise<void> {
  await request<{ success: boolean }>("/reading-progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mangaId,
      chapterId,
      currentPage,
      totalPages,
      scrollPosition: 0,
    }),
  });
}

export async function getReadingProgress(
  mangaId: string,
  chapterId: string,
): Promise<ReadingProgressData | null> {
  const result = await request<ReadingProgressData | undefined>(
    `/reading-progress/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`,
    { allowStatuses: [404] },
  );
  return result ?? null;
}

export async function getAllReadingProgress(): Promise<ReadingProgressData[]> {
  return request<ReadingProgressData[]>("/reading-progress");
}

export async function getEnrichedReadingProgress(
  limit?: number,
): Promise<EnrichedReadingProgress[]> {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.floor(limit)));
  }
  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";
  return request<EnrichedReadingProgress[]>(
    `/reading-progress/enriched${suffix}`,
  );
}

export async function clearChaptersCache(mangaId: string): Promise<void> {
  await request(`/manga/${encodeURIComponent(mangaId)}/chapters`, {
    method: "DELETE",
  });
}

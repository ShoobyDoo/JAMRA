import { request } from "./client";

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "failed"
  | "paused";

export interface OfflineQueuedDownload {
  id: number;
  extensionId: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle?: string;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  status: DownloadStatus;
  priority: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  progressCurrent: number;
  progressTotal: number;
}

export interface OfflineChapterMetadata {
  chapterId: string;
  slug: string;
  number?: string;
  title?: string;
  displayTitle: string;
  volume?: string;
  publishedAt?: string;
  languageCode?: string;
  scanlators?: string[];
  folderName: string;
  totalPages: number;
  downloadedAt: number;
  sizeBytes: number;
}

export interface OfflineMangaMetadata {
  version: 1;
  downloadedAt: number;
  lastUpdatedAt: number;
  mangaId: string;
  slug: string;
  extensionId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  coverPath: string;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  rating?: number;
  year?: number;
  status?: string;
  demographic?: string;
  altTitles?: string[];
  chapters: OfflineChapterMetadata[];
}

interface QueueChapterDownloadResponse {
  queueId: number;
  success: boolean;
}

interface QueueMangaDownloadResponse {
  queueIds: number[];
  success: boolean;
}

interface OfflineChapterStatusResponse {
  isDownloaded: boolean;
}

interface OfflineChaptersResponse {
  chapters: OfflineChapterMetadata[];
}

interface OfflineMangaResponse {
  manga: OfflineMangaMetadata;
}

interface OfflineQueueResponse {
  queue: OfflineQueuedDownload[];
}

export async function queueChapterDownload(
  extensionId: string,
  mangaId: string,
  chapterId: string,
  priority = 0,
): Promise<QueueChapterDownloadResponse> {
  return request<QueueChapterDownloadResponse>("/offline/download/chapter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      extensionId,
      mangaId,
      chapterId,
      priority,
    }),
  });
}

export async function queueMangaDownload(
  extensionId: string,
  mangaId: string,
  options: { chapterIds?: string[]; priority?: number } = {},
): Promise<QueueMangaDownloadResponse> {
  return request<QueueMangaDownloadResponse>("/offline/download/manga", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      extensionId,
      mangaId,
      chapterIds: options.chapterIds,
      priority: options.priority ?? 0,
    }),
  });
}

export async function getOfflineChapterStatus(
  extensionId: string,
  mangaId: string,
  chapterId: string,
): Promise<boolean> {
  const params = new URLSearchParams({ extensionId });
  const response = await request<OfflineChapterStatusResponse>(
    `/offline/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}/status?${params.toString()}`,
  );
  return response.isDownloaded;
}

export async function getOfflineChapters(
  extensionId: string,
  mangaId: string,
): Promise<OfflineChapterMetadata[]> {
  const params = new URLSearchParams({ extensionId });
  const response = await request<OfflineChaptersResponse>(
    `/offline/manga/${encodeURIComponent(mangaId)}/chapters?${params.toString()}`,
  );
  return response.chapters;
}

export async function getOfflineMangaMetadata(
  extensionId: string,
  mangaId: string,
): Promise<OfflineMangaMetadata | null> {
  const params = new URLSearchParams({ extensionId });
  const response = await request<OfflineMangaResponse | undefined>(
    `/offline/manga/${encodeURIComponent(mangaId)}?${params.toString()}`,
    { allowStatuses: [404] },
  );
  return response?.manga ?? null;
}

export async function validateOfflineMangaMetadata(
  extensionId: string,
  mangaId: string,
): Promise<{ valid: boolean; rebuilt: boolean }> {
  const params = new URLSearchParams({ extensionId });
  return request<{ valid: boolean; rebuilt: boolean }>(
    `/offline/manga/${encodeURIComponent(mangaId)}/validate?${params.toString()}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
}

export async function getOfflineQueue(): Promise<OfflineQueuedDownload[]> {
  const response = await request<OfflineQueueResponse>("/offline/queue");
  return response.queue;
}

interface OfflineDownloadProgressResponse {
  progress: {
    queueId: number;
    mangaTitle: string;
    chapterTitle?: string;
    status: DownloadStatus;
    progressCurrent: number;
    progressTotal: number;
    progressPercent: number;
    downloadedBytes: number;
    totalBytes: number;
    speedBytesPerSecond?: number;
    estimatedTimeRemainingMs?: number;
    errorMessage?: string;
  };
}

export async function getOfflineDownloadProgress(
  queueId: number,
): Promise<OfflineDownloadProgressResponse["progress"] | null> {
  const response = await request<OfflineDownloadProgressResponse | undefined>(
    `/offline/queue/${encodeURIComponent(String(queueId))}`,
    { allowStatuses: [404] },
  );
  return response?.progress ?? null;
}

export async function cancelOfflineDownload(
  queueId: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/offline/queue/${encodeURIComponent(String(queueId))}/cancel`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
}

export async function retryOfflineDownload(
  queueId: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/offline/queue/${encodeURIComponent(String(queueId))}/retry`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
    },
  );
}

export async function retryFrozenDownloads(): Promise<{
  success: boolean;
  retriedCount: number;
  retriedIds: number[];
}> {
  return request<{
    success: boolean;
    retriedCount: number;
    retriedIds: number[];
  }>(`/offline/queue/retry-frozen`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
}

export async function deleteOfflineChapter(
  extensionId: string,
  mangaId: string,
  chapterId: string,
): Promise<void> {
  const params = new URLSearchParams({ extensionId });
  await request(
    `/offline/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId)}?${params.toString()}`,
    { method: "DELETE" },
  );
}

export async function deleteOfflineManga(
  extensionId: string,
  mangaId: string,
): Promise<void> {
  const params = new URLSearchParams({ extensionId });
  await request(
    `/offline/manga/${encodeURIComponent(mangaId)}?${params.toString()}`,
    { method: "DELETE" },
  );
}

export interface OfflineDownloadHistoryItem {
  id: number;
  extensionId: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle?: string;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  status: DownloadStatus;
  queuedAt: number;
  startedAt?: number;
  completedAt: number;
  errorMessage?: string;
  progressCurrent: number;
  progressTotal: number;
}

interface OfflineDownloadHistoryResponse {
  history: OfflineDownloadHistoryItem[];
}

export async function getOfflineDownloadHistory(
  limit?: number,
): Promise<OfflineDownloadHistoryItem[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  const response = await request<OfflineDownloadHistoryResponse>(
    `/offline/history${suffix}`,
  );
  return response.history;
}

export async function deleteOfflineHistoryItem(
  historyId: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/offline/history/${encodeURIComponent(String(historyId))}`,
    { method: "DELETE" },
  );
}

export async function clearOfflineDownloadHistory(): Promise<{
  success: boolean;
}> {
  return request<{ success: boolean }>("/offline/history", {
    method: "DELETE",
  });
}

import { request } from "./client";

export type HistoryActionType =
  | "read"
  | "library_add"
  | "library_remove"
  | "tag_add"
  | "tag_remove"
  | "favorite"
  | "unfavorite"
  | "search";

export interface HistoryEntry {
  id: number;
  mangaId: string;
  chapterId: string | null;
  actionType: HistoryActionType;
  timestamp: number;
  extensionId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface EnrichedHistoryEntry extends HistoryEntry {
  manga: {
    title: string;
    coverUrl: string | null;
    slug: string | null;
  } | null;
  chapter: {
    title: string | null;
    chapterNumber: string | null;
  } | null;
}

export interface HistoryStats {
  totalEntries: number;
  chaptersRead: number;
  mangaStarted: number;
  libraryAdditions: number;
  actionCounts: Record<string, number>;
  mostReadManga: Array<{
    mangaId: string;
    title: string;
    count: number;
  }>;
}

export interface GetHistoryOptions {
  limit?: number;
  offset?: number;
  mangaId?: string;
  actionType?: HistoryActionType;
  startDate?: number;
  endDate?: number;
  enriched?: boolean;
}

export interface LogHistoryEntryPayload {
  mangaId: string;
  chapterId?: string;
  actionType: HistoryActionType;
  timestamp?: number;
  extensionId?: string;
  metadata?: Record<string, unknown>;
}

export async function logHistoryEntry(
  payload: LogHistoryEntryPayload,
): Promise<{ id: number; success: boolean }> {
  return request<{ id: number; success: boolean }>("/history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getHistory(
  options?: GetHistoryOptions,
): Promise<HistoryEntry[] | EnrichedHistoryEntry[]> {
  const params = new URLSearchParams();

  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.mangaId) params.set("mangaId", options.mangaId);
  if (options?.actionType) params.set("actionType", options.actionType);
  if (options?.startDate) params.set("startDate", String(options.startDate));
  if (options?.endDate) params.set("endDate", String(options.endDate));
  if (options?.enriched) params.set("enriched", "true");

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  if (options?.enriched) {
    return request<EnrichedHistoryEntry[]>(`/history${suffix}`);
  }
  return request<HistoryEntry[]>(`/history${suffix}`);
}

export async function getHistoryStats(options?: {
  startDate?: number;
  endDate?: number;
}): Promise<HistoryStats> {
  const params = new URLSearchParams();

  if (options?.startDate) params.set("startDate", String(options.startDate));
  if (options?.endDate) params.set("endDate", String(options.endDate));

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  return request<HistoryStats>(`/history/stats${suffix}`);
}

export async function deleteHistoryEntry(
  id: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/history/${id}`, {
    method: "DELETE",
  });
}

export async function clearHistory(beforeTimestamp?: number): Promise<{
  success: boolean;
  deletedCount: number;
}> {
  const params = new URLSearchParams();
  if (beforeTimestamp) params.set("beforeTimestamp", String(beforeTimestamp));

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  return request<{ success: boolean; deletedCount: number }>(
    `/history${suffix}`,
    {
      method: "DELETE",
    },
  );
}

export async function nukeUserData(): Promise<{
  success: boolean;
  message: string;
}> {
  return request<{ success: boolean; message: string }>(
    "/danger/nuke-user-data",
    {
      method: "POST",
    },
  );
}

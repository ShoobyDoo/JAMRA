import { request } from "./client";

export type LibraryStatus =
  | "reading"
  | "plan_to_read"
  | "completed"
  | "on_hold"
  | "dropped";

export interface LibraryEntry {
  mangaId: string;
  extensionId: string;
  status: LibraryStatus;
  personalRating: number | null;
  favorite: boolean;
  notes: string | null;
  addedAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface EnrichedLibraryEntry extends LibraryEntry {
  manga: {
    title: string;
    description: string | null;
    coverUrl: string | null;
    coverUrls: string[] | null;
    status: string | null;
    tags: string[] | null;
  };
  totalChapters: number;
  readChapters: number;
}

export interface LibraryStats {
  totalManga: number;
  byStatus: {
    reading: number;
    plan_to_read: number;
    completed: number;
    on_hold: number;
    dropped: number;
  };
  totalChaptersRead: number;
  favorites: number;
}

export interface LibraryTag {
  id: number;
  name: string;
  color: string | null;
  createdAt: number;
  mangaCount?: number;
}

export interface AddToLibraryOptions {
  personalRating?: number;
  favorite?: boolean;
  notes?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface UpdateLibraryEntryOptions {
  status?: LibraryStatus;
  personalRating?: number | null;
  favorite?: boolean;
  notes?: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
}

export async function addToLibrary(
  mangaId: string,
  extensionId: string,
  status: LibraryStatus,
  options?: AddToLibraryOptions,
): Promise<LibraryEntry> {
  return request<LibraryEntry>("/library", {
    method: "POST",
    body: JSON.stringify({
      mangaId,
      extensionId,
      status,
      ...options,
    }),
  });
}

export async function updateLibraryEntry(
  mangaId: string,
  updates: UpdateLibraryEntryOptions,
): Promise<LibraryEntry> {
  return request<LibraryEntry>(`/library/${encodeURIComponent(mangaId)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function removeFromLibrary(
  mangaId: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/library/${encodeURIComponent(mangaId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function getLibraryEntry(
  mangaId: string,
): Promise<LibraryEntry | null> {
  try {
    return await request<LibraryEntry>(
      `/library/${encodeURIComponent(mangaId)}`,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status?: number }).status === 404
    ) {
      return null;
    }
    throw error;
  }
}

export async function getLibraryEntries(filters?: {
  status?: LibraryStatus;
  favorite?: boolean;
}): Promise<LibraryEntry[]> {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.favorite !== undefined) {
    params.set("favorite", String(filters.favorite));
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  return request<LibraryEntry[]>(`/library${suffix}`);
}

export async function getEnrichedLibraryEntries(filters?: {
  status?: LibraryStatus;
  favorite?: boolean;
}): Promise<EnrichedLibraryEntry[]> {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.favorite !== undefined) {
    params.set("favorite", String(filters.favorite));
  }

  const query = params.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  return request<EnrichedLibraryEntry[]>(`/library-enriched${suffix}`);
}

export async function getLibraryStats(): Promise<LibraryStats> {
  return request<LibraryStats>("/library-stats");
}

export async function createLibraryTag(
  name: string,
  color?: string,
): Promise<LibraryTag> {
  return request<LibraryTag>("/library/tags", {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
}

export async function deleteLibraryTag(
  tagId: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/library/tags/${tagId}`, {
    method: "DELETE",
  });
}

export async function getLibraryTags(): Promise<LibraryTag[]> {
  return request<LibraryTag[]>("/library/tags");
}

export async function addTagToLibraryEntry(
  mangaId: string,
  tagId: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/library/${encodeURIComponent(mangaId)}/tags/${tagId}`,
    { method: "POST" },
  );
}

export async function removeTagFromLibraryEntry(
  mangaId: string,
  tagId: number,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/library/${encodeURIComponent(mangaId)}/tags/${tagId}`,
    { method: "DELETE" },
  );
}

export async function getTagsForLibraryEntry(
  mangaId: string,
): Promise<LibraryTag[]> {
  return request<LibraryTag[]>(`/library/${encodeURIComponent(mangaId)}/tags`);
}

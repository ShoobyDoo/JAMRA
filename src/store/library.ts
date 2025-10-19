import { create } from "zustand";
import {
  type LibraryEntry,
  type EnrichedLibraryEntry,
  type LibraryStats,
  type LibraryStatus,
  type LibraryTag,
  addToLibrary as addToLibraryAPI,
  updateLibraryEntry as updateLibraryEntryAPI,
  removeFromLibrary as removeFromLibraryAPI,
  getLibraryEntry as getLibraryEntryAPI,
  getEnrichedLibraryEntries as getEnrichedLibraryEntriesAPI,
  getLibraryStats as getLibraryStatsAPI,
  getLibraryTags as getLibraryTagsAPI,
  createLibraryTag as createLibraryTagAPI,
  deleteLibraryTag as deleteLibraryTagAPI,
  addTagToLibraryEntry as addTagToLibraryEntryAPI,
  removeTagFromLibraryEntry as removeTagFromLibraryEntryAPI,
  getTagsForLibraryEntry as getTagsForLibraryEntryAPI,
} from "@/lib/api";

export interface LibraryFilters {
  status?: LibraryStatus;
  favorite?: boolean;
  searchQuery?: string;
  tagIds?: number[];
}

export type LibrarySortOption =
  | "updated_at"
  | "added_at"
  | "title"
  | "rating"
  | "progress";

export interface LibraryState {
  // Data
  entries: Map<string, EnrichedLibraryEntry>;
  tags: LibraryTag[];
  stats: LibraryStats | null;

  // UI State
  filters: LibraryFilters;
  sortBy: LibrarySortOption;
  sortOrder: "asc" | "desc";
  isLoading: boolean;
  error: string | null;

  // Selected entries for bulk operations
  selectedMangaIds: Set<string>;

  // Actions - Library Management
  addToLibrary: (
    mangaId: string,
    extensionId: string,
    status: LibraryStatus,
    options?: {
      personalRating?: number;
      favorite?: boolean;
      notes?: string;
    }
  ) => Promise<LibraryEntry>;

  updateEntry: (
    mangaId: string,
    updates: {
      status?: LibraryStatus;
      personalRating?: number | null;
      favorite?: boolean;
      notes?: string | null;
    }
  ) => Promise<void>;

  removeEntry: (mangaId: string) => Promise<void>;

  checkLibraryStatus: (mangaId: string) => Promise<LibraryEntry | null>;

  // Actions - Data Loading
  loadLibrary: (filters?: LibraryFilters) => Promise<void>;
  loadStats: () => Promise<void>;
  loadTags: () => Promise<void>;

  // Actions - Filtering & Sorting
  setFilters: (filters: Partial<LibraryFilters>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: LibrarySortOption, order?: "asc" | "desc") => void;

  // Actions - Selection (for bulk operations)
  toggleSelection: (mangaId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  bulkUpdateStatus: (status: LibraryStatus) => Promise<void>;
  bulkDelete: () => Promise<void>;

  // Actions - Tags
  createTag: (name: string, color?: string) => Promise<LibraryTag>;
  deleteTag: (tagId: number) => Promise<void>;
  addTagToEntry: (mangaId: string, tagId: number) => Promise<void>;
  removeTagFromEntry: (mangaId: string, tagId: number) => Promise<void>;

  // Computed getters
  getFilteredEntries: () => EnrichedLibraryEntry[];
  getSortedEntries: () => EnrichedLibraryEntry[];
  getEntryByMangaId: (mangaId: string) => EnrichedLibraryEntry | undefined;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  // Initial state
  entries: new Map(),
  tags: [],
  stats: null,
  filters: {},
  sortBy: "updated_at",
  sortOrder: "desc",
  isLoading: false,
  error: null,
  selectedMangaIds: new Set(),

  // Library Management
  addToLibrary: async (mangaId, extensionId, status, options) => {
    try {
      const entry = await addToLibraryAPI(mangaId, extensionId, status, options);

      // Reload library to get enriched data
      await get().loadLibrary(get().filters);
      await get().loadStats();

      return entry;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add to library";
      set({ error: errorMessage });
      throw error;
    }
  },

  updateEntry: async (mangaId, updates) => {
    try {
      await updateLibraryEntryAPI(mangaId, updates);

      // Update local state
      const entries = new Map(get().entries);
      const existing = entries.get(mangaId);
      if (existing) {
        entries.set(mangaId, {
          ...existing,
          ...updates,
          updatedAt: Date.now(),
        });
        set({ entries });
      }

      // Reload stats if status changed
      if (updates.status) {
        await get().loadStats();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update entry";
      set({ error: errorMessage });
      throw error;
    }
  },

  removeEntry: async (mangaId) => {
    try {
      await removeFromLibraryAPI(mangaId);

      // Remove from local state
      const entries = new Map(get().entries);
      entries.delete(mangaId);
      set({ entries });

      await get().loadStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove entry";
      set({ error: errorMessage });
      throw error;
    }
  },

  checkLibraryStatus: async (mangaId) => {
    try {
      return await getLibraryEntryAPI(mangaId);
    } catch (error) {
      console.error("Failed to check library status:", error);
      return null;
    }
  },

  // Data Loading
  loadLibrary: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const entries = await getEnrichedLibraryEntriesAPI(filters);
      const entriesMap = new Map(entries.map((entry) => [entry.mangaId, entry]));
      set({ entries: entriesMap, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load library";
      set({ error: errorMessage, isLoading: false });
    }
  },

  loadStats: async () => {
    try {
      const stats = await getLibraryStatsAPI();
      set({ stats });
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  },

  loadTags: async () => {
    try {
      const tags = await getLibraryTagsAPI();
      set({ tags });
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  },

  // Filtering & Sorting
  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters };
    set({ filters });
    get().loadLibrary(filters);
  },

  clearFilters: () => {
    set({ filters: {} });
    get().loadLibrary({});
  },

  setSortBy: (sortBy, order = "desc") => {
    set({ sortBy, sortOrder: order });
  },

  // Selection
  toggleSelection: (mangaId) => {
    const selected = new Set(get().selectedMangaIds);
    if (selected.has(mangaId)) {
      selected.delete(mangaId);
    } else {
      selected.add(mangaId);
    }
    set({ selectedMangaIds: selected });
  },

  selectAll: () => {
    const allIds = Array.from(get().entries.keys());
    set({ selectedMangaIds: new Set(allIds) });
  },

  clearSelection: () => {
    set({ selectedMangaIds: new Set() });
  },

  bulkUpdateStatus: async (status) => {
    const selected = Array.from(get().selectedMangaIds);
    try {
      await Promise.all(selected.map((mangaId) => get().updateEntry(mangaId, { status })));
      get().clearSelection();
      await get().loadLibrary(get().filters);
    } catch (error) {
      console.error("Bulk update failed:", error);
      throw error;
    }
  },

  bulkDelete: async () => {
    const selected = Array.from(get().selectedMangaIds);
    try {
      await Promise.all(selected.map((mangaId) => get().removeEntry(mangaId)));
      get().clearSelection();
    } catch (error) {
      console.error("Bulk delete failed:", error);
      throw error;
    }
  },

  // Tags
  createTag: async (name, color) => {
    try {
      const tag = await createLibraryTagAPI(name, color);
      set({ tags: [...get().tags, tag] });
      return tag;
    } catch (error) {
      console.error("Failed to create tag:", error);
      throw error;
    }
  },

  deleteTag: async (tagId) => {
    try {
      await deleteLibraryTagAPI(tagId);
      set({ tags: get().tags.filter((tag) => tag.id !== tagId) });
    } catch (error) {
      console.error("Failed to delete tag:", error);
      throw error;
    }
  },

  addTagToEntry: async (mangaId, tagId) => {
    try {
      await addTagToLibraryEntryAPI(mangaId, tagId);
      // Reload entry tags
      const tags = await getTagsForLibraryEntryAPI(mangaId);
      // Update entry in local state if needed
      console.log("Tags for entry:", tags);
    } catch (error) {
      console.error("Failed to add tag to entry:", error);
      throw error;
    }
  },

  removeTagFromEntry: async (mangaId, tagId) => {
    try {
      await removeTagFromLibraryEntryAPI(mangaId, tagId);
    } catch (error) {
      console.error("Failed to remove tag from entry:", error);
      throw error;
    }
  },

  // Computed getters
  getFilteredEntries: () => {
    const { entries, filters } = get();
    let filtered = Array.from(entries.values());

    if (filters.status) {
      filtered = filtered.filter((entry) => entry.status === filters.status);
    }

    if (filters.favorite !== undefined) {
      filtered = filtered.filter((entry) => entry.favorite === filters.favorite);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.manga.title.toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  getSortedEntries: () => {
    const { sortBy, sortOrder } = get();
    const filtered = get().getFilteredEntries();

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "updated_at":
          comparison = a.updatedAt - b.updatedAt;
          break;
        case "added_at":
          comparison = a.addedAt - b.addedAt;
          break;
        case "title":
          comparison = a.manga.title.localeCompare(b.manga.title);
          break;
        case "rating":
          comparison = (a.personalRating ?? 0) - (b.personalRating ?? 0);
          break;
        case "progress":
          const progressA = a.totalChapters > 0 ? a.readChapters / a.totalChapters : 0;
          const progressB = b.totalChapters > 0 ? b.readChapters / b.totalChapters : 0;
          comparison = progressA - progressB;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  },

  getEntryByMangaId: (mangaId) => {
    return get().entries.get(mangaId);
  },
}));

import { create } from "zustand";
import {
  type EnrichedHistoryEntry,
  type HistoryStats,
  type HistoryActionType,
  logHistoryEntry as logHistoryEntryAPI,
  getHistory as getHistoryAPI,
  getHistoryStats as getHistoryStatsAPI,
  deleteHistoryEntry as deleteHistoryEntryAPI,
  clearHistory as clearHistoryAPI,
} from "@/lib/api";

export interface HistoryFilters {
  mangaId?: string;
  actionType?: HistoryActionType;
  startDate?: number;
  endDate?: number;
  searchQuery?: string;
}

export type HistorySortOption = "newest" | "oldest" | "manga";
export type HistoryViewMode = "timeline" | "list" | "grid";

export interface HistoryState {
  // Data
  entries: EnrichedHistoryEntry[];
  stats: HistoryStats | null;

  // Pagination
  currentPage: number;
  itemsPerPage: number;
  totalEntries: number;
  hasMore: boolean;

  // UI State
  filters: HistoryFilters;
  sortBy: HistorySortOption;
  viewMode: HistoryViewMode;
  isLoading: boolean;
  error: string | null;

  // Actions - History Management
  logEntry: (
    mangaId: string,
    actionType: HistoryActionType,
    options?: {
      chapterId?: string;
      extensionId?: string;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<void>;

  deleteEntry: (id: number) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  clearHistoryBefore: (timestamp: number) => Promise<void>;

  // Actions - Data Loading
  loadHistory: (append?: boolean) => Promise<void>;
  loadStats: (dateRange?: {
    startDate?: number;
    endDate?: number;
  }) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;

  // Actions - Filtering & Sorting
  setFilters: (filters: Partial<HistoryFilters>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: HistorySortOption) => void;
  setViewMode: (mode: HistoryViewMode) => void;

  // Computed getters
  getGroupedByDate: () => Map<string, EnrichedHistoryEntry[]>;
  getFilteredEntries: () => EnrichedHistoryEntry[];
}

export const useHistory = create<HistoryState>((set, get) => ({
  // Initial state
  entries: [],
  stats: null,
  currentPage: 0,
  itemsPerPage: 50,
  totalEntries: 0,
  hasMore: true,
  filters: {},
  sortBy: "newest",
  viewMode: "timeline",
  isLoading: false,
  error: null,

  // History Management
  logEntry: async (mangaId, actionType, options) => {
    try {
      await logHistoryEntryAPI({
        mangaId,
        actionType,
        chapterId: options?.chapterId,
        extensionId: options?.extensionId,
        metadata: options?.metadata,
      });
    } catch (error) {
      console.error("Failed to log history entry:", error);
      // Don't throw - history logging should be fire-and-forget
    }
  },

  deleteEntry: async (id) => {
    try {
      await deleteHistoryEntryAPI(id);

      // Remove from local state
      set({ entries: get().entries.filter((entry) => entry.id !== id) });

      // Reload stats
      await get().loadStats();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete entry";
      set({ error: errorMessage });
      throw error;
    }
  },

  clearAllHistory: async () => {
    try {
      await clearHistoryAPI();
      set({ entries: [], currentPage: 0, totalEntries: 0, hasMore: false });
      await get().loadStats();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to clear history";
      set({ error: errorMessage });
      throw error;
    }
  },

  clearHistoryBefore: async (timestamp) => {
    try {
      await clearHistoryAPI(timestamp);
      await get().refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to clear history before date";
      set({ error: errorMessage });
      throw error;
    }
  },

  // Data Loading
  loadHistory: async (append = false) => {
    set({ isLoading: true, error: null });
    try {
      const { filters, itemsPerPage, currentPage, sortBy } = get();
      const offset = append ? currentPage * itemsPerPage : 0;

      const entries = (await getHistoryAPI({
        limit: itemsPerPage,
        offset,
        mangaId: filters.mangaId,
        actionType: filters.actionType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        enriched: true,
      })) as EnrichedHistoryEntry[];

      const hasMore = entries.length === itemsPerPage;

      // Apply sorting based on sortBy
      const sorted = [...entries].sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return b.timestamp - a.timestamp;
          case "oldest":
            return a.timestamp - b.timestamp;
          case "manga":
            return (a.manga?.title ?? "").localeCompare(b.manga?.title ?? "");
          default:
            return b.timestamp - a.timestamp;
        }
      });

      set({
        entries: append ? [...get().entries, ...sorted] : sorted,
        currentPage: append ? currentPage + 1 : 1,
        hasMore,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load history";
      set({ error: errorMessage, isLoading: false });
    }
  },

  loadStats: async (dateRange) => {
    try {
      const stats = await getHistoryStatsAPI(dateRange);
      set({ stats });
    } catch (error) {
      console.error("Failed to load history stats:", error);
    }
  },

  loadMore: async () => {
    if (!get().hasMore || get().isLoading) return;
    await get().loadHistory(true);
  },

  refresh: async () => {
    set({ currentPage: 0, entries: [] });
    await Promise.all([get().loadHistory(false), get().loadStats()]);
  },

  // Filtering & Sorting
  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters };
    set({ filters, currentPage: 0 });
    get().loadHistory(false);
  },

  clearFilters: () => {
    set({ filters: {}, currentPage: 0 });
    get().loadHistory(false);
  },

  setSortBy: (sortBy) => {
    set({ sortBy });
    // Re-sort existing entries
    const entries = [...get().entries].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.timestamp - a.timestamp;
        case "oldest":
          return a.timestamp - b.timestamp;
        case "manga":
          return (a.manga?.title ?? "").localeCompare(b.manga?.title ?? "");
        default:
          return b.timestamp - a.timestamp;
      }
    });
    set({ entries });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  // Computed getters
  getGroupedByDate: () => {
    const entries = get().getFilteredEntries();
    const grouped = new Map<string, EnrichedHistoryEntry[]>();

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey: string;
      if (date.toDateString() === today.toDateString()) {
        dateKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = "Yesterday";
      } else {
        dateKey = date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    }

    return grouped;
  },

  getFilteredEntries: () => {
    const { entries, filters } = get();
    let filtered = [...entries];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.manga?.title.toLowerCase().includes(query) ||
          entry.chapter?.title?.toLowerCase().includes(query),
      );
    }

    return filtered;
  },
}));

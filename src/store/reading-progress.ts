import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  saveReadingProgress as saveProgressAPI,
  getReadingProgress as getProgressAPI,
  logHistoryEntry,
} from "@/lib/api";
import { logger } from "@/lib/logger";

export interface ReadingProgress {
  mangaId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}

export interface ReadingProgressState {
  // Progress tracking (persisted)
  progress: Record<string, ReadingProgress>; // key: `${mangaId}:${chapterId}`

  // Session state (not persisted)
  currentMangaId: string | null;
  currentChapterId: string | null;
  currentPage: number;
  totalPages: number;
  preloadedImages: Set<string>;

  // Actions
  setProgress: (
    mangaId: string,
    chapterId: string,
    page: number,
    total: number,
  ) => void;
  getProgress: (
    mangaId: string,
    chapterId: string,
  ) => ReadingProgress | undefined;
  loadProgressFromAPI: (
    mangaId: string,
    chapterId: string,
  ) => Promise<ReadingProgress | null>;
  setCurrentChapter: (
    mangaId: string,
    chapterId: string,
    totalPages: number,
  ) => void;
  setCurrentPage: (page: number) => void;
  addPreloadedImage: (url: string) => void;
  clearPreloadedImages: () => void;
  markChapterComplete: (mangaId: string, chapterId: string) => void;
}

export const useReadingProgress = create<ReadingProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      currentMangaId: null,
      currentChapterId: null,
      currentPage: 0,
      totalPages: 0,
      preloadedImages: new Set(),

      setProgress: (mangaId, chapterId, page, total) => {
        const key = `${mangaId}:${chapterId}`;
        const progressData = {
          mangaId,
          chapterId,
          currentPage: page,
          totalPages: total,
          lastReadAt: Date.now(),
        };

        // Update local state
        set((state) => ({
          progress: {
            ...state.progress,
            [key]: progressData,
          },
        }));

        // Save to API (fire and forget - don't block UI)
        saveProgressAPI(mangaId, chapterId, page, total).catch((error) => {
          logger.error("Failed to save reading progress", {
            component: "useReadingProgress",
            action: "save-progress",
            mangaId,
            chapterId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });
      },

      loadProgressFromAPI: async (mangaId, chapterId) => {
        try {
          const progress = await getProgressAPI(mangaId, chapterId);
          if (progress) {
            const key = `${mangaId}:${chapterId}`;
            set((state) => ({
              progress: {
                ...state.progress,
                [key]: progress,
              },
            }));
          }
          return progress;
        } catch (error) {
          logger.error("Failed to load reading progress", {
            component: "useReadingProgress",
            action: "load-progress",
            mangaId,
            chapterId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          return null;
        }
      },

      getProgress: (mangaId, chapterId) => {
        const key = `${mangaId}:${chapterId}`;
        return get().progress[key];
      },

      setCurrentChapter: async (mangaId, chapterId, totalPages) => {
        // Try to load from API first
        const apiProgress = await get().loadProgressFromAPI(mangaId, chapterId);

        let startPage = 0;

        if (apiProgress) {
          // Use API progress if valid
          if (
            apiProgress.currentPage >= 0 &&
            apiProgress.currentPage < totalPages
          ) {
            startPage = apiProgress.currentPage;
          }
        } else {
          // Fall back to localStorage
          const existingProgress = get().getProgress(mangaId, chapterId);
          if (existingProgress?.currentPage !== undefined) {
            const savedPage = existingProgress.currentPage;
            if (savedPage >= 0 && savedPage < totalPages) {
              startPage = savedPage;
            }
          }
        }

        set({
          currentMangaId: mangaId,
          currentChapterId: chapterId,
          currentPage: startPage,
          totalPages,
          preloadedImages: new Set(),
        });

        // Log to history (fire and forget)
        logHistoryEntry({
          mangaId,
          chapterId,
          actionType: "read",
          metadata: {
            startPage,
            totalPages,
          },
        }).catch((error) => {
          logger.error("Failed to log reading history entry", {
            component: "useReadingProgress",
            action: "log-history",
            mangaId,
            chapterId,
            error:
              error instanceof Error ? error : new Error(String(error)),
          });
        });
      },

      setCurrentPage: (page) => {
        const { currentMangaId, currentChapterId, totalPages } = get();

        // Validate page is within bounds
        if (page < 0 || page >= totalPages) {
          logger.warn("Clamping out-of-bounds page selection", {
            component: "useReadingProgress",
            action: "clamp-page",
            page,
            totalPages,
          });
          page = Math.max(0, Math.min(page, totalPages - 1));
        }

        // Atomic update to prevent flashing
        if (currentMangaId && currentChapterId) {
          const key = `${currentMangaId}:${currentChapterId}`;
          const progressData = {
            mangaId: currentMangaId,
            chapterId: currentChapterId,
            currentPage: page,
            totalPages,
            lastReadAt: Date.now(),
          };

          set((state) => ({
            currentPage: page,
            progress: {
              ...state.progress,
              [key]: progressData,
            },
          }));

          // Save to API
          saveProgressAPI(
            currentMangaId,
            currentChapterId,
            page,
            totalPages,
          ).catch((error) => {
            logger.error("Failed to save progress while updating current page", {
              component: "useReadingProgress",
              action: "save-progress",
              mangaId: currentMangaId,
              chapterId: currentChapterId,
              page,
              totalPages,
              error:
                error instanceof Error ? error : new Error(String(error)),
            });
          });
        } else {
          set({ currentPage: page });
        }
      },

      addPreloadedImage: (url) => {
        set((state) => {
          const newSet = new Set(state.preloadedImages);
          newSet.add(url);
          return { preloadedImages: newSet };
        });
      },

      clearPreloadedImages: () => {
        set({ preloadedImages: new Set() });
      },

      markChapterComplete: (mangaId, chapterId) => {
        const key = `${mangaId}:${chapterId}`;
        set((state) => ({
          progress: {
            ...state.progress,
            [key]: {
              ...state.progress[key],
              currentPage: state.progress[key]?.totalPages ?? 0,
              lastReadAt: Date.now(),
            },
          },
        }));
      },
    }),
    {
      name: "reading-progress-storage",
      partialize: (state) => ({
        // Only persist progress, not session state
        progress: state.progress,
      }),
    },
  ),
);

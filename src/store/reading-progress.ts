import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  saveReadingProgress as saveProgressAPI,
  getReadingProgress as getProgressAPI,
  logHistoryEntry,
} from "@/lib/api";
import { logger } from "@/lib/logger";

const SAVE_DEBOUNCE_MS = 400;

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
  persist((set, get) => {
    const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

    const scheduleSave = (
      mangaId: string,
      chapterId: string,
      page: number,
      totalPages: number,
    ) => {
      const key = `${mangaId}:${chapterId}`;
      const existing = pendingSaves.get(key);
      if (existing !== undefined) {
        clearTimeout(existing);
      }

      const timeoutId = setTimeout(() => {
        pendingSaves.delete(key);
        void saveProgressAPI(mangaId, chapterId, page, totalPages).catch(
          (error) => {
            // Progress is persisted locally, so API save failures are non-critical
            // Only log as warning since the data is not lost
            const errorMessage = error instanceof Error ? error.message : String(error);
            const logContext: Record<string, unknown> = {
              component: "useReadingProgress",
              action: "save-progress",
              mangaId,
              chapterId,
              page,
              totalPages,
              error: error instanceof Error ? error : new Error(String(error)),
            };

            // Include validation details if present
            if (error && typeof error === "object" && "detail" in error) {
              logContext.validationDetail = error.detail;
            }

            logger.warn(`Failed to sync reading progress to server (saved locally): ${errorMessage}`, logContext);
          },
        );
      }, SAVE_DEBOUNCE_MS);

      pendingSaves.set(key, timeoutId);
    };

    const flushPendingSaves = () => {
      pendingSaves.forEach((timeoutId, key) => {
        clearTimeout(timeoutId);
        pendingSaves.delete(key);

        const snapshot = get().progress[key];
        if (!snapshot) return;

        void saveProgressAPI(
          snapshot.mangaId,
          snapshot.chapterId,
          snapshot.currentPage,
          snapshot.totalPages,
        ).catch((error) => {
          // Progress is persisted locally, so API save failures are non-critical
          const errorMessage = error instanceof Error ? error.message : String(error);
          const logContext: Record<string, unknown> = {
            component: "useReadingProgress",
            action: "flush-progress",
            mangaId: snapshot.mangaId,
            chapterId: snapshot.chapterId,
            page: snapshot.currentPage,
            totalPages: snapshot.totalPages,
            error: error instanceof Error ? error : new Error(String(error)),
          };

          // Include validation details if present
          if (error && typeof error === "object" && "detail" in error) {
            logContext.validationDetail = error.detail;
          }

          logger.warn(`Failed to flush queued reading progress to server (saved locally): ${errorMessage}`, logContext);
        });
      });
    };

    return {
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

        set((state) => ({
          progress: {
            ...state.progress,
            [key]: progressData,
          },
        }));

        scheduleSave(mangaId, chapterId, page, total);
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
        flushPendingSaves();

        const apiProgress = await get().loadProgressFromAPI(mangaId, chapterId);

        let startPage = 0;

        if (apiProgress) {
          if (
            apiProgress.currentPage >= 0 &&
            apiProgress.currentPage < totalPages
          ) {
            startPage = apiProgress.currentPage;
          }
        } else {
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

        void logHistoryEntry({
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
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });
      },

      setCurrentPage: (page) => {
        const { currentMangaId, currentChapterId, totalPages } = get();

        if (page < 0 || page >= totalPages) {
          logger.warn("Clamping out-of-bounds page selection", {
            component: "useReadingProgress",
            action: "clamp-page",
            page,
            totalPages,
          });
          page = Math.max(0, Math.min(page, totalPages - 1));
        }

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

          scheduleSave(currentMangaId, currentChapterId, page, totalPages);
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

        const snapshot = get().progress[key];
        if (snapshot) {
          scheduleSave(
            snapshot.mangaId,
            snapshot.chapterId,
            snapshot.currentPage,
            snapshot.totalPages,
          );
        }
      },
    };
  }, {
    name: "reader-progress-storage",
    partialize: (state) => ({
      progress: state.progress,
    }),
  }),
);

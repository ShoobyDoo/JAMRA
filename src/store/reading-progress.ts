import { create } from "zustand";
import { persist } from "zustand/middleware";

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
    total: number
  ) => void;
  getProgress: (
    mangaId: string,
    chapterId: string
  ) => ReadingProgress | undefined;
  setCurrentChapter: (
    mangaId: string,
    chapterId: string,
    totalPages: number
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
        set((state) => ({
          progress: {
            ...state.progress,
            [key]: {
              mangaId,
              chapterId,
              currentPage: page,
              totalPages: total,
              lastReadAt: Date.now(),
            },
          },
        }));
      },

      getProgress: (mangaId, chapterId) => {
        const key = `${mangaId}:${chapterId}`;
        return get().progress[key];
      },

      setCurrentChapter: (mangaId, chapterId, totalPages) => {
        const existingProgress = get().getProgress(mangaId, chapterId);
        set({
          currentMangaId: mangaId,
          currentChapterId: chapterId,
          currentPage: existingProgress?.currentPage ?? 0,
          totalPages,
          preloadedImages: new Set(),
        });
      },

      setCurrentPage: (page) => {
        const { currentMangaId, currentChapterId, totalPages } = get();
        set({ currentPage: page });

        if (currentMangaId && currentChapterId) {
          get().setProgress(currentMangaId, currentChapterId, page, totalPages);
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
    }
  )
);

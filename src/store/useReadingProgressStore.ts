import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "../api/client";
import { API_PATHS } from "../constants/api";

export interface ReadingProgressEntry {
  libraryId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}

interface ReadingProgressState {
  progress: Record<string, ReadingProgressEntry>;
  currentLibraryId: string | null;
  currentChapterId: string | null;
  currentPage: number;
  totalPages: number;

  setCurrentChapter: (
    libraryId: string,
    chapterId: string,
    totalPages: number,
  ) => Promise<void>;
  setCurrentPage: (page: number) => void;
  getProgress: (
    libraryId: string,
    chapterId: string,
  ) => ReadingProgressEntry | undefined;
  markChapterComplete: (libraryId: string, chapterId: string) => void;
}

const SAVE_DEBOUNCE_MS = 400;
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

const scheduleSave = (
  libraryId: string,
  chapterId: string,
  page: number,
  totalPages: number,
) => {
  const key = `${libraryId}:${chapterId}`;
  const existing = pendingSaves.get(key);
  if (existing !== undefined) clearTimeout(existing);

  const timeoutId = setTimeout(() => {
    pendingSaves.delete(key);
    apiClient
      .put(API_PATHS.libraryChapterProgress(libraryId, chapterId), {
        body: JSON.stringify({ page, totalPages }),
      })
      .catch(() => {
        // Non-critical – progress is persisted locally
      });
  }, SAVE_DEBOUNCE_MS);

  pendingSaves.set(key, timeoutId);
};

export const useReadingProgress = create<ReadingProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      currentLibraryId: null,
      currentChapterId: null,
      currentPage: 0,
      totalPages: 0,

      setCurrentChapter: async (libraryId, chapterId, totalPages) => {
        const key = `${libraryId}:${chapterId}`;
        const saved = get().progress[key];
        const resumePage = saved?.currentPage ?? 0;
        set({
          currentLibraryId: libraryId,
          currentChapterId: chapterId,
          totalPages,
          currentPage: resumePage,
        });
      },

      setCurrentPage: (page) => {
        const { currentLibraryId, currentChapterId, totalPages } = get();
        set({ currentPage: page });

        if (!currentLibraryId || !currentChapterId) return;

        const key = `${currentLibraryId}:${currentChapterId}`;
        set((state) => ({
          progress: {
            ...state.progress,
            [key]: {
              libraryId: currentLibraryId,
              chapterId: currentChapterId,
              currentPage: page,
              totalPages,
              lastReadAt: Date.now(),
            },
          },
        }));

        scheduleSave(currentLibraryId, currentChapterId, page, totalPages);
      },

      getProgress: (libraryId, chapterId) => {
        return get().progress[`${libraryId}:${chapterId}`];
      },

      markChapterComplete: (libraryId, chapterId) => {
        const { totalPages } = get();
        const lastPage = Math.max(0, totalPages - 1);
        const key = `${libraryId}:${chapterId}`;
        set((state) => ({
          progress: {
            ...state.progress,
            [key]: {
              ...state.progress[key],
              libraryId,
              chapterId,
              currentPage: lastPage,
              totalPages,
              lastReadAt: Date.now(),
            },
          },
        }));
      },
    }),
    {
      name: "reading-progress-storage",
      partialize: (state) => ({ progress: state.progress }),
    },
  ),
);

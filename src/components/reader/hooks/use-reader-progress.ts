import { useEffect, useCallback } from "react";
import { useReadingProgress } from "@/store/reading-progress";

export function useReaderProgress(
  mangaId: string,
  chapterId: string,
  totalPages: number
) {
  const {
    currentPage,
    setCurrentChapter,
    setCurrentPage,
    getProgress,
    markChapterComplete,
  } = useReadingProgress();

  // Initialize chapter on mount
  useEffect(() => {
    setCurrentChapter(mangaId, chapterId, totalPages);
  }, [mangaId, chapterId, totalPages, setCurrentChapter]);

  const goToPage = useCallback(
    (pageIndex: number) => {
      if (pageIndex >= 0 && pageIndex < totalPages) {
        setCurrentPage(pageIndex);

        // Mark as complete if reached last page
        if (pageIndex === totalPages - 1) {
          markChapterComplete(mangaId, chapterId);
        }
      }
    },
    [totalPages, setCurrentPage, markChapterComplete, mangaId, chapterId]
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
      return true;
    }
    return false;
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
      return true;
    }
    return false;
  }, [currentPage, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(0);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    goToPage(totalPages - 1);
  }, [totalPages, goToPage]);

  const getProgressPercentage = useCallback(() => {
    if (totalPages === 0) return 0;
    return Math.round(((currentPage + 1) / totalPages) * 100);
  }, [currentPage, totalPages]);

  const isComplete = useCallback(() => {
    return currentPage === totalPages - 1;
  }, [currentPage, totalPages]);

  const savedProgress = getProgress(mangaId, chapterId);

  return {
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    getProgressPercentage,
    isComplete,
    savedProgress,
  };
}

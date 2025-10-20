import { useEffect, useCallback, useRef } from "react";
import { useReadingProgress } from "@/store/reading-progress";

export function useReaderProgress(
  mangaId: string,
  chapterId: string,
  totalPages: number,
  initialPage?: number,
) {
  const store = useReadingProgress();
  const {
    currentPage,
    setCurrentChapter,
    setCurrentPage,
    getProgress,
    markChapterComplete,
  } = store;

  // Use ref to always get the latest page value
  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Initialize chapter on mount
  useEffect(() => {
    // setCurrentChapter is now async, so we need to handle it properly
    const initChapter = async () => {
      await setCurrentChapter(mangaId, chapterId, totalPages);
      // Override with initialPage if provided
      if (initialPage !== undefined) {
        setCurrentPage(initialPage);
      }
    };
    initChapter();
  }, [
    mangaId,
    chapterId,
    totalPages,
    setCurrentChapter,
    initialPage,
    setCurrentPage,
  ]);

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
    [totalPages, setCurrentPage, markChapterComplete, mangaId, chapterId],
  );

  const nextPage = useCallback(() => {
    const current = currentPageRef.current;
    if (current < totalPages - 1) {
      goToPage(current + 1);
      return true;
    }
    return false;
  }, [totalPages, goToPage]);

  const prevPage = useCallback(() => {
    const current = currentPageRef.current;
    if (current > 0) {
      goToPage(current - 1);
      return true;
    }
    return false;
  }, [goToPage]);

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

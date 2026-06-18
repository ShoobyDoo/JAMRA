import { useEffect, useCallback, useRef } from "react";
import { useReadingProgress } from "../../../store/useReadingProgressStore";

export const useReaderProgress = (
  libraryId: string,
  chapterId: string,
  totalPages: number,
  initialPage?: number,
) => {
  const {
    currentPage,
    setCurrentChapter,
    setCurrentPage,
    getProgress,
    markChapterComplete,
  } = useReadingProgress();

  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const initChapter = async () => {
      await setCurrentChapter(libraryId, chapterId, totalPages);
      if (initialPage !== undefined) {
        setCurrentPage(initialPage);
      }
    };
    void initChapter();
  }, [
    libraryId,
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
        if (pageIndex === totalPages - 1) {
          markChapterComplete(libraryId, chapterId);
        }
      }
    },
    [totalPages, setCurrentPage, markChapterComplete, libraryId, chapterId],
  );

  const savedProgress = getProgress(libraryId, chapterId);

  return {
    currentPage,
    totalPages,
    goToPage,
    savedProgress,
  };
};

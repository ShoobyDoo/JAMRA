import { forwardRef } from "react";
import type { useReaderControls } from "../../hooks/useReaderControls";
import { DualPageMode } from "./reading-modes/dual-page-mode";
import { PagedMode } from "./reading-modes/paged-mode";
import { VerticalMode } from "./reading-modes/vertical-mode";

interface ChapterMeta {
  id: string;
  title?: string;
  number?: string;
}

interface ReaderViewportProps {
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
  } | null>;
  currentPage: number;
  totalPages: number;
  readingMode: string;
  mangaId: string;
  mangaSlug: string;
  readerControls: ReturnType<typeof useReaderControls>;
  nextChapter: ChapterMeta | null;
  prevChapter: ChapterMeta | null;
  onPageChange: (index: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  isPagesLoading: boolean;
  loadingProgress: number;
  loadingError: Error | null;
  onRetry: () => void;
  onNavigateToChapter?: (chapterId: string) => void;
}

export const ReaderViewport = forwardRef<HTMLDivElement, ReaderViewportProps>(
  (
    {
      pages,
      currentPage,
      totalPages,
      readingMode,
      mangaId,
      mangaSlug,
      readerControls,
      nextChapter,
      prevChapter,
      onPageChange,
      onPrevPage,
      onNextPage,
      isPagesLoading,
      loadingProgress,
      loadingError,
      onRetry,
      onNavigateToChapter,
    },
    ref,
  ) => {
    const renderReadingMode = () => {
      const sharedProps = {
        pages,
        currentPage,
        totalPages,
        onPageChange,
        nextChapter,
        prevChapter,
        mangaId,
        mangaSlug,
        readerControls,
        onPrevPage,
        onNextPage,
        onNavigateToChapter,
      };

      switch (readingMode) {
        case "dual-page":
          return <DualPageMode {...sharedProps} />;
        case "vertical":
          return <VerticalMode {...sharedProps} />;
        case "paged-ltr":
        case "paged-rtl":
        default:
          return <PagedMode {...sharedProps} />;
      }
    };

    return (
      <div ref={ref} className="relative flex-1 overflow-hidden">
        {renderReadingMode()}

        {isPagesLoading && loadingProgress < 100 && (
          <div className="absolute top-4 right-4 rounded-md bg-black/75 px-3 py-2 text-sm text-white">
            Loading pages: {loadingProgress}%
          </div>
        )}

        {loadingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90">
            <p className="px-4 text-center text-sm text-white/70">
              {loadingError.message || "Failed to load chapter pages."}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  },
);

ReaderViewport.displayName = "ReaderViewport";

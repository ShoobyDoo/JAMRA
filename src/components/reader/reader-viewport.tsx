"use client";

import { forwardRef } from "react";
import { PagedMode } from "./reading-modes/paged-mode";
import { DualPageMode } from "./reading-modes/dual-page-mode";
import { VerticalMode } from "./reading-modes/vertical-mode";
import type { useReaderControls } from "@/hooks/use-reader-controls";

interface ChapterMeta {
  id: string;
  slug: string;
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
    },
    ref,
  ) => {
    const renderReadingMode = () => {
      const onPageSelect = (pageIndex: number) => {
        onPageChange(pageIndex);
      };

      const sharedProps = {
        pages,
        currentPage,
        totalPages,
        onPageChange: onPageSelect,
        nextChapter,
        prevChapter,
        mangaId,
        mangaSlug,
        readerControls,
        onPrevPage,
        onNextPage,
      } satisfies Parameters<typeof PagedMode>[0];

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
      <div
        ref={ref}
        className="reader-viewport relative flex-1 overflow-hidden"
      >
        {renderReadingMode()}

        {isPagesLoading && loadingProgress < 100 && (
          <div className="absolute top-4 right-4 rounded-md bg-black/75 px-3 py-2 text-sm text-white">
            Loading pages: {loadingProgress}%
          </div>
        )}

        {loadingError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90">
            <p className="px-4 text-center text-sm text-muted-foreground">
              {loadingError.message || "Failed to load chapter pages."}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
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

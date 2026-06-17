import React, { useCallback } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
} from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";

// Shared background class map
export const READER_BACKGROUNDS: Record<string, string> = {
  black: "bg-black",
  white: "bg-white",
  sepia: "bg-[#f4ecd8]",
  "dark-gray": "bg-gray-900",
};

// Shared page-fit styles
export interface PageDims {
  width?: number;
  height?: number;
}

export const getPageFitStyles = (
  pageFit: string,
  customWidth: number,
  dims?: PageDims,
): React.CSSProperties => {
  switch (pageFit) {
    case "width":
      // Fill container width; height is unconstrained so overflow is clipped by container
      return { width: "100%", height: "auto" };
    case "height":
      return { width: "auto", height: "100%", maxWidth: "100%" };
    case "original":
      return {
        width: dims?.width ?? "auto",
        height: dims?.height ?? "auto",
        maxWidth: "100%",
        maxHeight: "100%",
      };
    case "custom":
      return { width: `${customWidth}%`, height: "auto", maxHeight: "100%" };
    case "auto":
    default:
      // Fit entirely within the container, maintaining aspect ratio
      return { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto" };
  }
};

// Shared loading placeholder
interface PageLoadingPlaceholderProps {
  pageNumber: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export const PageLoadingPlaceholder: React.FC<PageLoadingPlaceholderProps> = ({
  pageNumber,
  containerRef,
  className = "",
}) => (
  <div
    ref={containerRef}
    className={`flex h-full w-full items-center justify-center ${className}`}
  >
    <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm px-6 py-4">
      <IconLoader2 size={32} className="animate-spin text-white/70" />
      <span className="text-sm text-white/70">Loading page {pageNumber}...</span>
    </div>
  </div>
);

// Shared hot-zone handlers hook
export const useHotZoneHandlers = (
  readerControls: ReturnType<typeof useReaderControls>,
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      readerControls.updateHotZone(e.clientX, e.clientY, containerRef.current);
    }
  }, [readerControls, containerRef]);

  const handleMouseLeave = useCallback(() => {
    readerControls.clearHotZone();
  }, [readerControls]);

  return { handleMouseMove, handleMouseLeave };
};

// Chapter transition types
export interface ChapterRef {
  id: string;
  title?: string;
  number?: string;
}

// ChapterTransitionOverlay — the key UX fix
interface ChapterTransitionOverlayProps {
  prevChapter?: ChapterRef | null;
  nextChapter?: ChapterRef | null;
  currentPage: number;
  totalPages: number;
  isRTL?: boolean;
  onNavigateToChapter?: (chapterId: string) => void;
}

const formatChapterLabel = (chapter: ChapterRef): string => {
  if (chapter.title) return chapter.title;
  if (chapter.number) return `Chapter ${chapter.number}`;
  return `Chapter ${chapter.id}`;
};

export const ChapterTransitionOverlay: React.FC<ChapterTransitionOverlayProps> = ({
  prevChapter,
  nextChapter,
  currentPage,
  totalPages,
  isRTL = false,
  onNavigateToChapter,
}) => {
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  return (
    <>
      {/* Previous chapter — first page only */}
      {isFirstPage && prevChapter && onNavigateToChapter && (
        <div
          className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 flex items-center px-6 z-20`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToChapter(prevChapter.id);
            }}
            className="flex flex-col items-center gap-2 rounded-lg border border-white/20 bg-black/80 px-4 py-3 text-white transition-colors cursor-pointer hover:bg-black/95 active:scale-95"
          >
            {isRTL ? <IconChevronRight size={24} /> : <IconChevronLeft size={24} />}
            <span className="text-xs text-center max-w-[120px] truncate">
              {formatChapterLabel(prevChapter)}
            </span>
            <span className="text-xs text-white/60">Previous Chapter</span>
          </button>
        </div>
      )}

      {/* Last page: next chapter or end of manga */}
      {isLastPage && (
        <div
          className={`absolute ${isRTL ? "left-0" : "right-0"} top-0 bottom-0 flex items-center px-6 z-20`}
        >
          {nextChapter && onNavigateToChapter ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToChapter(nextChapter.id);
              }}
              className="flex flex-col items-center gap-2 rounded-lg border border-white/20 bg-black/80 px-4 py-3 text-white transition-colors cursor-pointer hover:bg-black/95 active:scale-95"
            >
              {isRTL ? <IconChevronLeft size={24} /> : <IconChevronRight size={24} />}
              <span className="text-xs text-center max-w-[120px] truncate">
                {formatChapterLabel(nextChapter)}
              </span>
              <span className="text-xs text-white/60">Click to continue</span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-black/80 px-4 py-3 text-white pointer-events-none">
              <span className="text-sm font-medium">End of Manga</span>
              <span className="text-xs text-white/60">No more chapters</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

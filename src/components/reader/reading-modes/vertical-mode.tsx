import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useReaderSettings } from "../../../store/useReaderSettingsStore";
import { IconCircleCheck, IconLoader2 } from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";
import {
  READER_BACKGROUNDS,
  useHotZoneHandlers,
  ChapterTransitionOverlay,
} from "./shared";
import type { ChapterRef } from "./shared";

interface VerticalModeProps {
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
  } | null>;
  currentPage: number;
  totalPages: number;
  onPageChange: (pageIndex: number) => void;
  nextChapter?: ChapterRef | null;
  prevChapter?: ChapterRef | null;
  mangaId?: string;
  mangaSlug?: string;
  readerControls: ReturnType<typeof useReaderControls>;
  onPrevPage: () => void;
  onNextPage: () => void;
  onNavigateToChapter?: (chapterId: string) => void;
}

const DEFAULT_PLACEHOLDER_HEIGHT = 900;

export const VerticalMode: React.FC<VerticalModeProps> = ({
  pages,
  currentPage,
  totalPages,
  onPageChange,
  nextChapter,
  prevChapter,
  readerControls,
  onPrevPage,
  onNextPage,
  onNavigateToChapter,
}) => {
  const { backgroundColor, gapSize, pageFit, customWidth } = useReaderSettings();
  const hasLoadedPages = pages.some((page) => page !== null);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(currentPage);
  const skipScrollRef = useRef(false);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      const page = pages[index];
      return (page?.height ?? DEFAULT_PLACEHOLDER_HEIGHT) + gapSize;
    },
    overscan: 3,
  });

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const viewportCenter = scrollTop + viewportHeight / 2;

    let closestIndex = virtualItems[0].index;
    let closestDistance = Math.abs(virtualItems[0].start - viewportCenter);

    for (const item of virtualItems) {
      const itemCenter = item.start + item.size / 2;
      const distance = Math.abs(itemCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = item.index;
      }
    }

    if (currentPageRef.current !== closestIndex && !isScrolling) {
      currentPageRef.current = closestIndex;
      onPageChange(closestIndex);
    }
  }, [virtualizer, onPageChange, isScrolling]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    virtualizer.scrollToIndex(currentPage, { align: "start", behavior: "auto" });
  }, [currentPage, virtualizer]);

  const getImageWidth = () => {
    switch (pageFit) {
      case "width": return "100%";
      case "height":
      case "auto":
      case "original": return "auto";
      case "custom": return `${customWidth}%`;
      default: return "100%";
    }
  };

  const imageWidthValue = getImageWidth();

  const { handleMouseMove, handleMouseLeave } = useHotZoneHandlers(readerControls, containerRef);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const zone = readerControls.getHotZone(e.clientX, e.clientY, containerRef.current);

    if (zone === "center") {
      readerControls.toggleControls();
    } else if (zone === "top") {
      readerControls.hideControls();
      onPrevPage();
    } else if (zone === "bottom") {
      readerControls.hideControls();
      onNextPage();
    }
  };

  const handleScroll = () => {
    readerControls.hideControls();
    setIsScrolling(true);

    const timeout = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    return () => clearTimeout(timeout);
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="relative h-full w-full">
      <ChapterTransitionOverlay
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        currentPage={currentPage}
        totalPages={totalPages}
        isRTL={false}
        onNavigateToChapter={onNavigateToChapter}
      />
    <div
      ref={containerRef}
      className={`h-full w-full overflow-y-auto touch-pan-y ${READER_BACKGROUNDS[backgroundColor]}`}
      style={{
        scrollBehavior: "auto",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const pageIndex = virtualRow.index;
          const page = pages[pageIndex];
          const eagerLoad = pageIndex <= currentPage + 2;
          const placeholderHeight = page?.height ?? DEFAULT_PLACEHOLDER_HEIGHT;

          return (
            <div
              key={pageIndex}
              data-page-index={pageIndex}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                marginBottom: pageIndex < totalPages - 1 ? gapSize : 0,
              }}
              className="flex w-full items-center justify-center"
            >
              {page ? (
                <img
                  src={page.url}
                  alt={`Page ${page.index + 1}`}
                  style={{
                    width: imageWidthValue,
                    height: "auto",
                    maxWidth: "100%",
                    display: "block",
                  }}
                  className="select-none"
                  loading={eagerLoad ? "eager" : "lazy"}
                />
              ) : (
                <div
                  className="w-full max-w-full select-none flex items-center justify-center"
                  style={{ height: placeholderHeight, width: imageWidthValue, maxWidth: "100%" }}
                >
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm px-6 py-4">
                    <IconLoader2 size={24} className="animate-spin text-white/70" />
                    <span className="text-sm text-white/70">Loading page {pageIndex + 1}...</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* End of chapter */}
        {hasLoadedPages && (
          <div
            style={{ position: "absolute", top: virtualizer.getTotalSize(), left: 0, width: "100%" }}
            className="flex flex-col items-center justify-center gap-4 py-12 min-h-[400px]"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-black/60 px-8 py-6 text-center text-white">
                <IconCircleCheck size={32} className="text-white/60" />
                <span className="text-lg font-medium">Chapter Complete</span>
                <span className="text-sm text-white/60">
                  {nextChapter
                    ? "Use hot zones to navigate to next chapter"
                    : "No more chapters available"}
                </span>
              </div>

              {nextChapter && onNavigateToChapter && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToChapter(nextChapter.id);
                  }}
                  className="mt-2 rounded-lg bg-white/10 border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Next Chapter
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

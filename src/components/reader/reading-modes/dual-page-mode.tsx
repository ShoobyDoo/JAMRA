import React, { useRef, useEffect, useState } from "react";
import { useReaderSettings } from "../../../store/useReaderSettingsStore";
import { IconChevronRight, IconChevronLeft, IconLoader2 } from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";
import {
  READER_BACKGROUNDS,
  getPageFitStyles,
  useHotZoneHandlers,
  ChapterTransitionOverlay,
} from "./shared";

interface PageData {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

interface DualPageModeProps {
  pages: Array<PageData | null>;
  currentPage: number;
  totalPages: number;
  onPageChange: (pageIndex: number) => void;
  nextChapter?: {
    id: string;
    title?: string;
    number?: string;
  } | null;
  prevChapter?: {
    id: string;
    title?: string;
    number?: string;
  } | null;
  mangaId?: string;
  mangaSlug?: string;
  readerControls: ReturnType<typeof useReaderControls>;
  onPrevPage: () => void;
  onNextPage: () => void;
  onNavigateToChapter?: (chapterId: string) => void;
}

export const DualPageMode: React.FC<DualPageModeProps> = ({
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
  const { pageFit, backgroundColor, dualPageGap, readingMode, customWidth } =
    useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [showDragCursor, setShowDragCursor] = useState(false);

  const isRTL = readingMode === "paged-rtl";

  const getDisplayPages = () => {
    const leftPageIndex = isRTL ? currentPage + 1 : currentPage;
    const rightPageIndex = isRTL ? currentPage : currentPage + 1;
    return {
      left: pages[leftPageIndex] ?? null,
      right: rightPageIndex < pages.length ? (pages[rightPageIndex] ?? null) : null,
    };
  };

  const displayPages = getDisplayPages();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isDragging.current) return;
    const zone = readerControls.getHotZone(e.clientX, e.clientY, containerRef.current);

    if (zone === "center") {
      readerControls.toggleControls();
    } else if (zone === "left") {
      readerControls.hideControls();
      if (isRTL) onNextPage(); else onPrevPage();
    } else if (zone === "right") {
      readerControls.hideControls();
      if (isRTL) onPrevPage(); else onNextPage();
    }
  };

  const { handleMouseMove, handleMouseLeave } = useHotZoneHandlers(readerControls, containerRef);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const DRAG_THRESHOLD = 100;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.closest("button")) return;

      isDragging.current = false;
      startX.current = e.clientX;
      setDragOffset(0);
      setShowDragCursor(true);
    };

    const handleMouseMoveDoc = (e: MouseEvent) => {
      if (startX.current === 0) return;
      const delta = e.clientX - startX.current;
      if (Math.abs(delta) > 5) {
        isDragging.current = true;
        readerControls.hideControls();
      }
      setDragOffset(delta);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (startX.current === 0) return;

      const dragDelta = e.clientX - startX.current;
      setShowDragCursor(false);

      const step = displayPages.right ? 2 : 1;

      if (Math.abs(dragDelta) > DRAG_THRESHOLD) {
        if (isRTL) {
          if (dragDelta < 0 && currentPage < totalPages - 1) {
            onPageChange(Math.min(totalPages - 1, currentPage + step));
          } else if (dragDelta > 0 && currentPage > 0) {
            onPageChange(Math.max(0, currentPage - step));
          }
        } else {
          if (dragDelta < 0 && currentPage < totalPages - 1) {
            onPageChange(Math.min(totalPages - 1, currentPage + step));
          } else if (dragDelta > 0 && currentPage > 0) {
            onPageChange(Math.max(0, currentPage - step));
          }
        }
      }

      setDragOffset(0);
      startX.current = 0;
      setTimeout(() => {
        isDragging.current = false;
      }, 50);
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMoveDoc);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMoveDoc);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [currentPage, totalPages, onPageChange, displayPages.right, isRTL, readerControls]);


  const renderPage = (page: PageData | null, key: string, pageIndex: number) => (
    <div key={key} className="flex-1 flex h-full w-full items-center justify-center p-2 md:p-4 overflow-hidden">
      {page ? (
        <img
          src={page.url}
          alt={`Page ${page.index + 1}`}
          style={getPageFitStyles(pageFit, customWidth, page)}
          className="pointer-events-none select-none transition-opacity duration-200"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm px-6 py-4">
          <IconLoader2 size={24} className="animate-spin text-white/70" />
          <span className="text-xs text-white/70">Loading page {pageIndex + 1}...</span>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${READER_BACKGROUNDS[backgroundColor]} ${showDragCursor ? "cursor-grabbing" : ""}`}
      style={{
        transform: dragOffset !== 0 ? `translateX(${dragOffset * 0.1}px)` : undefined,
        transition: dragOffset === 0 ? "transform 0.2s ease-out" : undefined,
      }}
    >
      {/* Hot-edge chevron hints */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div className="relative flex-1 group">
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 pl-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${currentPage > 0 || isRTL ? "block" : "hidden"}`}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <IconChevronLeft size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="relative flex-1 group">
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${currentPage < totalPages - 1 || !isRTL ? "block" : "hidden"}`}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <IconChevronRight size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      <ChapterTransitionOverlay
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        currentPage={currentPage}
        totalPages={totalPages}
        isRTL={isRTL}
        onNavigateToChapter={onNavigateToChapter}
      />

      {/* Dual page display */}
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ gap: `${dualPageGap}px` }}
      >
        {renderPage(displayPages.left, "left", isRTL ? currentPage + 1 : currentPage)}
        {renderPage(displayPages.right, "right", isRTL ? currentPage : currentPage + 1)}
      </div>
    </div>
  );
};

import React, { useRef, useEffect, useState } from "react";
import { useReaderSettings } from "../../../store/useReaderSettingsStore";
import { IconChevronRight, IconChevronLeft, IconLoader2 } from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      readerControls.updateHotZone(e.clientX, e.clientY, containerRef.current);
    }
  };

  const handleMouseLeave = () => {
    readerControls.clearHotZone();
  };

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

  const getImageStyles = (page: PageData | null): React.CSSProperties => {
    if (!page) return {};
    switch (pageFit) {
      case "width": return { width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain" };
      case "height": return { width: "auto", height: "100%", maxWidth: "100%", objectFit: "contain" };
      case "original": return { width: page.width ?? "auto", height: page.height ?? "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" };
      case "custom": return { width: `${customWidth}%`, height: "auto", maxHeight: "100%", objectFit: "contain" };
      case "auto":
      default:
        return { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" };
    }
  };

  const bgClasses: Record<string, string> = {
    black: "bg-black",
    white: "bg-white",
    sepia: "bg-[#f4ecd8]",
    "dark-gray": "bg-gray-900",
  };

  const renderPage = (page: PageData | null, key: string, pageIndex: number) => (
    <div key={key} className="flex-1 flex h-full w-full items-center justify-center p-2 md:p-4 overflow-hidden">
      {page ? (
        <img
          src={page.url}
          alt={`Page ${page.index + 1}`}
          style={getImageStyles(page)}
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
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${bgClasses[backgroundColor]} ${showDragCursor ? "cursor-grabbing" : ""}`}
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

      {/* Previous chapter */}
      {currentPage === 0 && prevChapter && onNavigateToChapter && (
        <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 flex items-center px-6 z-20`}>
          <button
            onClick={() => onNavigateToChapter(prevChapter.id)}
            className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white transition hover:bg-black/90"
          >
            {isRTL ? <IconChevronRight size={24} /> : <IconChevronLeft size={24} />}
            <span className="text-xs text-center">
              {prevChapter.title || `Chapter ${prevChapter.number || prevChapter.id}`}
            </span>
            <span className="text-xs text-white/60">Previous Chapter</span>
          </button>
        </div>
      )}

      {/* Next chapter */}
      {currentPage >= totalPages - 1 && (
        <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-0 bottom-0 flex items-center px-6 z-20`}>
          {nextChapter && onNavigateToChapter ? (
            <button
              onClick={() => onNavigateToChapter(nextChapter.id)}
              className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white transition hover:bg-black/90"
            >
              {isRTL ? <IconChevronLeft size={24} /> : <IconChevronRight size={24} />}
              <span className="text-xs text-center">
                {nextChapter.title || `Chapter ${nextChapter.number || nextChapter.id}`}
              </span>
              <span className="text-xs text-white/60">Click to continue</span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white pointer-events-none">
              <span className="text-sm font-medium">End of Manga</span>
              <span className="text-xs text-white/60">No more chapters</span>
            </div>
          )}
        </div>
      )}

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

import React, { useEffect, useRef, useState } from "react";
import { useReaderSettings } from "../../../store/useReaderSettingsStore";
import { IconChevronRight, IconChevronLeft, IconLoader2 } from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";

interface PagedModeProps {
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
  } | null>;
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

export const PagedMode: React.FC<PagedModeProps> = (props) => {
  const {
    pages,
    currentPage,
    totalPages,
    nextChapter,
    prevChapter,
    readerControls,
    onPrevPage,
    onNextPage,
    onNavigateToChapter,
  } = props;
  const { pageFit, backgroundColor, readingMode, customWidth } =
    useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const currentPageData = pages[currentPage];
  const isRTL = readingMode === "paged-rtl";
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  useEffect(() => {
    // Only used if dimensions are strictly needed elsewhere, but we removed manual aspect ratio logic.
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
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

  const getImageStyles = (): React.CSSProperties => {
    if (!currentPageData) return {};

    switch (pageFit) {
      case "width":
        return { width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain" };
      case "height":
        return { width: "auto", height: "100%", maxWidth: "100%", objectFit: "contain" };
      case "original":
        return {
          width: currentPageData.width ?? "auto",
          height: currentPageData.height ?? "auto",
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        };
      case "custom":
        return { width: `${customWidth}%`, height: "auto", maxHeight: "100%", objectFit: "contain" };
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

  const renderLoading = () => (
    <div
      ref={containerRef}
      className={`flex h-full w-full items-center justify-center ${bgClasses[backgroundColor]}`}
    >
      <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm px-6 py-4">
        <IconLoader2 size={32} className="animate-spin text-white/70" />
        <span className="text-sm text-white/70">Loading page {currentPage + 1}...</span>
      </div>
    </div>
  );

  if (!currentPageData) return renderLoading();

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${bgClasses[backgroundColor]}`}
    >
      {/* Hot-edge chevron hints */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div className="relative flex-1 group">
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 pl-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${!isFirstPage || isRTL ? "block" : "hidden"}`}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <IconChevronLeft size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="relative flex-1 group">
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${!isLastPage || !isRTL ? "block" : "hidden"}`}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <IconChevronRight size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* End of manga */}
      {isLastPage && !nextChapter && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-6 py-4 text-white">
            <span className="text-sm font-medium">End of Manga</span>
            <span className="text-xs text-white/60">No more chapters</span>
          </div>
        </div>
      )}

      {/* Previous chapter */}
      {isFirstPage && prevChapter && onNavigateToChapter && (
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
      {isLastPage && nextChapter && onNavigateToChapter && (
        <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-0 bottom-0 flex items-center px-6 z-20`}>
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
        </div>
      )}

      {/* Page image */}
      <div
        className="relative z-10 flex h-full w-full items-center justify-center p-2 md:p-4"
      >
        <img
          src={currentPageData.url}
          alt={`Page ${currentPage + 1}`}
          style={getImageStyles()}
          className="pointer-events-none select-none transition-opacity duration-200"
          loading={currentPage === 0 ? "eager" : "lazy"}
        />
      </div>
    </div>
  );
};

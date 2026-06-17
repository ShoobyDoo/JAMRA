import React, { useRef } from "react";
import { useReaderSettings } from "../../../store/useReaderSettingsStore";
import { IconChevronRight, IconChevronLeft } from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";
import {
  READER_BACKGROUNDS,
  getPageFitStyles,
  PageLoadingPlaceholder,
  useHotZoneHandlers,
  ChapterTransitionOverlay,
} from "./shared";
import type { ChapterRef } from "./shared";

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
  nextChapter?: ChapterRef | null;
  prevChapter?: ChapterRef | null;
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

  const currentPageData = pages[currentPage];
  const isRTL = readingMode === "paged-rtl";
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

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

  const { handleMouseMove, handleMouseLeave } = useHotZoneHandlers(readerControls, containerRef);

  if (!currentPageData) return (
    <PageLoadingPlaceholder
      pageNumber={currentPage + 1}
      containerRef={containerRef}
      className={READER_BACKGROUNDS[backgroundColor]}
    />
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex h-full w-full cursor-pointer overflow-hidden justify-center ${
        pageFit === "width" ? "items-start" : "items-center"
      } ${READER_BACKGROUNDS[backgroundColor]}`}
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

      <ChapterTransitionOverlay
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        currentPage={currentPage}
        totalPages={totalPages}
        isRTL={isRTL}
        onNavigateToChapter={onNavigateToChapter}
      />

      {/* Page image */}
      <div
        className={`relative z-10 flex h-full w-full justify-center p-2 md:p-4 ${
          pageFit === "width" ? "items-start" : "items-center"
        }`}
      >
        <img
          src={currentPageData.url}
          alt={`Page ${currentPage + 1}`}
          style={getPageFitStyles(pageFit, customWidth, currentPageData ?? undefined)}
          className="pointer-events-none select-none transition-opacity duration-200"
          loading={currentPage === 0 ? "eager" : "lazy"}
        />
      </div>
    </div>
  );
};

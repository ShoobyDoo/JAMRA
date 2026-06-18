import React, { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useReaderSettings } from "../../../store/useReaderSettingsStore";
import { IconCircleCheck, IconLoader2 } from "@tabler/icons-react";
import type { useReaderControls } from "../../../hooks/useReaderControls";
import { ChapterTransitionOverlay } from "./shared";
import {
  READER_BACKGROUNDS,
  getPageFitStyles,
  useHotZoneHandlers,
} from "./shared-utils";
import type { ChapterRef } from "./shared-utils";

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
  // True while a programmatic/corrective scroll (scrollToIndex) is in flight.
  // Guards the scroll handler so its own corrective scrolls don't re-trigger
  // page detection, which would otherwise feed back into more corrective
  // scrolls and cause visible jumps.
  const programmaticScrollRef = useRef(false);
  // Set to true immediately before detectCurrentPage calls onPageChange, and
  // read (then cleared) by the corrective scrollToIndex effect below. This is
  // what distinguishes the two reasons currentPage can change:
  //   1. The user scrolled naturally, detection noticed a new closest page,
  //      and called onPageChange to keep the parent's currentPage in sync.
  //      In this case the user's own scroll position IS already correct —
  //      no corrective scrollToIndex should run, or it will yank the
  //      viewport against the user's active scroll motion (the bug this
  //      flag fixes).
  //   2. Something external (page slider, keyboard nav, chapter-load initial
  //      position, etc.) changed currentPage directly. In this case the
  //      viewport has NOT moved yet and DOES need a corrective scrollToIndex
  //      to catch up.
  // Without this flag, the corrective effect can't tell those apart — it
  // only knows currentPage changed, not why.
  const detectionOriginatedChangeRef = useRef(false);
  // Pending requestAnimationFrame handle used to throttle page detection to
  // at most once per frame instead of once per scroll event.
  const detectionRafRef = useRef<number | null>(null);

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

  // Detect the page that is currently aligned to the top of the viewport.
  // Uses "start" alignment to match scrollToIndex's "start" alignment below —
  // using the same alignment for detection and correction is what prevents
  // the two from fighting each other.
  const detectCurrentPage = () => {
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;

    let closestIndex = virtualItems[0].index;
    let closestDistance = Math.abs(virtualItems[0].start - scrollTop);

    for (const item of virtualItems) {
      const distance = Math.abs(item.start - scrollTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = item.index;
      }
    }

    if (currentPageRef.current !== closestIndex) {
      currentPageRef.current = closestIndex;
      // Mark this onPageChange call as detection-originated so the
      // corrective effect below knows not to scrollToIndex in response —
      // the user's own scroll position already IS the correct position.
      detectionOriginatedChangeRef.current = true;
      onPageChange(closestIndex);
    }
  };

  useEffect(() => {
    // Skip page-change-driven scroll corrections while a programmatic scroll
    // we just initiated is still settling — currentPage changes that
    // originate from our own detection logic shouldn't trigger another
    // scrollToIndex call.
    if (programmaticScrollRef.current) return;

    // Skip corrections for currentPage changes that originated from our own
    // scroll-detection logic (the user naturally scrolled to this page —
    // nothing to correct). Only run scrollToIndex for externally-triggered
    // changes (page slider, keyboard nav, chapter-load initial position).
    if (detectionOriginatedChangeRef.current) {
      detectionOriginatedChangeRef.current = false;
      return;
    }

    programmaticScrollRef.current = true;
    virtualizer.scrollToIndex(currentPage, { align: "start", behavior: "auto" });

    // The corrective scroll fires its own scroll event(s) synchronously/near
    // -synchronously. Clear the guard on the next animation frame, after the
    // browser has had a chance to dispatch the resulting scroll event(s), so
    // the scroll handler's RAF-throttled detection sees the guard set during
    // that window and ignores it.
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, [currentPage, virtualizer]);

  useEffect(() => {
    return () => {
      if (detectionRafRef.current !== null) {
        cancelAnimationFrame(detectionRafRef.current);
      }
    };
  }, []);

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
    // Ignore scroll events caused by our own corrective scrollToIndex calls —
    // otherwise detection re-fires onPageChange mid-correction, which can
    // schedule another corrective scroll and produce visible jitter/jumps.
    if (programmaticScrollRef.current) return;

    readerControls.hideControls();

    // Throttle page detection to once per animation frame instead of once
    // per scroll event.
    if (detectionRafRef.current !== null) {
      cancelAnimationFrame(detectionRafRef.current);
    }
    detectionRafRef.current = requestAnimationFrame(() => {
      detectionRafRef.current = null;
      detectCurrentPage();
    });
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
          const fitStyles = getPageFitStyles(pageFit, customWidth, page ?? undefined);

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
              }}
              className="flex w-full items-center justify-center"
            >
              {page ? (
                <img
                  src={page.url}
                  alt={`Page ${page.index + 1}`}
                  style={{
                    ...fitStyles,
                    display: "block",
                  }}
                  className="select-none"
                  loading={eagerLoad ? "eager" : "lazy"}
                />
              ) : (
                <div
                  className="w-full max-w-full select-none flex items-center justify-center"
                  style={{ height: placeholderHeight, ...fitStyles }}
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

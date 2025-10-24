"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useReaderSettings } from "@/store/reader-settings";
import { CheckCircle, Loader2 } from "lucide-react";
import type { useReaderControls } from "@/hooks/use-reader-controls";

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
  nextChapter?: {
    id: string;
    slug: string;
    title?: string;
    number?: string;
  } | null;
  prevChapter?: {
    id: string;
    slug: string;
    title?: string;
    number?: string;
  } | null;
  mangaId?: string;
  mangaSlug?: string;
  readerControls: ReturnType<typeof useReaderControls>;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const DEFAULT_PLACEHOLDER_HEIGHT = 900;

export function VerticalMode({
  pages,
  currentPage,
  totalPages,
  onPageChange,
  nextChapter,
  mangaId,
  mangaSlug,
  readerControls,
  onPrevPage,
  onNextPage,
}: VerticalModeProps) {
  const router = useRouter();
  const routeSlug = mangaSlug ?? mangaId;
  const { backgroundColor, gapSize, pageFit, customWidth } =
    useReaderSettings();

  // Check if we have loaded pages
  const hasLoadedPages = pages.some((page) => page !== null);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(currentPage);
  const skipScrollRef = useRef(false);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Virtualized list for better performance with many pages
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      const page = pages[index];
      return page?.height ?? DEFAULT_PLACEHOLDER_HEIGHT + gapSize;
    },
    overscan: 3, // Render 3 extra pages above/below viewport
  });

  // Detect current page based on scroll position and virtual items
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    // Find the page that's most visible in the viewport
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const viewportCenter = scrollTop + viewportHeight / 2;

    // Find the virtual item closest to viewport center
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

  // Scroll to current page when it changes externally
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    virtualizer.scrollToIndex(currentPage, {
      align: "start",
      behavior: "auto",
    });
  }, [currentPage, virtualizer]);

  const getImageWidth = () => {
    switch (pageFit) {
      case "width":
        return "100%";
      case "height":
      case "auto":
        return "auto";
      case "original":
        return "auto";
      case "custom":
        return `${customWidth}%`;
      default:
        return "100%";
    }
  };

  const backgroundColors: Record<string, string> = {
    black: "bg-black",
    white: "bg-white",
    sepia: "bg-[#f4ecd8]",
    "dark-gray": "bg-gray-900",
  };

  const imageWidthValue = getImageWidth();

  // Handle mouse move to detect hot zones
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      readerControls.updateHotZone(e.clientX, e.clientY, containerRef.current);
    }
  };

  // Handle mouse leave to clear hot zone
  const handleMouseLeave = () => {
    readerControls.clearHotZone();
  };

  // Handle click events based on hot zone
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const zone = readerControls.getHotZone(
      e.clientX,
      e.clientY,
      containerRef.current,
    );

    if (zone === "center") {
      // Toggle controls visibility
      readerControls.toggleControls();
    } else if (zone === "top") {
      // Navigate to previous page (scroll up)
      readerControls.hideControls();
      onPrevPage();
    } else if (zone === "bottom") {
      // Navigate to next page (scroll down)
      readerControls.hideControls();
      onNextPage();
    }
  };

  // Handle scroll to hide controls and detect scrolling state
  const handleScroll = () => {
    readerControls.hideControls();
    setIsScrolling(true);

    // Debounce scroll end detection
    const timeout = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    return () => clearTimeout(timeout);
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-y-auto touch-pan-y ${backgroundColors[backgroundColor]}`}
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
                <Image
                  src={page.url}
                  alt={`Page ${page.index + 1}`}
                  width={page.width ?? 1080}
                  height={page.height ?? placeholderHeight}
                  style={{
                    width: imageWidthValue,
                    height: "auto",
                    maxWidth: "100%",
                    display: "block",
                  }}
                  className="select-none"
                  quality={95}
                  unoptimized
                  loading={eagerLoad ? "eager" : "lazy"}
                />
              ) : (
                <div
                  className="w-full max-w-full select-none flex items-center justify-center"
                  style={{
                    height: placeholderHeight,
                    width: imageWidthValue,
                    maxWidth: "100%",
                  }}
                >
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background/50 backdrop-blur-sm px-6 py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                    <span className="text-sm text-foreground">
                      Loading page {pageIndex + 1}...
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* End of chapter section - only show after pages are loaded */}
        {hasLoadedPages && (
          <div
            style={{
              position: "absolute",
              top: virtualizer.getTotalSize(),
              left: 0,
              width: "100%",
            }}
            className="flex flex-col items-center justify-center gap-4 py-12 min-h-[400px]"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-muted px-8 py-6 text-center">
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
                <span className="text-lg font-medium">Chapter Complete</span>
                <span className="text-sm text-muted-foreground">
                  {nextChapter
                    ? "Use hot zones to navigate to next chapter"
                    : "No more chapters available"}
                </span>
              </div>

              {routeSlug && (
                <button
                  onClick={() =>
                    router.push(`/manga/${encodeURIComponent(routeSlug)}`)
                  }
                  className="mt-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  Return to Manga Details
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

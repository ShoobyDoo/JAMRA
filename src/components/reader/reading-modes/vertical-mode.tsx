"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  const { backgroundColor, gapSize, pageFit, customWidth } = useReaderSettings();

  // Check if we have loaded pages
  const hasLoadedPages = pages.some((page) => page !== null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const currentPageRef = useRef(currentPage);
  const skipScrollRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-page-index"));
          if (Number.isNaN(index)) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            if (programmaticScrollRef.current) return;
            if (currentPageRef.current !== index) {
              currentPageRef.current = index;
              skipScrollRef.current = true;
              onPageChange(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.6,
      }
    );

    observerRef.current = observer;
    pageRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [onPageChange, pages.length]);

  useEffect(() => {
    const target = pageRefs.current[currentPage];
    if (!target) return;

    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    programmaticScrollRef.current = true;
    target.scrollIntoView({ behavior: "auto", block: "start" });
    const timeout = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [currentPage]);

  const setPageRef = (index: number, element: HTMLDivElement | null) => {
    const existing = pageRefs.current[index];
    if (existing && observerRef.current) {
      observerRef.current.unobserve(existing);
    }

    pageRefs.current[index] = element;

    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  };

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

    const zone = readerControls.getHotZone(e.clientX, e.clientY, containerRef.current);

    if (zone === 'center') {
      // Toggle controls visibility
      readerControls.toggleControls();
    } else if (zone === 'top') {
      // Navigate to previous page (scroll up)
      readerControls.hideControls();
      onPrevPage();
    } else if (zone === 'bottom') {
      // Navigate to next page (scroll down)
      readerControls.hideControls();
      onNextPage();
    }
  };

  // Handle scroll to hide controls
  const handleScroll = () => {
    readerControls.hideControls();
  };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-y-auto ${backgroundColors[backgroundColor]} relative`}
      style={{
        scrollBehavior: "auto",
        overscrollBehavior: "auto",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onScroll={handleScroll}
    >
      <div className="flex flex-col items-center">
        {pages.map((page, arrayIndex) => {
          const pageIndex = page?.index ?? arrayIndex;
          const eagerLoad = pageIndex <= currentPage + 2;
          const placeholderHeight = page?.height ?? DEFAULT_PLACEHOLDER_HEIGHT;

          return (
            <div
              key={pageIndex}
              ref={(el) => setPageRef(pageIndex, el)}
              data-page-index={pageIndex}
              className="flex w-full items-center justify-center"
              style={{
                marginBottom: pageIndex < totalPages - 1 ? gapSize : 0,
                minHeight: placeholderHeight,
              }}
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
          <div className="flex flex-col items-center justify-center gap-4 py-12 min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-muted px-8 py-6 text-center">
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
                <span className="text-lg font-medium">
                  Chapter Complete
                </span>
                <span className="text-sm text-muted-foreground">
                  {nextChapter ? 'Use hot zones to navigate to next chapter' : 'No more chapters available'}
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

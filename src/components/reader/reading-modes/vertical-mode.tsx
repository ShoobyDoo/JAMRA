"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReaderSettings } from "@/store/reader-settings";
import { ChevronDown, CheckCircle, Loader2 } from "lucide-react";

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
}

const DEFAULT_PLACEHOLDER_HEIGHT = 900;

export function VerticalMode({
  pages,
  currentPage,
  totalPages,
  onPageChange,
  nextChapter,
  prevChapter,
  mangaId,
  mangaSlug,
}: VerticalModeProps) {
  const router = useRouter();
  const routeSlug = mangaSlug ?? mangaId;
  const { backgroundColor, gapSize, pageFit, customWidth, autoAdvanceChapter } =
    useReaderSettings();
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // Check if we have loaded pages
  const hasLoadedPages = pages.some((page) => page !== null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const currentPageRef = useRef(currentPage);
  const skipScrollRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Auto-advance to next chapter when reaching the end
  useEffect(() => {
    if (!autoAdvanceChapter || !nextChapter || !routeSlug) {
      return;
    }

    // Check if we're at the last page and all pages are loaded
    const isAtEnd = currentPage === totalPages - 1;
    const allPagesLoaded = pages.every((page) => page !== null);

    if (isAtEnd && allPagesLoaded && !isAutoAdvancing) {
      // Set a timer to auto-advance after a short delay (2 seconds)
      autoAdvanceTimerRef.current = setTimeout(() => {
        setIsAutoAdvancing(true);
        router.push(
          `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`
        );
      }, 2000);
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [
    autoAdvanceChapter,
    currentPage,
    totalPages,
    nextChapter,
    routeSlug,
    pages,
    router,
    isAutoAdvancing,
  ]);

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

  const handleCancelAutoAdvance = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
    setIsAutoAdvancing(false);
  };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-y-auto ${backgroundColors[backgroundColor]}`}
      style={{
        scrollBehavior: "auto",
        overscrollBehavior: "auto",
      }}
    >
      <div className="flex flex-col items-center">
        {/* Only show prev chapter button after pages start loading */}
        {hasLoadedPages && prevChapter && routeSlug && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <button
              onClick={() =>
                router.push(
                  `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(prevChapter.slug)}?page=last`
                )
              }
              className="flex flex-col items-center gap-2 rounded-lg bg-primary px-6 py-4 text-primary-foreground transition hover:bg-primary/90"
            >
              <ChevronDown className="h-6 w-6 rotate-180" />
              <span className="text-sm font-medium">Previous Chapter</span>
              <span className="text-xs opacity-80">
                {prevChapter.title ||
                  `Chapter ${prevChapter.number || prevChapter.slug}`}
              </span>
            </button>
          </div>
        )}

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
            {nextChapter && routeSlug ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-6 w-6" />
                  <span className="text-lg font-medium">Chapter Complete</span>
                </div>

                {autoAdvanceChapter && !isAutoAdvancing && (
                  <div className="text-center text-sm text-muted-foreground">
                    Auto-advancing to next chapter in 2 seconds...
                    <button
                      onClick={handleCancelAutoAdvance}
                      className="ml-2 text-primary underline hover:text-primary/80"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {isAutoAdvancing && (
                  <div className="text-center text-sm text-muted-foreground">
                    Loading next chapter...
                  </div>
                )}

                <button
                  onClick={() =>
                    router.push(
                      `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`
                    )
                  }
                  className="flex flex-col items-center gap-2 rounded-lg bg-primary px-8 py-5 text-primary-foreground transition hover:bg-primary/90"
                >
                  <ChevronDown className="h-6 w-6" />
                  <span className="text-base font-medium">Next Chapter</span>
                  <span className="text-xs opacity-80">
                    {nextChapter.title ||
                      `Chapter ${nextChapter.number || nextChapter.slug}`}
                  </span>
                </button>

                <button
                  onClick={() =>
                    router.push(`/manga/${encodeURIComponent(routeSlug)}`)
                  }
                  className="mt-2 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Exit Reader
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2 rounded-lg bg-muted px-8 py-6 text-center">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  <span className="text-lg font-medium">
                    You&apos;ve reached the end
                  </span>
                  <span className="text-sm text-muted-foreground">
                    No more chapters available
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

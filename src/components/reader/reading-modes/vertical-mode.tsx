"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReaderSettings } from "@/store/reader-settings";
import { useDragScroll } from "../hooks/use-drag-scroll";
import { ChevronDown } from "lucide-react";

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
  nextChapter?: { id: string; slug: string; title?: string; number?: string } | null;
  prevChapter?: { id: string; slug: string; title?: string; number?: string } | null;
  mangaId?: string;
  mangaSlug?: string;
}

const OVERSCAN = 3;
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
  const { backgroundColor, gapSize, pageFit, scrollSpeed, customWidth } = useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const visibleIndexesRef = useRef<Set<number>>(new Set());
  const measurementsRef = useRef<Map<number, number>>(new Map());
  const [, forceMeasurementUpdate] = useState(0);
  const isScrollingProgrammatically = useRef(false);
  const currentPageRef = useRef(currentPage);
  const [virtualWindow, setVirtualWindow] = useState(() => {
    const maxIndex = Math.max(totalPages - 1, 0);
    const normalizedCurrent = Math.min(Math.max(currentPage, 0), maxIndex);
    return {
      start: Math.max(0, normalizedCurrent - OVERSCAN),
      end: Math.min(maxIndex, normalizedCurrent + OVERSCAN),
    };
  });

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const recomputeWindow = useCallback(
    (extraIndex?: number) => {
      const indexes = new Set(visibleIndexesRef.current);
      if (typeof extraIndex === "number" && extraIndex >= 0) {
        indexes.add(extraIndex);
      }

      const maxIndex = Math.max(totalPages - 1, 0);
      const normalizedCurrent = Math.min(Math.max(currentPage, 0), maxIndex);

      if (indexes.size === 0) {
        const start = Math.max(0, normalizedCurrent - OVERSCAN);
        const end = Math.min(maxIndex, normalizedCurrent + OVERSCAN);
        setVirtualWindow((prev) =>
          prev.start === start && prev.end === end ? prev : { start, end },
        );
        return;
      }

      const sorted = Array.from(indexes).sort((a, b) => a - b);
      const start = Math.max(0, Math.min(sorted[0], maxIndex) - OVERSCAN);
      const end = Math.min(
        maxIndex,
        Math.max(sorted[sorted.length - 1], 0) + OVERSCAN,
      );
      setVirtualWindow((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    },
    [currentPage, totalPages],
  );

  useEffect(() => {
    recomputeWindow(currentPage);
  }, [currentPage, recomputeWindow]);

  useEffect(() => {
    recomputeWindow(currentPage);
  }, [pages, currentPage, recomputeWindow]);

  // Scroll to current page when it changes externally
  useEffect(() => {
    const pageElement = pageRefs.current.get(currentPage);
    if (pageElement && !isScrollingProgrammatically.current) {
      pageElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [currentPage]);

  // Track which page is visible & update virtual window
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let windowChanged = false;

        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-page-index"));
          if (Number.isNaN(index)) return;

          if (entry.isIntersecting) {
            if (!visibleIndexesRef.current.has(index)) {
              visibleIndexesRef.current.add(index);
              windowChanged = true;
            }

            if (
              !isScrollingProgrammatically.current &&
              index !== currentPageRef.current
            ) {
              isScrollingProgrammatically.current = true;
              onPageChange(index);
              window.setTimeout(() => {
                isScrollingProgrammatically.current = false;
              }, 100);
            }
          } else if (visibleIndexesRef.current.delete(index)) {
            windowChanged = true;
          }
        });

        if (windowChanged) {
          recomputeWindow();
        }
      },
      {
        root: container,
        threshold: 0.45,
      },
    );

    intersectionObserverRef.current = observer;
    pageRefs.current.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
    };
  }, [onPageChange, recomputeWindow]);

  // Observe page size changes to build placeholder heights
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver((entries) => {
      let updated = false;
      for (const entry of entries) {
        const index = Number(entry.target.getAttribute("data-page-index"));
        if (Number.isNaN(index)) continue;

        const height = entry.contentRect.height;
        if (!height || height <= 0) continue;

        const currentHeight = measurementsRef.current.get(index);
        if (currentHeight !== height) {
          measurementsRef.current.set(index, height);
          updated = true;
        }
      }

      if (updated) {
        forceMeasurementUpdate((value) => value + 1);
      }
    });

    resizeObserverRef.current = resizeObserver;
    pageRefs.current.forEach((element) => resizeObserver.observe(element));

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  const setPageRef = useCallback(
    (index: number, element: HTMLDivElement | null) => {
      const existing = pageRefs.current.get(index);
      if (existing && existing !== element) {
        intersectionObserverRef.current?.unobserve(existing);
        resizeObserverRef.current?.unobserve(existing);
        pageRefs.current.delete(index);
      }

      if (element) {
        pageRefs.current.set(index, element);
        if (intersectionObserverRef.current) {
          intersectionObserverRef.current.observe(element);
        }
        if (resizeObserverRef.current) {
          resizeObserverRef.current.observe(element);
        }
      } else {
        if (pageRefs.current.has(index)) {
          pageRefs.current.delete(index);
        }
        if (visibleIndexesRef.current.delete(index)) {
          recomputeWindow(currentPage);
        }
        measurementsRef.current.delete(index);
      }
    },
    [currentPage, recomputeWindow],
  );

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

  const backgroundColors = {
    black: "bg-black",
    white: "bg-white",
    sepia: "bg-[#f4ecd8]",
    "dark-gray": "bg-gray-900",
  };

  // Enable drag scrolling
  useDragScroll(containerRef);

  // Apply custom scroll speed via CSS
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scroll speed multiplier (1-10 scale to 0.5x-2x)
    const scrollMultiplier = 0.5 + (scrollSpeed / 10) * 1.5;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      container.scrollBy({
        top: e.deltaY * scrollMultiplier,
        behavior: "auto",
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [scrollSpeed]);

  const isWithinWindow = useCallback(
    (index: number) => index >= virtualWindow.start && index <= virtualWindow.end,
    [virtualWindow.end, virtualWindow.start],
  );

  const imageWidthValue = getImageWidth();

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-y-auto ${backgroundColors[backgroundColor]}`}
      style={{
        scrollBehavior: "smooth",
        overscrollBehavior: "contain",
      }}
    >
      <div className="flex flex-col items-center">
        {/* Previous chapter indicator at top */}
        {prevChapter && routeSlug && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <button
              onClick={() =>
                router.push(
                  `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(prevChapter.slug)}?page=last`,
                )
              }
              className="flex flex-col items-center gap-2 rounded-lg bg-primary px-6 py-4 text-primary-foreground transition hover:bg-primary/90"
            >
              <ChevronDown className="h-6 w-6 rotate-180" />
              <span className="text-sm font-medium">Previous Chapter</span>
              <span className="text-xs opacity-80">
                {prevChapter.title || `Chapter ${prevChapter.number || prevChapter.slug}`}
              </span>
            </button>
          </div>
        )}

        {pages.map((page, arrayIndex) => {
          const pageIndex = page?.index ?? arrayIndex;
          const shouldRenderImage = page !== null && isWithinWindow(pageIndex);
          const measuredHeight =
            measurementsRef.current.get(pageIndex) ?? page?.height ?? DEFAULT_PLACEHOLDER_HEIGHT;
          const eagerLoad = pageIndex <= currentPage + 2;

          return (
            <div
              key={pageIndex}
              ref={(el) => setPageRef(pageIndex, el)}
              data-page-index={pageIndex}
              className="flex w-full items-center justify-center"
              style={{
                marginBottom: pageIndex < totalPages - 1 ? gapSize : 0,
                minHeight: shouldRenderImage ? measuredHeight : undefined,
              }}
            >
              {shouldRenderImage && page ? (
                <Image
                  src={page.url}
                  alt={`Page ${page.index + 1}`}
                  width={page.width ?? 1080}
                  height={page.height ?? 1920}
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
                  className="w-full max-w-full select-none rounded-md bg-muted/30"
                  style={{
                    height: measuredHeight,
                    width: imageWidthValue,
                    maxWidth: "100%",
                  }}
                />
              )}
            </div>
          );
        })}

        {/* End of chapter indicator */}
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          {nextChapter && routeSlug ? (
            <button
              onClick={() =>
                router.push(
                  `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`,
                )
              }
              className="flex flex-col items-center gap-2 rounded-lg bg-primary px-6 py-4 text-primary-foreground transition hover:bg-primary/90"
            >
              <ChevronDown className="h-6 w-6" />
              <span className="text-sm font-medium">Next Chapter</span>
              <span className="text-xs opacity-80">
                {nextChapter.title || `Chapter ${nextChapter.number || nextChapter.slug}`}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg bg-muted px-6 py-4 text-muted-foreground">
              <span className="text-sm font-medium">End of Manga</span>
              <span className="text-xs">No more chapters available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

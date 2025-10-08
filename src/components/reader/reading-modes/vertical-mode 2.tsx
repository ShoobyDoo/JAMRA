"use client";

import { useEffect, useRef, useCallback } from "react";
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
  }>;
  currentPage: number;
  totalPages: number;
  onPageChange: (pageIndex: number) => void;
  nextChapter?: { id: string; slug: string; title?: string; number?: string } | null;
  prevChapter?: { id: string; slug: string; title?: string; number?: string } | null;
  mangaId?: string;
  mangaSlug?: string;
}

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
  const isScrollingProgrammatically = useRef(false);

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

  // Track which page is currently visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageIndex = Number(entry.target.getAttribute("data-page-index"));
            if (!isNaN(pageIndex) && pageIndex !== currentPage) {
              isScrollingProgrammatically.current = true;
              onPageChange(pageIndex);
              // Reset flag after a short delay
              setTimeout(() => {
                isScrollingProgrammatically.current = false;
              }, 100);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5, // Consider page visible when 50% is in view
      }
    );

    // Observe all page elements
    pageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [currentPage, onPageChange]);

  const setPageRef = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(index, element);
    } else {
      pageRefs.current.delete(index);
    }
  }, []);

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
              onClick={() => router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(prevChapter.slug)}?page=last`)}
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

        {pages.map((page, index) => (
          <div
            key={page.index}
            ref={(el) => setPageRef(page.index, el)}
            data-page-index={page.index}
            className="flex w-full items-center justify-center"
            style={{
              marginBottom: page.index < totalPages - 1 ? gapSize : 0,
            }}
          >
            <Image
              src={page.url}
              alt={`Page ${page.index + 1}`}
              width={page.width ?? 1080}
              height={page.height ?? 1920}
              style={{
                width: getImageWidth(),
                height: "auto",
                maxWidth: "100%",
                display: "block",
              }}
              className="select-none"
              quality={95}
              unoptimized
              loading={index <= currentPage + 2 ? "eager" : "lazy"}
            />
          </div>
        ))}

        {/* End of chapter indicator */}
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          {nextChapter && routeSlug ? (
            <button
              onClick={() => router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`)}
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

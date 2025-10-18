"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReaderSettings } from "@/store/reader-settings";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

interface DualPageModeProps {
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

export function DualPageMode({
  pages,
  currentPage,
  totalPages,
  onPageChange,
  nextChapter,
  prevChapter,
  mangaId,
  mangaSlug,
}: DualPageModeProps) {
  const router = useRouter();
  const { pageFit, backgroundColor, dualPageGap, readingMode, customWidth } = useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [showDragCursor, setShowDragCursor] = useState(false);

  const isRTL = readingMode === "paged-rtl";
  const routeSlug = mangaSlug ?? mangaId;

  // Calculate which pages to show
  const getDisplayPages = () => {
    // For dual-page, show current and next page
    // If on last page and odd total, show just that page
    const leftPageIndex = isRTL ? currentPage + 1 : currentPage;
    const rightPageIndex = isRTL ? currentPage : currentPage + 1;

    return {
      left: pages[leftPageIndex] ?? null,
      right: rightPageIndex < pages.length ? pages[rightPageIndex] ?? null : null,
    };
  };

  const displayPages = getDisplayPages();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isDragging.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercentage = clickX / rect.width;

    // Advance by 2 pages (or 1 if at end)
    const step = displayPages.right ? 2 : 1;

    if (isRTL) {
      if (clickPercentage > 0.5 && currentPage > 0) {
        onPageChange(Math.max(0, currentPage - step));
      } else if (clickPercentage <= 0.5) {
        if (currentPage < totalPages - 1) {
          onPageChange(Math.min(totalPages - 1, currentPage + step));
        } else if (nextChapter && routeSlug) {
          router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`);
        }
      }
    } else {
      if (clickPercentage < 0.5 && currentPage > 0) {
        onPageChange(Math.max(0, currentPage - step));
      } else if (clickPercentage >= 0.5) {
        if (currentPage < totalPages - 1) {
          onPageChange(Math.min(totalPages - 1, currentPage + step));
        } else if (nextChapter && routeSlug) {
          router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`);
        }
      }
    }
  };

  // Drag to navigate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const DRAG_THRESHOLD = 100;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.closest("button")) {
        return;
      }

      isDragging.current = false;
      startX.current = e.clientX;
      setDragOffset(0);
      setShowDragCursor(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (startX.current === 0) return;
      const delta = e.clientX - startX.current;
      if (Math.abs(delta) > 5) {
        isDragging.current = true;
      }
      // Update visual offset in real-time
      setDragOffset(delta);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (startX.current === 0) return;

      const dragDelta = e.clientX - startX.current;
      setShowDragCursor(false);

      const step = displayPages.right ? 2 : 1;

      if (Math.abs(dragDelta) > DRAG_THRESHOLD) {
        if (isRTL) {
          // RTL: drag left = next, drag right = prev
          if (dragDelta < 0) {
            if (currentPage < totalPages - 1) {
              onPageChange(Math.min(totalPages - 1, currentPage + step));
            } else if (nextChapter && routeSlug) {
              router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`);
            }
          } else if (dragDelta > 0 && currentPage > 0) {
            onPageChange(Math.max(0, currentPage - step));
          }
        } else {
          // LTR: drag left = next, drag right = prev
          if (dragDelta < 0) {
            if (currentPage < totalPages - 1) {
              onPageChange(Math.min(totalPages - 1, currentPage + step));
            } else if (nextChapter && routeSlug) {
              router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`);
            }
          } else if (dragDelta > 0 && currentPage > 0) {
            onPageChange(Math.max(0, currentPage - step));
          }
        }
      }

      // Reset with animation
      setDragOffset(0);
      startX.current = 0;
      setTimeout(() => {
        isDragging.current = false;
      }, 50);
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [currentPage, totalPages, onPageChange, displayPages.right, nextChapter, routeSlug, router, isRTL]);

  const getImageStyles = (page: typeof displayPages.left) => {
    if (!page) return {};

    switch (pageFit) {
      case "width":
        return {
          width: "100%",
          height: "auto",
          maxHeight: "100%",
          objectFit: "contain" as const,
        };

      case "height":
        return {
          width: "auto",
          height: "100%",
          maxWidth: "100%",
          objectFit: "contain" as const,
        };

      case "original":
        return {
          width: page.width ?? "auto",
          height: page.height ?? "auto",
          maxWidth: "100%",
          maxHeight: "100%",
        };

      case "custom":
        return {
          width: `${customWidth}%`,
          height: "auto",
          maxHeight: "100%",
          objectFit: "contain" as const,
        };

      case "auto":
      default:
        return {
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain" as const,
        };
    }
  };

  const backgroundColors = {
    black: "bg-black",
    white: "bg-white",
    sepia: "bg-[#f4ecd8]",
    "dark-gray": "bg-gray-900",
  };

  const renderPage = (page: typeof displayPages.left, key: string, pageIndex: number) => (
    <div key={key} className="flex h-full items-center justify-center">
      {page ? (
        <Image
          src={page.url}
          alt={`Page ${page.index + 1}`}
          width={page.width ?? 1920}
          height={page.height ?? 1080}
          style={getImageStyles(page)}
          className="pointer-events-none select-none transition-opacity duration-200"
          quality={95}
          unoptimized
        />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background/50 backdrop-blur-sm px-6 py-4">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          <span className="text-xs text-foreground">Loading page {pageIndex + 1}...</span>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${backgroundColors[backgroundColor]}`}
    >
      {/* Hot-edge navigation with chevron arrows */}
      <div className="absolute inset-0 flex pointer-events-none">
        {/* Left edge */}
        <div className="relative flex-1 group">
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 pl-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${currentPage > 0 || isRTL ? 'block' : 'hidden'}`}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <ChevronLeft className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        {/* Right edge */}
        <div className="relative flex-1 group">
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${currentPage < totalPages - 1 || !isRTL ? 'block' : 'hidden'}`}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <ChevronRight className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Previous chapter indicator (left side for LTR, right side for RTL) */}
      {currentPage === 0 && prevChapter && routeSlug && (
        <div
          className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 flex items-center px-6 z-20`}
        >
          <button
            onClick={() => router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(prevChapter.slug)}?page=last`)}
            className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white transition hover:bg-black/90"
          >
            {isRTL ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
            <span className="text-xs text-center">
              {prevChapter.title || `Chapter ${prevChapter.number || prevChapter.slug}`}
            </span>
            <span className="text-xs text-white/60">Previous Chapter</span>
          </button>
        </div>
      )}

      {/* Next chapter or end indicator (right side for LTR, left side for RTL) */}
      {currentPage >= totalPages - 1 && (
        <div
          className={`absolute ${isRTL ? "left-0" : "right-0"} top-0 bottom-0 flex items-center px-6 z-20`}
        >
          {nextChapter && routeSlug ? (
            <button
              onClick={() => router.push(`/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`)}
              className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white transition hover:bg-black/90"
            >
              {isRTL ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
              <span className="text-xs text-center">
                {nextChapter.title || `Chapter ${nextChapter.number || nextChapter.slug}`}
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

      {/* Dual pages */}
      <div
        ref={pagesRef}
        className="relative z-10 flex h-full items-center justify-center gap-0 transition-transform"
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: dragOffset === 0 ? 'transform 0.2s ease-out' : 'none',
          cursor: showDragCursor ? 'grabbing' : 'default',
        }}
      >
        <div
          className="flex h-full items-center justify-center"
          style={{ paddingRight: displayPages.right ? dualPageGap / 2 : 0 }}
        >
          {renderPage(displayPages.left, "left", isRTL ? currentPage + 1 : currentPage)}
        </div>

        {displayPages.right ? (
          <div
            className="flex h-full items-center justify-center"
            style={{ paddingLeft: dualPageGap / 2 }}
          >
            {renderPage(displayPages.right, "right", isRTL ? currentPage : currentPage + 1)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

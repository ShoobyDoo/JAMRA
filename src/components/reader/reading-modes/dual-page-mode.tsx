"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReaderSettings } from "@/store/reader-settings";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface DualPageModeProps {
  pages: Array<{
    index: number;
    url: string;
    width?: number;
    height?: number;
  }>;
  currentPage: number;
  onPageChange: (pageIndex: number) => void;
  nextChapter?: { id: string; title?: string; number?: string } | null;
  prevChapter?: { id: string; title?: string; number?: string } | null;
  mangaId?: string;
}

export function DualPageMode({
  pages,
  currentPage,
  onPageChange,
  nextChapter,
  prevChapter,
  mangaId,
}: DualPageModeProps) {
  const router = useRouter();
  const { pageFit, backgroundColor, dualPageGap, readingMode } = useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  const isRTL = readingMode === "paged-rtl";

  // Calculate which pages to show
  const getDisplayPages = () => {
    // For dual-page, show current and next page
    // If on last page and odd total, show just that page
    const leftPageIndex = isRTL ? currentPage + 1 : currentPage;
    const rightPageIndex = isRTL ? currentPage : currentPage + 1;

    return {
      left: pages[leftPageIndex],
      right: rightPageIndex < pages.length ? pages[rightPageIndex] : null,
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
        if (currentPage < pages.length - 1) {
          onPageChange(Math.min(pages.length - 1, currentPage + step));
        } else if (nextChapter && mangaId) {
          router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`);
        }
      }
    } else {
      if (clickPercentage < 0.5 && currentPage > 0) {
        onPageChange(Math.max(0, currentPage - step));
      } else if (clickPercentage >= 0.5) {
        if (currentPage < pages.length - 1) {
          onPageChange(Math.min(pages.length - 1, currentPage + step));
        } else if (nextChapter && mangaId) {
          router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`);
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
      startY.current = e.clientY;
      setDragOffset(0);
      container.style.cursor = "grabbing";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (startY.current === 0) return;
      const delta = startY.current - e.clientY;
      if (Math.abs(delta) > 5) {
        isDragging.current = true;
      }
      // Update visual offset in real-time
      setDragOffset(-delta);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (startY.current === 0) return;

      const dragDelta = startY.current - e.clientY;
      container.style.cursor = "grab";

      const step = displayPages.right ? 2 : 1;

      if (Math.abs(dragDelta) > DRAG_THRESHOLD) {
        if (dragDelta > 0) {
          if (currentPage < pages.length - 1) {
            onPageChange(Math.min(pages.length - 1, currentPage + step));
          } else if (nextChapter && mangaId) {
            router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`);
          }
        } else if (dragDelta < 0 && currentPage > 0) {
          onPageChange(Math.max(0, currentPage - step));
        }
      }

      // Reset with animation
      setDragOffset(0);
      startY.current = 0;
      setTimeout(() => {
        isDragging.current = false;
      }, 50);
    };

    container.style.cursor = "grab";

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      container.style.cursor = "";
    };
  }, [currentPage, pages.length, onPageChange, displayPages.right, nextChapter, mangaId, router]);

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

  const PageImage = ({ page }: { page: NonNullable<typeof displayPages.left> }) => (
    <div className="flex items-center justify-center" style={getImageStyles(page)}>
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
    </div>
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${backgroundColors[backgroundColor]}`}
    >
      {/* Navigation hints */}
      <div className="absolute inset-0 flex">
        <div
          className="hover:bg-white/5 flex-1 transition-colors"
          title={isRTL ? "Next pages" : "Previous pages"}
        />
        <div
          className="hover:bg-white/5 flex-1 transition-colors"
          title={isRTL ? "Previous pages" : "Next pages"}
        />
      </div>

      {/* Previous chapter indicator (left side for LTR, right side for RTL) */}
      {currentPage === 0 && prevChapter && mangaId && (
        <div
          className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 flex items-center px-6 z-20`}
        >
          <button
            onClick={() => router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(prevChapter.id)}?page=last`)}
            className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white transition hover:bg-black/90"
          >
            {isRTL ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
            <span className="text-xs text-center">
              {prevChapter.title || `Chapter ${prevChapter.number || prevChapter.id}`}
            </span>
            <span className="text-xs text-white/60">Previous Chapter</span>
          </button>
        </div>
      )}

      {/* Next chapter or end indicator (right side for LTR, left side for RTL) */}
      {currentPage >= pages.length - 1 && (
        <div
          className={`absolute ${isRTL ? "left-0" : "right-0"} top-0 bottom-0 flex items-center px-6 z-20`}
        >
          {nextChapter && mangaId ? (
            <button
              onClick={() => router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`)}
              className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-4 py-3 text-white transition hover:bg-black/90"
            >
              {isRTL ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
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

      {/* Dual pages */}
      <div
        ref={pagesRef}
        className="relative z-10 flex h-full items-center justify-center gap-0 transition-transform"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: dragOffset === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {displayPages.left && (
          <div
            className="flex h-full items-center justify-center"
            style={{ paddingRight: displayPages.right ? dualPageGap / 2 : 0 }}
          >
            <PageImage page={displayPages.left} />
          </div>
        )}

        {displayPages.right && (
          <div
            className="flex h-full items-center justify-center"
            style={{ paddingLeft: dualPageGap / 2 }}
          >
            <PageImage page={displayPages.right} />
          </div>
        )}
      </div>
    </div>
  );
}

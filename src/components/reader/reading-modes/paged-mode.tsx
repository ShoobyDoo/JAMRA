"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReaderSettings } from "@/store/reader-settings";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface PagedModeProps {
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

export function PagedMode({
  pages,
  currentPage,
  onPageChange,
  nextChapter,
  prevChapter,
  mangaId,
}: PagedModeProps) {
  const router = useRouter();
  const { pageFit, backgroundColor, readingMode } = useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const startY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  const currentPageData = pages[currentPage];
  const isRTL = readingMode === "paged-rtl";

  // Update container dimensions
  useEffect(() => {
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

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === pages.length - 1;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isDragging.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercentage = clickX / rect.width;

    // Click on left/right side to navigate
    if (isRTL) {
      if (clickPercentage > 0.5) {
        if (currentPage > 0) {
          onPageChange(currentPage - 1);
        }
        // At first page, clicking back side does nothing (prevChapter indicator shows instead)
      } else {
        if (currentPage < pages.length - 1) {
          onPageChange(currentPage + 1);
        } else if (nextChapter && mangaId) {
          // Auto-advance to next chapter
          router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`);
        }
      }
    } else {
      if (clickPercentage < 0.5) {
        if (currentPage > 0) {
          onPageChange(currentPage - 1);
        }
        // At first page, clicking back side does nothing (prevChapter indicator shows instead)
      } else {
        if (currentPage < pages.length - 1) {
          onPageChange(currentPage + 1);
        } else if (nextChapter && mangaId) {
          // Auto-advance to next chapter
          router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`);
        }
      }
    }
  };

  // Drag to scroll/navigate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const DRAG_THRESHOLD = 100; // pixels to drag to trigger page change

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click

      // Don't activate on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest("input")
      ) {
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

      // Mark as dragging if moved more than 5px
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

      // Check if drag was significant enough for page change
      if (Math.abs(dragDelta) > DRAG_THRESHOLD) {
        if (dragDelta > 0) {
          // Dragged up = next page
          if (currentPage < pages.length - 1) {
            onPageChange(currentPage + 1);
          } else if (nextChapter && mangaId) {
            // Auto-advance to next chapter
            router.push(`/read/${encodeURIComponent(mangaId)}/chapter/${encodeURIComponent(nextChapter.id)}`);
          }
        } else if (dragDelta < 0 && currentPage > 0) {
          // Dragged down = previous page
          onPageChange(currentPage - 1);
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
  }, [currentPage, pages.length, onPageChange, nextChapter, mangaId, router]);

  const getImageStyles = (): React.CSSProperties => {
    if (!currentPageData) return {};

    const aspectRatio =
      currentPageData.width && currentPageData.height
        ? currentPageData.width / currentPageData.height
        : 0;

    switch (pageFit) {
      case "width":
        return {
          width: "100%",
          height: "auto",
          maxHeight: "100%",
          objectFit: "contain",
        };

      case "height":
        return {
          width: "auto",
          height: "100%",
          maxWidth: "100%",
          objectFit: "contain",
        };

      case "original":
        return {
          width: currentPageData.width ?? "auto",
          height: currentPageData.height ?? "auto",
          maxWidth: "100%",
          maxHeight: "100%",
        };

      case "auto":
      default:
        // Auto: fit to container while maintaining aspect ratio
        if (!aspectRatio || !dimensions.width || !dimensions.height) {
          return {
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          };
        }

        const containerAspect = dimensions.width / dimensions.height;

        if (aspectRatio > containerAspect) {
          // Image is wider - fit to width
          return {
            width: "100%",
            height: "auto",
            maxHeight: "100%",
            objectFit: "contain",
          };
        } else {
          // Image is taller - fit to height
          return {
            width: "auto",
            height: "100%",
            maxWidth: "100%",
            objectFit: "contain",
          };
        }
    }
  };

  const backgroundColors = {
    black: "bg-black",
    white: "bg-white",
    sepia: "bg-[#f4ecd8]",
    "dark-gray": "bg-gray-900",
  };

  if (!currentPageData) {
    return (
      <div
        ref={containerRef}
        className={`flex h-full w-full items-center justify-center ${backgroundColors[backgroundColor]}`}
      >
        <p className="text-muted-foreground">No page data</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${backgroundColors[backgroundColor]}`}
    >
      {/* Navigation hints */}
      <div className="absolute inset-0 flex">
        <div
          className={`flex-1 ${isRTL ? "hover:bg-white/5" : "hover:bg-white/5"} transition-colors`}
          title={isRTL ? "Next page" : "Previous page"}
        />
        <div
          className={`flex-1 ${isRTL ? "hover:bg-white/5" : "hover:bg-white/5"} transition-colors`}
          title={isRTL ? "Previous page" : "Next page"}
        />
      </div>

      {/* Previous chapter indicator (left side for LTR, right side for RTL) */}
      {isFirstPage && prevChapter && mangaId && (
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
      {isLastPage && (
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

      {/* Page image */}
      <div
        ref={imageRef}
        className="relative z-10 flex items-center justify-center transition-transform"
        style={{
          ...getImageStyles(),
          transform: `translateY(${dragOffset}px)`,
          transition: dragOffset === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        <Image
          src={currentPageData.url}
          alt={`Page ${currentPage + 1}`}
          width={currentPageData.width ?? 1920}
          height={currentPageData.height ?? 1080}
          style={getImageStyles()}
          className="pointer-events-none select-none transition-opacity duration-200"
          priority={currentPage === 0}
          quality={95}
          unoptimized // Allow direct URL loading from extensions
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useReaderSettings } from "@/store/reader-settings";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import type { useReaderControls } from "@/hooks/use-reader-controls";

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

export function PagedMode({
  pages,
  currentPage,
  totalPages,
  onPageChange,
  nextChapter,
  prevChapter,
  mangaId,
  mangaSlug,
  readerControls,
  onPrevPage,
  onNextPage,
}: PagedModeProps) {
  const router = useRouter();
  const { pageFit, backgroundColor, readingMode, customWidth } =
    useReaderSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [showDragCursor, setShowDragCursor] = useState(false);

  const currentPageData = pages[currentPage];
  const routeSlug = mangaSlug ?? mangaId;
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
  const isLastPage = currentPage === totalPages - 1;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isDragging.current) return;

    const zone = readerControls.getHotZone(
      e.clientX,
      e.clientY,
      containerRef.current,
    );

    if (zone === "center") {
      // Toggle controls visibility
      readerControls.toggleControls();
    } else if (zone === "left") {
      // Navigate based on reading direction
      readerControls.hideControls();
      if (isRTL) {
        // RTL: left side goes forward
        onNextPage();
      } else {
        // LTR: left side goes backward
        onPrevPage();
      }
    } else if (zone === "right") {
      // Navigate based on reading direction
      readerControls.hideControls();
      if (isRTL) {
        // RTL: right side goes backward
        onPrevPage();
      } else {
        // LTR: right side goes forward
        onNextPage();
      }
    }
  };

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
      startX.current = e.clientX;
      setDragOffset(0);
      setShowDragCursor(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (startX.current === 0) return;

      const delta = e.clientX - startX.current;

      // Mark as dragging if moved more than 5px
      if (Math.abs(delta) > 5) {
        isDragging.current = true;
        // Hide controls when dragging
        readerControls.hideControls();
      }

      // Update visual offset in real-time (positive delta = drag right, negative = drag left)
      setDragOffset(delta);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (startX.current === 0) return;

      const dragDelta = e.clientX - startX.current;
      setShowDragCursor(false);

      // Check if drag was significant enough for page change
      if (Math.abs(dragDelta) > DRAG_THRESHOLD) {
        if (isRTL) {
          // RTL mode: drag left = next page, drag right = prev page
          if (dragDelta < 0) {
            // Dragged left = next page
            if (currentPage < totalPages - 1) {
              onPageChange(currentPage + 1);
            } else if (nextChapter && routeSlug) {
              router.push(
                `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`,
              );
            }
          } else if (dragDelta > 0 && currentPage > 0) {
            // Dragged right = previous page
            onPageChange(currentPage - 1);
          }
        } else {
          // LTR mode: drag right = prev page, drag left = next page
          if (dragDelta < 0) {
            // Dragged left = next page
            if (currentPage < totalPages - 1) {
              onPageChange(currentPage + 1);
            } else if (nextChapter && routeSlug) {
              router.push(
                `/read/${encodeURIComponent(routeSlug)}/chapter/${encodeURIComponent(nextChapter.slug)}`,
              );
            }
          } else if (dragDelta > 0 && currentPage > 0) {
            // Dragged right = previous page
            onPageChange(currentPage - 1);
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
  }, [
    currentPage,
    totalPages,
    onPageChange,
    nextChapter,
    routeSlug,
    router,
    isRTL,
    readerControls,
  ]);

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

      case "custom":
        return {
          width: `${customWidth}%`,
          height: "auto",
          maxHeight: "100%",
          objectFit: "contain",
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

  const renderLoading = () => (
    <div
      ref={containerRef}
      className={`flex h-full w-full items-center justify-center ${backgroundColors[backgroundColor]}`}
    >
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background/50 backdrop-blur-sm px-6 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
        <span className="text-sm text-foreground">
          Loading page {currentPage + 1}...
        </span>
      </div>
    </div>
  );

  if (!currentPageData) {
    return renderLoading();
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex h-full w-full cursor-pointer items-center justify-center ${backgroundColors[backgroundColor]}`}
    >
      {/* Hot-edge navigation with chevron arrows */}
      <div className="absolute inset-0 flex pointer-events-none">
        {/* Left edge */}
        <div className="relative flex-1 group">
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 pl-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${!isFirstPage || isRTL ? "block" : "hidden"}`}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <ChevronLeft className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        {/* Right edge */}
        <div className="relative flex-1 group">
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${!isLastPage || !isRTL ? "block" : "hidden"}`}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
              <ChevronRight className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* End of chapter/manga indicator */}
      {isLastPage && !nextChapter && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-6 py-4 text-white">
            <span className="text-sm font-medium">End of Manga</span>
            <span className="text-xs text-white/60">No more chapters</span>
          </div>
        </div>
      )}

      {/* Page image */}
      <div
        ref={imageRef}
        className="relative z-10 flex items-center justify-center transition-transform"
        style={{
          ...getImageStyles(),
          transform: `translateX(${dragOffset}px)`,
          transition: dragOffset === 0 ? "transform 0.2s ease-out" : "none",
          cursor: showDragCursor ? "grabbing" : "default",
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

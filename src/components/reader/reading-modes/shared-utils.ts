import { useCallback } from "react";
import type React from "react";
import type { useReaderControls } from "../../../hooks/useReaderControls";

// Shared background class map
export const READER_BACKGROUNDS: Record<string, string> = {
  black: "bg-black",
  white: "bg-white",
  sepia: "bg-[#f4ecd8]",
  "dark-gray": "bg-gray-900",
};

// Shared page-fit styles
export interface PageDims {
  width?: number;
  height?: number;
}

export const getPageFitStyles = (
  pageFit: string,
  customWidth: number,
  dims?: PageDims,
): React.CSSProperties => {
  switch (pageFit) {
    case "width":
      // Fill container width; height is unconstrained so overflow is clipped by container
      return { width: "100%", height: "auto" };
    case "height":
      return { width: "auto", height: "100%", maxWidth: "100%" };
    case "original":
      return {
        width: dims?.width ?? "auto",
        height: dims?.height ?? "auto",
        maxWidth: "100%",
        maxHeight: "100%",
      };
    case "custom":
      return { width: `${customWidth}%`, height: "auto", maxHeight: "100%" };
    case "auto":
    default:
      // Portrait images: fill viewport width (maximizes content, scales with viewport)
      // Landscape/square or unknown: contain (full image visible, no clipping)
      if (dims?.width && dims?.height && dims.width < dims.height) {
        return { width: "100%", height: "auto" };
      }
      return { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto" };
  }
};

// Shared hot-zone handlers hook
export const useHotZoneHandlers = (
  readerControls: ReturnType<typeof useReaderControls>,
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      readerControls.updateHotZone(e.clientX, e.clientY, containerRef.current);
    }
  }, [readerControls, containerRef]);

  const handleMouseLeave = useCallback(() => {
    readerControls.clearHotZone();
  }, [readerControls]);

  return { handleMouseMove, handleMouseLeave };
};

// Chapter transition types
export interface ChapterRef {
  id: string;
  title?: string;
  number?: string;
}

import { useState, useCallback, useRef, useEffect } from "react";

export type HotZone = "left" | "right" | "top" | "bottom" | "center" | null;
export type ReaderControlsMode = "paged-ltr" | "paged-rtl" | "dual-page" | "vertical";

interface UseReaderControlsOptions {
  mode: ReaderControlsMode;
}

export const useReaderControls = ({ mode }: UseReaderControlsOptions) => {
  const [showControls, setShowControls] = useState(true);
  const [currentHotZone, setCurrentHotZone] = useState<HotZone>(null);
  const controlsPinnedRef = useRef(false);
  const unpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getHotZone = useCallback(
    (
      clientX: number,
      clientY: number,
      containerEl: HTMLElement | null,
    ): HotZone => {
      if (!containerEl) return null;

      const rect = containerEl.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      if (mode === "vertical") {
        const topZoneHeight = height * 0.25;
        const bottomZoneStart = height * 0.75;
        if (relativeY < topZoneHeight) return "top";
        if (relativeY > bottomZoneStart) return "bottom";
        return "center";
      } else {
        const leftZoneWidth = width * 0.25;
        const rightZoneStart = width * 0.75;
        if (relativeX < leftZoneWidth) return "left";
        if (relativeX > rightZoneStart) return "right";
        return "center";
      }
    },
    [mode],
  );

  const updateHotZone = useCallback(
    (clientX: number, clientY: number, containerEl: HTMLElement | null) => {
      const zone = getHotZone(clientX, clientY, containerEl);
      setCurrentHotZone(zone);
    },
    [getHotZone],
  );

  const clearHotZone = useCallback(() => {
    setCurrentHotZone(null);
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  const hideControls = useCallback(() => {
    if (controlsPinnedRef.current) return;
    setShowControls(false);
  }, []);

  const showControlsHandler = useCallback(() => {
    setShowControls(true);
  }, []);

  const pinControls = useCallback(() => {
    if (unpinTimeoutRef.current !== null) {
      clearTimeout(unpinTimeoutRef.current);
      unpinTimeoutRef.current = null;
    }
    controlsPinnedRef.current = true;
    setShowControls(true);
  }, []);

  const unpinControls = useCallback(() => {
    if (unpinTimeoutRef.current !== null) {
      clearTimeout(unpinTimeoutRef.current);
    }
    unpinTimeoutRef.current = setTimeout(() => {
      controlsPinnedRef.current = false;
      unpinTimeoutRef.current = null;
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (unpinTimeoutRef.current !== null) {
        clearTimeout(unpinTimeoutRef.current);
      }
    };
  }, []);

  return {
    showControls,
    currentHotZone,
    getHotZone,
    updateHotZone,
    clearHotZone,
    toggleControls,
    hideControls,
    showControlsHandler,
    pinControls,
    unpinControls,
  };
};

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingMode = "paged-ltr" | "paged-rtl" | "dual-page" | "vertical";
export type PageFit = "width" | "height" | "auto" | "original" | "custom";
export type BackgroundColor = "black" | "white" | "sepia" | "dark-gray";

export interface ReaderSettings {
  // Reading preferences
  readingMode: ReadingMode;
  pageFit: PageFit;
  backgroundColor: BackgroundColor;
  customWidth: number; // percentage (1-100)

  // Vertical mode settings
  scrollSpeed: number; // 1-10
  gapSize: number; // px between images

  // Dual-page settings
  dualPageGap: number; // px between pages

  // Performance settings
  preloadCount: number; // number of pages to preload ahead
  initialPageCount: number; // number of pages to load immediately (default: 3)
  pageChunkSize: number; // number of pages to load per chunk (default: 5)

  // UI preferences
  showControls: boolean;
  autoHideControls: boolean;
  autoHideDelay: number; // ms

  // Zen mode
  zenMode: boolean;

  // Chapter navigation
  autoAdvanceChapter: boolean;

  // Actions
  setReadingMode: (mode: ReadingMode) => void;
  setPageFit: (fit: PageFit) => void;
  setBackgroundColor: (color: BackgroundColor) => void;
  setCustomWidth: (width: number) => void;
  setScrollSpeed: (speed: number) => void;
  setGapSize: (size: number) => void;
  setDualPageGap: (gap: number) => void;
  setPreloadCount: (count: number) => void;
  setInitialPageCount: (count: number) => void;
  setPageChunkSize: (size: number) => void;
  setShowControls: (show: boolean) => void;
  setAutoHideControls: (autoHide: boolean) => void;
  setAutoHideDelay: (delay: number) => void;
  setZenMode: (zen: boolean) => void;
  toggleZenMode: () => void;
  setAutoAdvanceChapter: (autoAdvance: boolean) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  readingMode: "paged-ltr" as ReadingMode,
  pageFit: "auto" as PageFit,
  backgroundColor: "black" as BackgroundColor,
  customWidth: 80,
  scrollSpeed: 20,
  gapSize: 0,
  dualPageGap: 24,
  preloadCount: 5,
  initialPageCount: 3,
  pageChunkSize: 5,
  showControls: true,
  autoHideControls: true,
  autoHideDelay: 2000,
  zenMode: false,
  autoAdvanceChapter: true,
};

export const useReaderSettings = create<ReaderSettings>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setReadingMode: (mode) => set({ readingMode: mode }),
      setPageFit: (fit) => set({ pageFit: fit }),
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      setCustomWidth: (width) => set({ customWidth: Math.max(10, Math.min(100, width)) }),
      setScrollSpeed: (speed) => set({ scrollSpeed: Math.max(1, Math.min(50, speed)) }),
      setGapSize: (size) => set({ gapSize: Math.max(0, Math.min(100, size)) }),
      setDualPageGap: (gap) => set({ dualPageGap: Math.max(0, Math.min(100, gap)) }),
      setPreloadCount: (count) => set({ preloadCount: Math.max(1, Math.min(10, count)) }),
      setInitialPageCount: (count) => set({ initialPageCount: Math.max(1, Math.min(10, count)) }),
      setPageChunkSize: (size) => set({ pageChunkSize: Math.max(1, Math.min(20, size)) }),
      setShowControls: (show) => set({ showControls: show }),
      setAutoHideControls: (autoHide) => set({ autoHideControls: autoHide }),
      setAutoHideDelay: (delay) => set({ autoHideDelay: Math.max(500, Math.min(10000, delay)) }),
      setZenMode: (zen) => set({ zenMode: zen }),
      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
      setAutoAdvanceChapter: (autoAdvance) => set({ autoAdvanceChapter: autoAdvance }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "reader-settings-storage",
    }
  )
);

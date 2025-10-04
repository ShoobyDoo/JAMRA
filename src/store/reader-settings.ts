import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingMode = "paged-ltr" | "paged-rtl" | "dual-page" | "vertical";
export type PageFit = "width" | "height" | "auto" | "original";
export type BackgroundColor = "black" | "white" | "sepia" | "dark-gray";

export interface ReaderSettings {
  // Reading preferences
  readingMode: ReadingMode;
  pageFit: PageFit;
  backgroundColor: BackgroundColor;

  // Vertical mode settings
  scrollSpeed: number; // 1-10
  gapSize: number; // px between images

  // Dual-page settings
  dualPageGap: number; // px between pages

  // Performance settings
  preloadCount: number; // number of pages to preload ahead

  // UI preferences
  showControls: boolean;
  autoHideControls: boolean;
  autoHideDelay: number; // ms

  // Zen mode
  zenMode: boolean;

  // Actions
  setReadingMode: (mode: ReadingMode) => void;
  setPageFit: (fit: PageFit) => void;
  setBackgroundColor: (color: BackgroundColor) => void;
  setScrollSpeed: (speed: number) => void;
  setGapSize: (size: number) => void;
  setDualPageGap: (gap: number) => void;
  setPreloadCount: (count: number) => void;
  setShowControls: (show: boolean) => void;
  setAutoHideControls: (autoHide: boolean) => void;
  setAutoHideDelay: (delay: number) => void;
  setZenMode: (zen: boolean) => void;
  toggleZenMode: () => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  readingMode: "paged-ltr" as ReadingMode,
  pageFit: "auto" as PageFit,
  backgroundColor: "black" as BackgroundColor,
  scrollSpeed: 20,
  gapSize: 0,
  dualPageGap: 24,
  preloadCount: 5,
  showControls: true,
  autoHideControls: true,
  autoHideDelay: 2000,
  zenMode: false,
};

export const useReaderSettings = create<ReaderSettings>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setReadingMode: (mode) => set({ readingMode: mode }),
      setPageFit: (fit) => set({ pageFit: fit }),
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      setScrollSpeed: (speed) => set({ scrollSpeed: Math.max(1, Math.min(50, speed)) }),
      setGapSize: (size) => set({ gapSize: Math.max(0, Math.min(100, size)) }),
      setDualPageGap: (gap) => set({ dualPageGap: Math.max(0, Math.min(100, gap)) }),
      setPreloadCount: (count) => set({ preloadCount: Math.max(1, Math.min(10, count)) }),
      setShowControls: (show) => set({ showControls: show }),
      setAutoHideControls: (autoHide) => set({ autoHideControls: autoHide }),
      setAutoHideDelay: (delay) => set({ autoHideDelay: Math.max(500, Math.min(10000, delay)) }),
      setZenMode: (zen) => set({ zenMode: zen }),
      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "reader-settings-storage",
    }
  )
);

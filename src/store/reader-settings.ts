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

  gapSize: number; // px between images

  // Dual-page settings
  dualPageGap: number; // px between pages

  // Performance settings
  initialPageCount: number; // number of pages to load immediately (default: 3)
  pageChunkSize: number; // number of pages to load per chunk (default: 5)

  // Guidance
  showHotzoneHints: boolean;

  // Zen mode
  zenMode: boolean;

  // Chapter navigation
  autoAdvanceChapter: boolean;

  // Actions
  setReadingMode: (mode: ReadingMode) => void;
  setPageFit: (fit: PageFit) => void;
  setBackgroundColor: (color: BackgroundColor) => void;
  setCustomWidth: (width: number) => void;
  setGapSize: (size: number) => void;
  setDualPageGap: (gap: number) => void;
  setInitialPageCount: (count: number) => void;
  setPageChunkSize: (size: number) => void;
  setShowHotzoneHints: (show: boolean) => void;
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
  gapSize: 0,
  dualPageGap: 24,
  initialPageCount: 3,
  pageChunkSize: 5,
  showHotzoneHints: true,
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
      setCustomWidth: (width) =>
        set({ customWidth: Math.max(10, Math.min(100, width)) }),
      setGapSize: (size) => set({ gapSize: Math.max(0, Math.min(100, size)) }),
      setDualPageGap: (gap) =>
        set({ dualPageGap: Math.max(0, Math.min(100, gap)) }),
      setInitialPageCount: (count) =>
        set({ initialPageCount: Math.max(1, Math.min(10, count)) }),
      setPageChunkSize: (size) =>
        set({ pageChunkSize: Math.max(1, Math.min(20, size)) }),
      setShowHotzoneHints: (show) => set({ showHotzoneHints: show }),
      setZenMode: (zen) => set({ zenMode: zen }),
      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
      setAutoAdvanceChapter: (autoAdvance) =>
        set({ autoAdvanceChapter: autoAdvance }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "reader-settings-storage",
      onRehydrateStorage: () => (state) => {
        if (state && state.showHotzoneHints === undefined) {
          state.setShowHotzoneHints?.(true);
        }
      },
    },
  ),
);

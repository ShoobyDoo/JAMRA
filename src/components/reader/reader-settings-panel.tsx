"use client";

import { X } from "lucide-react";
import { useReaderSettings, type ReadingMode, type PageFit, type BackgroundColor } from "@/store/reader-settings";

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReaderSettingsPanel({ isOpen, onClose }: ReaderSettingsPanelProps) {
  const {
    readingMode,
    pageFit,
    backgroundColor,
    customWidth,
    scrollSpeed,
    gapSize,
    dualPageGap,
    preloadCount,
    autoHideControls,
    autoHideDelay,
    autoAdvanceChapter,
    setReadingMode,
    setPageFit,
    setBackgroundColor,
    setCustomWidth,
    setScrollSpeed,
    setGapSize,
    setDualPageGap,
    setPreloadCount,
    setAutoHideControls,
    setAutoHideDelay,
    setAutoAdvanceChapter,
    resetToDefaults,
  } = useReaderSettings();

  const readingModes: { value: ReadingMode; label: string; description: string }[] = [
    { value: "paged-ltr", label: "Paged (LTR)", description: "Left to right navigation" },
    { value: "paged-rtl", label: "Paged (RTL)", description: "Right to left navigation" },
    { value: "dual-page", label: "Dual Page", description: "Two pages side by side" },
    { value: "vertical", label: "Vertical Scroll", description: "Webtoon/Manhwa style" },
  ];

  const pageFits: { value: PageFit; label: string }[] = [
    { value: "auto", label: "Auto Fit" },
    { value: "width", label: "Fit Width" },
    { value: "height", label: "Fit Height" },
    { value: "original", label: "Original Size" },
    { value: "custom", label: "Custom Width" },
  ];

  const backgroundColors: { value: BackgroundColor; label: string; color: string }[] = [
    { value: "black", label: "Black", color: "bg-black" },
    { value: "dark-gray", label: "Dark Gray", color: "bg-gray-900" },
    { value: "white", label: "White", color: "bg-white" },
    { value: "sepia", label: "Sepia", color: "bg-[#f4ecd8]" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <h2 className="text-lg font-semibold">Reader Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 transition hover:bg-accent"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Reading Mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Reading Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {readingModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setReadingMode(mode.value)}
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    readingMode === mode.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Page Fit */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Page Fit</label>
            <div className="grid grid-cols-2 gap-2">
              {pageFits.map((fit) => (
                <button
                  key={fit.value}
                  onClick={() => setPageFit(fit.value)}
                  className={`rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
                    pageFit === fit.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {fit.label}
                </button>
              ))}
            </div>

            {/* Custom Width Slider */}
            {pageFit === "custom" && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
                <label className="text-sm font-medium">
                  Custom Width: {customWidth}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Adjust the page width as a percentage of the viewport
                </p>
              </div>
            )}
          </div>

          {/* Background Color */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Background</label>
            <div className="grid grid-cols-2 gap-2">
              {backgroundColors.map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => setBackgroundColor(bg.value)}
                  className={`flex items-center gap-3 rounded-lg border-2 px-4 py-2.5 transition ${
                    backgroundColor === bg.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`h-6 w-6 rounded border border-border ${bg.color}`} />
                  <span className="text-sm font-medium">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Vertical Mode Settings */}
          {readingMode === "vertical" && (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Scroll Speed: <span className="text-muted-foreground">{scrollSpeed}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Gap Between Pages: <span className="text-muted-foreground">{gapSize}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="4"
                  value={gapSize}
                  onChange={(e) => setGapSize(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                />
              </div>
            </>
          )}

          {/* Dual Page Settings */}
          {readingMode === "dual-page" && (
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Gap Between Pages: <span className="text-muted-foreground">{dualPageGap}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="4"
                value={dualPageGap}
                onChange={(e) => setDualPageGap(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
              />
            </div>
          )}

          {/* Performance */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Preload Pages: <span className="text-muted-foreground">{preloadCount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={preloadCount}
              onChange={(e) => setPreloadCount(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Number of pages to preload ahead for smoother reading
            </p>
          </div>

          {/* UI Preferences */}
          <div className="space-y-3">
            <label className="text-sm font-medium">UI Behavior</label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Auto-hide controls</span>
              <input
                type="checkbox"
                checked={autoHideControls}
                onChange={(e) => setAutoHideControls(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
            </label>

            {autoHideControls && (
              <div className="space-y-2 pl-3">
                <label className="text-xs text-muted-foreground">
                  Hide delay: {autoHideDelay / 1000}s
                </label>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="500"
                  value={autoHideDelay}
                  onChange={(e) => setAutoHideDelay(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                />
              </div>
            )}
          </div>

          {/* Chapter Navigation */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Chapter Navigation</label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col">
                <span className="text-sm">Auto-advance chapter</span>
                <span className="text-xs text-muted-foreground">
                  Automatically load next chapter at the end
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoAdvanceChapter}
                onChange={(e) => setAutoAdvanceChapter(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
            </label>
          </div>

          {/* Reset */}
          <button
            onClick={resetToDefaults}
            className="w-full rounded-lg border border-destructive px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </>
  );
}

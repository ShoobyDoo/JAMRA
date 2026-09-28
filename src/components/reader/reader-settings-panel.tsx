import React from "react";
import { IconX } from "@tabler/icons-react";
import {
  useReaderSettings,
  type ReadingMode,
  type PageFit,
  type BackgroundColor,
} from "../../store/useReaderSettingsStore";

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    readingMode,
    pageFit,
    backgroundColor,
    customWidth,
    gapSize,
    dualPageGap,
    autoAdvanceChapter,
    showHotzoneHints,
    setReadingMode,
    setPageFit,
    setBackgroundColor,
    setCustomWidth,
    setGapSize,
    setDualPageGap,
    setShowHotzoneHints,
    setAutoAdvanceChapter,
    resetToDefaults,
  } = useReaderSettings();

  const readingModes: {
    value: ReadingMode;
    label: string;
    description: string;
  }[] = [
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

  const backgroundColors: {
    value: BackgroundColor;
    label: string;
    color: string;
  }[] = [
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
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-gray-900 text-white shadow-xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold">Reader Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close settings"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb:hover]:bg-white/40">
          {/* Reading Mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Reading Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {readingModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setReadingMode(mode.value)}
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    readingMode === mode.value
                      ? "border-blue-400 bg-blue-500/20"
                      : "border-white/10 hover:border-blue-400/50"
                  }`}
                >
                  <div className="font-medium text-sm text-white">{mode.label}</div>
                  <div className="text-xs text-white/50">
                    {mode.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Page Fit */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Page Fit</label>
            <div className="grid grid-cols-2 gap-2">
              {pageFits.map((fit) => (
                <button
                  key={fit.value}
                  onClick={() => setPageFit(fit.value)}
                  className={`rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
                    pageFit === fit.value
                      ? "border-blue-400 bg-blue-500/20 text-white"
                      : "border-white/10 text-white/70 hover:border-blue-400/50 hover:text-white"
                  }`}
                >
                  {fit.label}
                </button>
              ))}
            </div>

            {pageFit === "custom" && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
                <label className="text-sm font-medium text-white">
                  Custom Width: {customWidth}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-blue-400"
                />
                <p className="text-xs text-white/50">
                  Adjust the page width as a percentage of the viewport
                </p>
              </div>
            )}
          </div>

          {/* Background Color */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Background</label>
            <div className="grid grid-cols-2 gap-2">
              {backgroundColors.map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => setBackgroundColor(bg.value)}
                  className={`flex items-center gap-3 rounded-lg border-2 px-4 py-2.5 transition ${
                    backgroundColor === bg.value
                      ? "border-blue-400 bg-blue-500/20"
                      : "border-white/10 hover:border-blue-400/50"
                  }`}
                >
                  <div
                    className={`h-6 w-6 rounded border border-white/20 ${bg.color}`}
                  />
                  <span className="text-sm font-medium text-white">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Vertical Mode Gap */}
          {readingMode === "vertical" && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-white/80">
                Gap Between Pages:{" "}
                <span className="text-white/50">{gapSize}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="4"
                value={gapSize}
                onChange={(e) => setGapSize(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-blue-400"
              />
            </div>
          )}

          {/* Dual Page Gap */}
          {readingMode === "dual-page" && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-white/80">
                Gap Between Pages:{" "}
                <span className="text-white/50">{dualPageGap}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="4"
                value={dualPageGap}
                onChange={(e) => setDualPageGap(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-blue-400"
              />
            </div>
          )}

          {/* Chapter Navigation */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Chapter Navigation</label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 p-3 hover:bg-white/5 transition">
              <div className="flex flex-col">
                <span className="text-sm text-white">Auto-advance chapter</span>
                <span className="text-xs text-white/50">
                  Automatically load next chapter at the end
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoAdvanceChapter}
                onChange={(e) => setAutoAdvanceChapter(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-400"
              />
            </label>
          </div>

          {/* Guidance */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Guidance</label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 p-3 hover:bg-white/5 transition">
              <div className="flex flex-col">
                <span className="text-sm text-white">Show hotzone hints on startup</span>
                <span className="text-xs text-white/50">
                  Display directional overlays once each time the app launches
                </span>
              </div>
              <input
                type="checkbox"
                checked={showHotzoneHints}
                onChange={(e) => setShowHotzoneHints(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-400"
              />
            </label>
          </div>

          {/* Reset */}
          <button
            onClick={resetToDefaults}
            className="w-full rounded-lg border border-red-500/50 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </>
  );
};

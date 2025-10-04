"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Settings,
  Maximize,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useReaderSettings } from "@/store/reader-settings";

interface ReaderControlsProps {
  mangaTitle: string;
  chapterTitle: string;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleSettings: () => void;
  onToggleZenMode: () => void;
  onPageSelect: (page: number) => void;
}

export function ReaderControls({
  mangaTitle,
  chapterTitle,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onToggleSettings,
  onToggleZenMode,
  onPageSelect,
}: ReaderControlsProps) {
  const router = useRouter();
  const { zenMode, autoHideControls, autoHideDelay, readingMode } =
    useReaderSettings();
  const [isVisible, setIsVisible] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls logic
  useEffect(() => {
    if (!autoHideControls || zenMode) {
      setIsVisible(!zenMode);
      return;
    }

    const showControls = () => {
      setIsVisible(true);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
    };

    const handleMouseMove = () => showControls();
    const handleTouchStart = () => showControls();
    const handleKeyDown = () => showControls();

    showControls(); // Show initially

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("keydown", handleKeyDown);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [autoHideControls, autoHideDelay, zenMode]);

  // Progress shows fill BEHIND the current page marker (e.g., at page 1 of 5, progress is 0%)
  const progress = totalPages > 1 ? (currentPage / (totalPages - 1)) * 100 : 0;

  const modeLabels = {
    "paged-ltr": "LTR",
    "paged-rtl": "RTL",
    "dual-page": "Dual",
    vertical: "Scroll",
  };

  if (zenMode) return null;

  return (
    <>
      {/* Top bar */}
      <div
        className={`fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Back button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-accent"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>

          {/* Center: Title and chapter */}
          <div className="flex-1 truncate px-4 text-center">
            <h1 className="truncate text-sm font-semibold">{mangaTitle}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {chapterTitle}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {modeLabels[readingMode]}
            </span>
            <button
              onClick={onToggleZenMode}
              className="rounded-md p-2 transition hover:bg-accent"
              aria-label="Toggle fullscreen"
            >
              <Maximize className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleSettings}
              className="rounded-md p-2 transition hover:bg-accent"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevPage}
              disabled={currentPage === 0}
              className="rounded-md p-1 transition hover:bg-accent disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center gap-3">
              <input
                type="range"
                min="0"
                max={totalPages - 1}
                value={currentPage}
                onChange={(e) => onPageSelect(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                style={{
                  background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${progress}%, var(--secondary) ${progress}%, var(--secondary) 100%)`,
                }}
                aria-label="Page slider"
              />
              <div className="flex min-w-[80px] items-center justify-center gap-1 text-sm font-medium">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  {currentPage + 1} / {totalPages}
                </span>
              </div>
            </div>

            <button
              onClick={onNextPage}
              disabled={currentPage === totalPages - 1}
              className="rounded-md p-1 transition hover:bg-accent disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Settings,
  Maximize,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  X,
} from "lucide-react";
import { useReaderSettings } from "@/store/reader-settings";
import { Select, Skeleton } from "@mantine/core";
import { formatChapterTitle } from "@/lib/chapter-meta";

interface ReaderControlsProps {
  mangaSlug: string;
  mangaTitle: string;
  chapters: Array<{ id: string; slug: string; title?: string; number?: string }>;
  currentChapterSlug: string;
  onChapterSelect: (chapterSlug: string) => void;
  currentPage: number;
  totalPages: number;
  isChunkPending: boolean;
  chunkErrorMessage?: string;
  onRetryChunk?: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleSettings: () => void;
  onToggleZenMode: () => void;
  onPageSelect: (page: number) => void;
}

export function ReaderControls({
  mangaSlug,
  mangaTitle,
  chapters,
  currentChapterSlug,
  onChapterSelect,
  currentPage,
  totalPages,
  isChunkPending,
  chunkErrorMessage,
  onRetryChunk,
  onPrevPage,
  onNextPage,
  onToggleSettings,
  onToggleZenMode,
  onPageSelect,
}: ReaderControlsProps) {
  const router = useRouter();
  const { zenMode, autoHideControls, autoHideDelay, readingMode } =
    useReaderSettings();
  const [isVisible, setIsVisible] = useState(!autoHideControls);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showControls = useCallback(() => {
    setIsVisible(true);

    if (!autoHideControls || zenMode) {
      return;
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelay);
  }, [autoHideControls, autoHideDelay, zenMode]);

  useEffect(() => {
    if (!autoHideControls || zenMode) {
      setIsVisible(!zenMode);
      return;
    }

    showControls();

    const handleKeyDown = () => showControls();

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [autoHideControls, zenMode, showControls]);

  // Progress shows fill BEHIND the current page marker (e.g., at page 1 of 5, progress is 0%)
  const hasTotalPages = totalPages > 0;
  const progress = hasTotalPages && totalPages > 1 ? (currentPage / (totalPages - 1)) * 100 : 0;
  const nextDisabled = !hasTotalPages || isChunkPending || currentPage >= totalPages - 1;
  const prevDisabled = !hasTotalPages || isChunkPending || currentPage === 0;
  const showRetry = Boolean(chunkErrorMessage && onRetryChunk);

  const modeLabels = {
    "paged-ltr": "LTR",
    "paged-rtl": "RTL",
    "dual-page": "Dual",
    vertical: "Scroll",
  };

  if (zenMode) return null;

  return (
    <>
      <div
        className={`fixed left-0 right-0 top-0 z-40 h-10 md:h-14 ${
          isVisible ? "pointer-events-none" : "pointer-events-auto"
        }`}
        onMouseEnter={showControls}
        onMouseMove={showControls}
        onTouchStart={showControls}
      />

      {/* Top bar */}
      <div
        className={`fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        }`}
        onMouseEnter={showControls}
        onMouseMove={showControls}
        onTouchStart={showControls}
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
          <div className="flex flex-1 flex-col items-center gap-1 px-4 text-center">
            <h1 className="truncate text-base font-semibold md:text-lg">
              {mangaTitle}
            </h1>
            <Select
              value={currentChapterSlug}
              onChange={(value) => {
                if (value) onChapterSelect(value);
              }}
              data={
                chapters.length > 0
                  ? chapters.map((chapter) => ({
                      value: chapter.slug,
                      label: formatChapterTitle(chapter),
                    }))
                  : []
              }
              size="xs"
              radius="md"
              rightSection={null}
              classNames={{
                input: "min-w-[100px] px-1.5 py-0.5 text-[11px]",
                dropdown: "text-xs",
                option: "flex items-center justify-between gap-2 px-2 py-1",
              }}
              disabled={chapters.length === 0}
              searchable
              clearable={false}
              checkIconPosition="right"
              placeholder="Loading chapters..."
            />
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
            <button
              onClick={() => router.push(`/manga/${encodeURIComponent(mangaSlug)}`)}
              className="rounded-md p-2 transition hover:bg-accent hover:text-destructive"
              aria-label="Exit reader"
              title="Exit to manga details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        onMouseEnter={showControls}
        onMouseMove={showControls}
        onTouchStart={showControls}
      >
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevPage}
              disabled={prevDisabled}
              className="rounded-md p-1 transition hover:bg-accent disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="range"
                  min="0"
                  max={Math.max(totalPages - 1, 0)}
                  value={currentPage}
                  onChange={(e) => onPageSelect(Number(e.target.value))}
                  disabled={!hasTotalPages || isChunkPending}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${progress}%, var(--secondary) ${progress}%, var(--secondary) 100%)`,
                  }}
                  aria-label="Page slider"
                />
              </div>
              <div className="flex min-w-[100px] items-center justify-center gap-2 text-sm font-medium">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="inline-flex items-center gap-1">
                  {hasTotalPages ? currentPage + 1 : currentPage + 1}
                  <span>/</span>
                  {hasTotalPages ? (
                    totalPages
                  ) : (
                    <Skeleton height={10} width={24} radius="xl" />
                  )}
                </span>
              </div>
              {chunkErrorMessage ? (
                <span className="text-xs text-destructive">
                  {chunkErrorMessage}
                </span>
              ) : null}
              {showRetry ? (
                <button
                  type="button"
                  onClick={() => onRetryChunk?.()}
                  title={chunkErrorMessage}
                  className="rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/20"
                >
                  Retry load
                </button>
              ) : null}
            </div>

            <button
              onClick={onNextPage}
              disabled={nextDisabled}
              className="rounded-md p-1 transition hover:bg-accent disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed left-0 right-0 bottom-0 z-40 h-12 md:h-16 ${
          isVisible ? "pointer-events-none" : "pointer-events-auto"
        }`}
        onMouseEnter={showControls}
        onMouseMove={showControls}
        onTouchStart={showControls}
      />
    </>
  );
}

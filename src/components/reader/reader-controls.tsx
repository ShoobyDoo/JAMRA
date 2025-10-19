"use client";

import { useMemo } from "react";
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
import { useMediaQuery } from "@mantine/hooks";

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
  showControls?: boolean;
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
  showControls: externalShowControls,
}: ReaderControlsProps) {
  const router = useRouter();
  const { zenMode, readingMode } = useReaderSettings();
  const isSmallScreen = useMediaQuery("(max-width: 480px)");
  const isMediumScreen = useMediaQuery("(max-width: 768px)");

  const titleLimit = useMemo(() => {
    if (isSmallScreen) return 32;
    if (isMediumScreen) return 56;
    return 80;
  }, [isSmallScreen, isMediumScreen]);

  const truncatedTitle = useMemo(() => {
    if (!mangaTitle) return "";
    if (mangaTitle.length <= titleLimit) return mangaTitle;
    const sliceEnd = Math.max(0, titleLimit - 1);
    return `${mangaTitle.slice(0, sliceEnd).trimEnd()}…`;
  }, [mangaTitle, titleLimit]);

  // Use external control state if provided, otherwise default to visible
  const isVisible = externalShowControls ?? true;

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
      {/* Top bar */}
      <div
        className={`fixed inset-x-0 top-4 z-50 flex justify-center px-4 transition-all duration-300 ease-out ${
          isVisible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-6 opacity-0"
        }`}
      >
        <div className="flex w-full max-w-5xl items-center gap-3 rounded-2xl border border-border/60 bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
          {/* Left: Back button + chapter selector */}
          <div className="flex flex-shrink-0 items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-accent"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
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
              size="sm"
              radius="md"
              className="w-[140px]"
              classNames={{
                input: "px-2 py-1 text-xs",
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

          {/* Center: Title */}
          <div className="mx-auto min-w-0 max-w-xl px-2 text-center">
            <h1
              className="max-w-full truncate text-base font-semibold md:text-lg"
              title={mangaTitle}
            >
              {truncatedTitle}
            </h1>
          </div>

          {/* Right: Controls */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
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
        className={`fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 transition-all duration-300 ease-out ${
          isVisible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <div className="w-full max-w-5xl rounded-2xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
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
    </>
  );
}

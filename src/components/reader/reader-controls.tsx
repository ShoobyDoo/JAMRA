import React, { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  IconArrowLeft,
  IconSettings,
  IconMaximize,
  IconChevronLeft,
  IconChevronRight,
  IconBook,
  IconX,
} from "@tabler/icons-react";
import { useReaderSettings } from "../../store/useReaderSettingsStore";
import { Select, Skeleton, Tooltip } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

interface ChapterMeta {
  id: string;
  title?: string;
  number?: string;
}

const formatChapterTitle = (chapter: ChapterMeta): string => {
  if (chapter.title && chapter.title.trim().length > 0) return chapter.title;
  if (chapter.number && chapter.number.trim().length > 0)
    return `Chapter ${chapter.number}`;
  return `Chapter ${chapter.id}`;
};

interface ReaderControlsProps {
  mangaTitle: string;
  chapters: Array<{
    id: string;
    title?: string;
    number?: string;
  }>;
  currentChapterId: string;
  onChapterSelect: (chapterId: string) => void;
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
  onControlsPointerEnter?: () => void;
  onControlsPointerLeave?: () => void;
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  mangaTitle,
  chapters,
  currentChapterId,
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
  onControlsPointerEnter,
  onControlsPointerLeave,
}) => {
  const navigate = useNavigate();
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

  const isVisible = externalShowControls ?? true;

  const hasTotalPages = totalPages > 0;
  const progress =
    hasTotalPages && totalPages > 1
      ? (currentPage / (totalPages - 1)) * 100
      : 0;
  const nextDisabled =
    !hasTotalPages || isChunkPending || currentPage >= totalPages - 1;
  const prevDisabled = !hasTotalPages || isChunkPending || currentPage === 0;
  const showRetry = Boolean(chunkErrorMessage && onRetryChunk);

  const modeLabels: Record<string, string> = {
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
          isVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-6 opacity-0"
        }`}
        onMouseEnter={onControlsPointerEnter}
        onMouseLeave={onControlsPointerLeave}
        onPointerDown={onControlsPointerEnter}
        onFocusCapture={onControlsPointerEnter}
        onBlurCapture={onControlsPointerLeave}
      >
        <div className="flex w-full max-w-5xl items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-4 py-2 shadow-lg backdrop-blur-md">
          {/* Left: Back button + chapter selector */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition hover:text-white hover:bg-white/10"
              aria-label="Go back"
            >
              <IconArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>
            <Select
              value={currentChapterId}
              onChange={(value) => {
                if (value) onChapterSelect(value);
              }}
              data={
                chapters.length > 0
                  ? chapters.map((chapter) => ({
                      value: chapter.id,
                      label: formatChapterTitle(chapter),
                    }))
                  : []
              }
              size="sm"
              radius="md"
              className="w-[160px]"
              styles={{
                input: {
                  backgroundColor: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "white",
                  fontSize: "0.75rem",
                },
                dropdown: {
                  backgroundColor: "rgba(15,15,15,0.97)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                },
                option: {
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.85)",
                },
              }}
              disabled={chapters.length === 0}
              searchable
              clearable={false}
              checkIconPosition="right"
              maxDropdownHeight={320}
              placeholder="Loading chapters..."
            />
          </div>

          {/* Center: Title */}
          <div className="mx-auto min-w-0 max-w-xl px-2 text-center">
            <h1
              className="max-w-full truncate text-base font-semibold text-white md:text-lg"
              title={mangaTitle}
            >
              {truncatedTitle}
            </h1>
          </div>

          {/* Right: Controls */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-white/60 sm:inline">
              {modeLabels[readingMode]}
            </span>
            <button
              onClick={onToggleZenMode}
              className="rounded-md p-2 text-white/80 transition hover:text-white hover:bg-white/10"
              aria-label="Toggle fullscreen"
            >
              <IconMaximize size={16} />
            </button>
            <button
              onClick={onToggleSettings}
              className="rounded-md p-2 text-white/80 transition hover:text-white hover:bg-white/10"
              aria-label="Settings"
            >
              <IconSettings size={16} />
            </button>
            <Tooltip label="Exit to manga details" position="bottom" withArrow>
              <button
                onClick={() => navigate(-1)}
                className="rounded-md p-2 text-white/80 transition hover:text-red-400"
                aria-label="Exit reader"
              >
                <IconX size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={`fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 transition-all duration-300 ease-out ${
          isVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        onMouseEnter={onControlsPointerEnter}
        onMouseLeave={onControlsPointerLeave}
        onPointerDown={onControlsPointerEnter}
        onFocusCapture={onControlsPointerEnter}
        onBlurCapture={onControlsPointerLeave}
      >
        <div className="w-full max-w-5xl rounded-2xl border border-white/20 bg-black/60 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={onPrevPage}
              disabled={prevDisabled}
              className="rounded-md p-1 text-white/80 transition hover:text-white hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous page"
            >
              <IconChevronLeft size={20} />
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
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, white 0%, white ${progress}%, rgba(255,255,255,0.2) ${progress}%, rgba(255,255,255,0.2) 100%)`,
                  }}
                  aria-label="Page slider"
                />
              </div>
              <div className="flex min-w-[100px] items-center justify-center gap-2 text-sm font-medium text-white">
                <IconBook size={14} className="text-white/60" />
                <span className="inline-flex items-center gap-1">
                  {currentPage + 1}
                  <span>/</span>
                  {hasTotalPages ? (
                    totalPages
                  ) : (
                    <Skeleton height={10} width={24} radius="xl" />
                  )}
                </span>
              </div>
              {chunkErrorMessage ? (
                <span className="text-xs text-red-400">{chunkErrorMessage}</span>
              ) : null}
              {showRetry ? (
                <button
                  type="button"
                  onClick={() => onRetryChunk?.()}
                  title={chunkErrorMessage}
                  className="rounded-md border border-red-500/50 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  Retry load
                </button>
              ) : null}
            </div>

            <button
              onClick={onNextPage}
              disabled={nextDisabled}
              className="rounded-md p-1 text-white/80 transition hover:text-white hover:bg-white/10 disabled:opacity-30"
              aria-label="Next page"
            >
              <IconChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

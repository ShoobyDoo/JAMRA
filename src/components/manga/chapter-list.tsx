"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Check, Download, Loader2, XCircle } from "lucide-react";
import { getAllReadingProgress, ApiError } from "@/lib/api";
import type { ReadingProgressData } from "@/lib/api";
import type { ChapterWithSlug } from "@/lib/chapter-slug";
import { formatChapterTitle, sortChaptersDesc } from "@/lib/chapter-meta";
import { useOfflineMangaContext } from "./offline-manga-context";

interface ChapterListProps {
  chapters: ChapterWithSlug[];
  mangaId: string;
  mangaSlug: string;
}

export function ChapterList({
  chapters,
  mangaId,
  mangaSlug,
}: ChapterListProps) {
  const [progressMap, setProgressMap] = useState<
    Map<string, ReadingProgressData>
  >(new Map());
  const [loadingProgress, setLoadingProgress] = useState(true);
  const offline = useOfflineMangaContext();

  useEffect(() => {
    async function fetchProgress() {
      try {
        const allProgress = await getAllReadingProgress();
        const map = new Map<string, ReadingProgressData>();
        allProgress.forEach((progress) => {
          if (progress.mangaId === mangaId) {
            map.set(progress.chapterId, progress);
          }
        });
        setProgressMap(map);
      } catch (error) {
        console.error("Failed to fetch reading progress:", error);
        notifications.show({
          title: "Failed to load progress",
          message: "Could not load your reading progress for this manga",
          color: "red",
          autoClose: 5000,
        });
      } finally {
        setLoadingProgress(false);
      }
    }

    fetchProgress();
  }, [mangaId]);

  const sortedChapters = useMemo(() => sortChaptersDesc(chapters), [chapters]);

  const getChapterStatus = (chapterId: string) => {
    const progress = progressMap.get(chapterId);
    if (!progress) {
      return {
        label: "Unread",
        isRead: false,
        progress: null as ReadingProgressData | null,
      };
    }
    const isRead = progress.currentPage >= progress.totalPages - 1;
    return {
      label: isRead ? "Read" : "In Progress",
      isRead,
      progress,
    };
  };

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {sortedChapters.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          No chapters available.
        </div>
      ) : (
        sortedChapters.map((chapter) => {
          const { label, isRead, progress } = getChapterStatus(chapter.id);
          const hasProgress = progress !== null;
          const progressPercent = hasProgress
            ? Math.round((progress.currentPage / progress.totalPages) * 100)
            : 0;
          const scanlatorNames =
            chapter.scanlators?.filter((name) => name.trim().length > 0) ?? [];
          const scanlatorLabel =
            scanlatorNames.length > 0 ? scanlatorNames.join(", ") : "Unknown";
          const publishedLabel = chapter.publishedAt
            ? new Date(chapter.publishedAt).toLocaleDateString()
            : null;

          const baseBorderClass =
            hasProgress && !isRead
              ? "border-l-4 border-l-blue-500"
              : hasProgress && isRead
                ? "border-l-4 border-l-green-500"
                : "";

          return (
            <div
              key={chapter.id}
              className={`relative flex flex-col gap-3 p-4 transition hover:bg-secondary focus-within:bg-secondary md:flex-row md:items-center md:justify-between ${baseBorderClass}`}
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(chapter.slug)}`}
                  className="block"
                >
                  <p className="font-medium">{formatChapterTitle(chapter)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-muted-foreground/90">
                      Scanlator: {scanlatorLabel}
                    </span>
                    {publishedLabel && <span>• {publishedLabel}</span>}
                    {hasProgress && (
                      <span>
                        • {progress.currentPage + 1}/{progress.totalPages} pages
                      </span>
                    )}
                  </div>
                </Link>
                {hasProgress && !isRead && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                {loadingProgress ? (
                  <Loader size="xs" />
                ) : (
                  <span
                    className={`text-xs font-medium ${
                      isRead
                        ? "text-green-600 dark:text-green-400"
                        : label === "In Progress"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                )}
                <ChapterOfflineControls chapter={chapter} offline={offline} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

interface ChapterOfflineControlsProps {
  chapter: ChapterWithSlug;
  offline: ReturnType<typeof useOfflineMangaContext>;
}

function ChapterOfflineControls({
  chapter,
  offline,
}: ChapterOfflineControlsProps) {
  const [cancelLoading, setCancelLoading] = useState(false);

  if (!offline || !offline.extensionId || !offline.offlineAvailable) {
    return null;
  }

  const {
    chapterQueueMap,
    offlineChaptersMap,
    queueChapter,
    cancelDownload,
    isChapterPending,
  } = offline;

  const isDownloaded = offlineChaptersMap.has(chapter.id);
  const queueItem = chapterQueueMap.get(chapter.id);
  const pending = isChapterPending(chapter.id);

  const handleDownload = async () => {
    try {
      await queueChapter(chapter.id);
      notifications.show({
        title: "Download queued",
        message: `${formatChapterTitle(chapter)} has been added to offline downloads.`,
        color: "green",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Failed to queue chapter download:", error);
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not queue download. Please try again.";
      notifications.show({
        title: "Download failed",
        message,
        color: "red",
        autoClose: 5000,
      });
    }
  };

  const handleCancel = async () => {
    if (!queueItem) {
      return;
    }
    setCancelLoading(true);
    try {
      await cancelDownload(queueItem.id);
      notifications.show({
        title: "Download cancelled",
        message: `${formatChapterTitle(chapter)} was removed from the download queue.`,
        color: "yellow",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Failed to cancel download:", error);
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not cancel download. It may already be in progress.";
      notifications.show({
        title: "Cancel failed",
        message,
        color: "red",
        autoClose: 5000,
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const renderStatusPill = () => {
    if (isDownloaded) {
      return (
        <StatusPill icon={<Check size={14} />} tone="success">
          Offline
        </StatusPill>
      );
    }

    if (queueItem) {
      const percent =
        queueItem.progressTotal > 0
          ? Math.round(
              (queueItem.progressCurrent / queueItem.progressTotal) * 100,
            )
          : 0;
      const isDownloading = queueItem.status === "downloading";
      return (
        <StatusPill
          icon={
            <Loader2
              size={14}
              className={isDownloading ? "animate-spin" : ""}
            />
          }
          tone={isDownloading ? "info" : "warning"}
        >
          {isDownloading ? `Downloading ${percent}%` : "Queued"}
        </StatusPill>
      );
    }

    if (pending) {
      return (
        <StatusPill
          icon={<Loader2 size={14} className="animate-spin" />}
          tone="info"
        >
          Queuing…
        </StatusPill>
      );
    }

    return null;
  };

  return (
    <div className="flex items-center gap-2">
      {renderStatusPill()}
      {isDownloaded ? null : queueItem ? (
        <Button
          size="xs"
          variant="subtle"
          color="red"
          leftSection={!cancelLoading ? <XCircle size={14} /> : undefined}
          loading={cancelLoading}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      ) : (
        <Button
          size="xs"
          variant="light"
          leftSection={!pending ? <Download size={14} /> : undefined}
          loading={pending}
          onClick={handleDownload}
        >
          Download
        </Button>
      )}
    </div>
  );
}

interface StatusPillProps {
  icon: ReactNode;
  tone: "success" | "info" | "warning";
  children: ReactNode;
}

function StatusPill({ icon, tone, children }: StatusPillProps) {
  const toneClass =
    tone === "success"
      ? "border-green-500/70 text-green-600 dark:border-green-500/60 dark:text-green-400"
      : tone === "info"
        ? "border-blue-500/70 text-blue-600 dark:border-blue-500/60 dark:text-blue-400"
        : "border-amber-500/70 text-amber-600 dark:border-amber-500/60 dark:text-amber-400";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {icon}
      {children}
    </span>
  );
}

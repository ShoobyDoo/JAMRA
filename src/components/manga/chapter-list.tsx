"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { Button, Loader, Checkbox, Group } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Check, Download, Loader2, XCircle, CheckSquare } from "lucide-react";
import { getAllReadingProgress, ApiError } from "@/lib/api";
import type { ReadingProgressData } from "@/lib/api";
import type { ChapterWithSlug } from "@/lib/chapter-slug";
import { formatChapterTitle, sortChaptersDesc } from "@/lib/chapter-meta";
import { useOfflineMangaContext } from "./offline-manga-context";
import { logger } from "@/lib/logger";
import { InlineDevBadge } from "@/components/dev/dev-badge";

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
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
        logger.error("Failed to fetch reading progress", {
          component: "ChapterList",
          action: "load-progress",
          mangaId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
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

  const handleToggleSelection = useCallback((chapterId: string, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex !== null) {
      // Range selection with Shift+click
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = new Set<string>();

      for (let i = start; i <= end; i++) {
        rangeIds.add(sortedChapters[i].id);
      }

      setSelectedChapterIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      // Single selection
      setSelectedChapterIds((prev) => {
        const next = new Set(prev);
        if (next.has(chapterId)) {
          next.delete(chapterId);
        } else {
          next.add(chapterId);
        }
        return next;
      });
    }
    setLastSelectedIndex(index);
  }, [lastSelectedIndex, sortedChapters]);

  const handleSelectAll = useCallback(() => {
    if (selectedChapterIds.size === sortedChapters.length) {
      setSelectedChapterIds(new Set());
    } else {
      setSelectedChapterIds(new Set(sortedChapters.map((ch) => ch.id)));
    }
  }, [selectedChapterIds.size, sortedChapters]);

  const handleDownloadSelected = useCallback(async () => {
    if (!offline) {
      return;
    }

    const selectedIds = Array.from(selectedChapterIds);
    if (selectedIds.length === 0) {
      notifications.show({
        title: "No chapters selected",
        message: "Please select chapters to download",
        color: "yellow",
        autoClose: 3000,
      });
      return;
    }

    try {
      await offline.queueManga(selectedIds);
      notifications.show({
        title: "Downloads queued",
        message: `Queued ${selectedIds.length} chapter${selectedIds.length === 1 ? "" : "s"} for download`,
        color: "green",
        autoClose: 3000,
      });
      setSelectionMode(false);
      setSelectedChapterIds(new Set());
    } catch (error) {
      logger.error("Failed to queue selected chapters", {
        component: "ChapterList",
        action: "download-selected",
        mangaId,
        chapterCount: selectedIds.length,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not queue downloads. Please try again.";
      notifications.show({
        title: "Download failed",
        message,
        color: "red",
        autoClose: 5000,
      });
    }
  }, [offline, selectedChapterIds, mangaId]);

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

  const canDownload = offline && offline.offlineAvailable;
  const downloadableChapters = useMemo(() => {
    if (!offline) return [];
    return sortedChapters.filter(
      (ch) =>
        !offline.offlineChaptersMap.has(ch.id) &&
        !offline.chapterQueueMap.has(ch.id) &&
        !offline.pendingChapterIds.has(ch.id),
    );
  }, [offline, sortedChapters]);

  const totalChapters = offline?.chapters.length ?? 0;
  const downloadedCount = offline?.offlineChaptersMap.size ?? 0;
  const remainingChapters = Math.max(totalChapters - downloadedCount, 0);
  const hasActiveDownloads = (offline?.queueItems.length ?? 0) > 0;

  const handleDownloadAll = useCallback(async () => {
    if (!offline) {
      return;
    }

    const targets = offline.chapters
      .filter((chapter) => !offline.offlineChaptersMap.has(chapter.id))
      .map((chapter) => chapter.id);

    if (targets.length === 0) {
      notifications.show({
        title: "All caught up",
        message: "Every chapter is already available offline.",
        color: "green",
        autoClose: 3000,
      });
      return;
    }

    try {
      await offline.queueManga(targets);
      notifications.show({
        title: "Downloads queued",
        message: `Queued ${targets.length} chapter${targets.length === 1 ? "" : "s"}. Check sidebar for progress.`,
        color: "green",
        autoClose: 3000,
      });
    } catch (error) {
      logger.error("Failed to queue manga downloads", {
        component: "ChapterList",
        action: "download-all",
        mangaId,
        chapterCount: targets.length,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not queue downloads. Please try again.";
      notifications.show({
        title: "Download failed",
        message,
        color: "red",
        autoClose: 5000,
      });
    }
  }, [offline, mangaId]);

  return (
    <div className="space-y-4">
      {canDownload && downloadableChapters.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          {!selectionMode ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {downloadableChapters.length} chapter{downloadableChapters.length === 1 ? "" : "s"} available to download
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<Download size={16} />}
                  loading={offline.queueingManga || hasActiveDownloads}
                  onClick={handleDownloadAll}
                >
                  {downloadedCount === 0
                    ? "Download All"
                    : `Download ${remainingChapters} More`}
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<CheckSquare size={16} />}
                  onClick={() => setSelectionMode(true)}
                >
                  Select Chapters
                </Button>
              </div>
            </div>
          ) : (
            <Group className="w-full" justify="space-between">
              <Group>
                <Checkbox
                  checked={selectedChapterIds.size === sortedChapters.length && sortedChapters.length > 0}
                  indeterminate={selectedChapterIds.size > 0 && selectedChapterIds.size < sortedChapters.length}
                  onChange={handleSelectAll}
                  label={`${selectedChapterIds.size} selected`}
                />
              </Group>
              <Group>
                <Button
                  size="sm"
                  variant="filled"
                  color="blue"
                  leftSection={<Download size={16} />}
                  onClick={handleDownloadSelected}
                  disabled={selectedChapterIds.size === 0}
                >
                  Download Selected
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedChapterIds(new Set());
                  }}
                >
                  Cancel
                </Button>
              </Group>
            </Group>
          )}
        </div>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {sortedChapters.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No chapters available.
          </div>
        ) : (
          sortedChapters.map((chapter, index) => {
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

          const isSelected = selectedChapterIds.has(chapter.id);

          return (
            <div
              key={chapter.id}
              className={`relative flex flex-col gap-3 p-4 transition hover:bg-secondary focus-within:bg-secondary md:flex-row md:items-center md:justify-between ${baseBorderClass} ${isSelected ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
              onClick={(e) => {
                if (selectionMode && e.target === e.currentTarget) {
                  handleToggleSelection(chapter.id, index, e.shiftKey);
                }
              }}
            >
              {selectionMode && (
                <div className="flex items-center">
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleSelection(chapter.id, index, (e.nativeEvent as MouseEvent).shiftKey);
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/read/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(chapter.slug)}`}
                  className="block"
                  onClick={(e) => selectionMode && e.preventDefault()}
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
                    <InlineDevBadge
                      info={[
                        { label: "Chapter ID", value: chapter.id, copyable: true },
                        ...(chapter.externalUrl
                          ? [
                              {
                                label: "Source URL",
                                value: chapter.externalUrl,
                                copyable: true,
                                clickable: true,
                                url: chapter.externalUrl,
                              },
                            ]
                          : []),
                      ]}
                    />
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
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if this is the "already downloaded" case
      if (errorMessage.includes("already downloaded")) {
        logger.info("Chapter already downloaded, refreshed cache via context", {
          component: "ChapterList",
          action: "queue-chapter",
          mangaId: offline.mangaId ?? "unknown",
          chapterId: chapter.id,
        });
        notifications.show({
          title: "Already available",
          message: `${formatChapterTitle(chapter)} is already downloaded and ready to read offline!`,
          color: "blue",
          autoClose: 4000,
        });
        return;
      }

      // Log other errors
      logger.error("Failed to queue chapter download", {
        component: "ChapterList",
        action: "queue-chapter",
        mangaId: offline.mangaId ?? "unknown",
        chapterId: chapter.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });

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
      logger.error("Failed to cancel chapter download", {
        component: "ChapterList",
        action: "cancel-download",
        mangaId: offline.mangaId ?? "unknown",
        chapterId: chapter.id,
        queueId: queueItem.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
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

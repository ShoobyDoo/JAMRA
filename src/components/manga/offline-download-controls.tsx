"use client";

import { useMemo } from "react";
import { Button, Progress } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Download } from "lucide-react";
import { ApiError } from "@/lib/api";
import { formatChapterTitle } from "@/lib/chapter-meta";
import type { ChapterWithSlug } from "@/lib/chapter-slug";
import { useOfflineMangaContext } from "./offline-manga-context";

export function OfflineDownloadControls() {
  const offline = useOfflineMangaContext();

  const chapterLookup = useMemo(() => {
    if (!offline) {
      return new Map<string, ChapterWithSlug>();
    }
    return new Map<string, ChapterWithSlug>(
      offline.chapters.map((chapter) => [chapter.id, chapter]),
    );
  }, [offline]);

  if (!offline || !offline.extensionId) {
    return null;
  }

  const totalChapters = offline.chapters.length;
  const downloadedCount = offline.offlineChaptersMap.size;
  const remainingChapters = Math.max(totalChapters - downloadedCount, 0);

  const handleDownloadMissing = async () => {
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
        message: `Queued ${targets.length} chapter${targets.length === 1 ? "" : "s"} for offline reading.`,
        color: "green",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Failed to queue manga download:", error);
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
  };

  const activeDownloads = offline.queueItems;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Offline Downloads
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {offline.offlineAvailable
              ? `Downloaded ${downloadedCount} of ${totalChapters} chapters`
              : "Offline storage is currently unavailable."}
          </p>
        </div>
        {offline.offlineAvailable && remainingChapters > 0 && (
          <Button
            size="sm"
            variant="light"
            leftSection={<Download size={16} />}
            loading={offline.queueingManga}
            onClick={handleDownloadMissing}
          >
            {downloadedCount === 0 ? "Download All Chapters" : "Download Remaining"}
          </Button>
        )}
      </div>

      {offline.offlineAvailable && remainingChapters === 0 && (
        <div className="mt-3 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-300">
          All chapters are ready for offline reading.
        </div>
      )}

      {activeDownloads.length > 0 && (
        <div className="mt-4 space-y-3 rounded-md border border-border/60 bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active downloads
          </p>
          <div className="space-y-2">
            {activeDownloads.map((item) => {
              const chapter =
                item.chapterId !== undefined
                  ? chapterLookup.get(item.chapterId)
                  : undefined;
              const label = chapter
                ? formatChapterTitle(chapter)
                : item.chapterId
                  ? `Chapter ${item.chapterId}`
                  : "Full manga download";
              const percent =
                item.progressTotal > 0
                  ? Math.round((item.progressCurrent / item.progressTotal) * 100)
                  : item.status === "downloading"
                    ? 0
                    : undefined;
              const statusLabel =
                item.status === "downloading"
                  ? `Downloading${typeof percent === "number" ? ` ${percent}%` : ""}`
                  : item.status === "queued"
                    ? "Queued"
                    : item.status === "paused"
                      ? "Paused"
                      : item.status === "failed"
                        ? "Failed"
                        : item.status === "completed"
                          ? "Completed"
                          : item.status;

              return (
                <div
                  key={item.id}
                  className="space-y-1 rounded border border-border/60 bg-background/80 p-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-muted-foreground">{statusLabel}</span>
                  </div>
                  {typeof percent === "number" && (
                    <Progress size="xs" value={percent} aria-label={`Download progress ${percent}%`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

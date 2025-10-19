"use client";

import { Badge, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Download, Check } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useOfflineMangaContext } from "./offline-manga-context";

export function OfflineDownloadControls() {
  const offline = useOfflineMangaContext();

  if (!offline || !offline.extensionId) {
    return null;
  }

  const totalChapters = offline.chapters.length;
  const downloadedCount = offline.offlineChaptersMap.size;
  const remainingChapters = Math.max(totalChapters - downloadedCount, 0);
  const hasActiveDownloads = offline.queueItems.length > 0;
  const allDownloaded = remainingChapters === 0;

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
        message: `Queued ${targets.length} chapter${targets.length === 1 ? "" : "s"}. Check sidebar for progress.`,
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

  if (!offline.offlineAvailable) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Badge
          variant={allDownloaded ? "filled" : "light"}
          color={allDownloaded ? "green" : "blue"}
          leftSection={allDownloaded ? <Check size={12} /> : undefined}
          size="lg"
        >
          {downloadedCount}/{totalChapters} offline
        </Badge>

        {hasActiveDownloads && (
          <Badge
            variant="light"
            color="blue"
            size="lg"
            className="animate-pulse"
          >
            {offline.queueItems.length} downloading
          </Badge>
        )}
      </div>

      {!allDownloaded && (
        <Button
          size="sm"
          variant="light"
          leftSection={<Download size={16} />}
          loading={offline.queueingManga || hasActiveDownloads}
          onClick={handleDownloadMissing}
        >
          {downloadedCount === 0
            ? "Download All"
            : `Download ${remainingChapters} More`}
        </Button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Collapse, Progress, Text, ActionIcon, ScrollArea } from "@mantine/core";
import { ChevronDown, ChevronUp, Download, X } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { getOfflineQueue, cancelOfflineDownload, type OfflineQueuedDownload } from "@/lib/api";
import { useOfflineEvents } from "@/hooks/use-offline-events";

interface DownloadsByManga {
  [mangaId: string]: {
    mangaSlug: string;
    downloads: OfflineQueuedDownload[];
  };
}

export function GlobalDownloadStatus() {
  const { collapsed: sidebarCollapsed } = useUIStore();
  const [expanded, setExpanded] = useState(true);
  const [downloads, setDownloads] = useState<OfflineQueuedDownload[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial queue
  useEffect(() => {
    getOfflineQueue()
      .then((queue) => {
        setDownloads(queue);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load download queue:", error);
        setLoading(false);
      });
  }, []);

  // Listen for real-time updates
  useOfflineEvents({
    onEvent: useCallback((event) => {
      switch (event.type) {
        case "download-started":
          // Refresh queue to get new items
          getOfflineQueue().then(setDownloads).catch(console.error);
          break;

        case "download-progress":
          if (event.queueId !== undefined) {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === event.queueId
                  ? {
                      ...item,
                      status: "downloading" as const,
                      progressCurrent: event.progressCurrent ?? item.progressCurrent,
                      progressTotal: event.progressTotal ?? item.progressTotal,
                    }
                  : item
              )
            );
          }
          break;

        case "download-completed":
          if (event.queueId !== undefined) {
            setDownloads((prev) => prev.filter((item) => item.id !== event.queueId));
          }
          break;

        case "download-failed":
          if (event.queueId !== undefined) {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === event.queueId
                  ? {
                      ...item,
                      status: "failed" as const,
                      errorMessage: event.error,
                    }
                  : item
              )
            );
          }
          break;
      }
    }, []),
  });

  // Group downloads by manga
  const downloadsByManga: DownloadsByManga = downloads.reduce((acc, download) => {
    if (!acc[download.mangaId]) {
      acc[download.mangaId] = {
        mangaSlug: download.mangaSlug,
        downloads: [],
      };
    }
    acc[download.mangaId].downloads.push(download);
    return acc;
  }, {} as DownloadsByManga);

  const hasDownloads = downloads.length > 0;

  if (!hasDownloads && !loading) {
    return null;
  }

  const handleCancel = async (queueId: number) => {
    try {
      await cancelOfflineDownload(queueId);
      setDownloads((prev) => prev.filter((item) => item.id !== queueId));
    } catch (error) {
      console.error("Failed to cancel download:", error);
    }
  };

  return (
    <Box className="flex-shrink-0 border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 p-3 hover:bg-muted/50 transition-colors",
          sidebarCollapsed && "justify-center"
        )}
      >
        <Download size={18} className="flex-shrink-0" />
        {!sidebarCollapsed && (
          <>
            <Text size="sm" fw={500} className="flex-1 text-left">
              Downloads ({downloads.length})
            </Text>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </>
        )}
      </button>

      <Collapse in={expanded && !sidebarCollapsed}>
        <ScrollArea.Autosize mah={300} className="border-t border-border">
          <Box p="xs">
            {Object.entries(downloadsByManga).map(([mangaId, { mangaSlug, downloads: mangaDownloads }]) => (
              <Box key={mangaId} mb="sm">
                <Text size="xs" fw={600} c="dimmed" mb={4} className="truncate" title={mangaSlug}>
                  {mangaSlug}
                </Text>
                <Box className="space-y-2">
                  {mangaDownloads.map((download) => {
                    const percent =
                      download.progressTotal > 0
                        ? Math.round((download.progressCurrent / download.progressTotal) * 100)
                        : 0;

                    return (
                      <Box
                        key={download.id}
                        className="rounded border border-border bg-background/50 p-2"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Text size="xs" className="flex-1 truncate">
                            {download.chapterId ? `Ch. ${download.chapterId}` : "Full manga"}
                          </Text>
                          {download.status === "queued" && (
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => handleCancel(download.id)}
                              aria-label="Cancel download"
                            >
                              <X size={12} />
                            </ActionIcon>
                          )}
                        </div>

                        {download.status === "downloading" && (
                          <>
                            <Progress size="xs" value={percent} mb={4} />
                            <Text size="xs" c="dimmed">
                              {download.progressCurrent} / {download.progressTotal} pages ({percent}%)
                            </Text>
                          </>
                        )}

                        {download.status === "queued" && (
                          <Text size="xs" c="dimmed">
                            Queued
                          </Text>
                        )}

                        {download.status === "failed" && (
                          <Text size="xs" c="red">
                            Failed: {download.errorMessage || "Unknown error"}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </ScrollArea.Autosize>
      </Collapse>
    </Box>
  );
}

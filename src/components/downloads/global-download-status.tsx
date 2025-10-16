"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Collapse, Progress, Text, ActionIcon, ScrollArea, Button } from "@mantine/core";
import { ChevronDown, ChevronUp, Download, X, ArrowRight } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getOfflineQueue, cancelOfflineDownload, type OfflineQueuedDownload } from "@/lib/api";
import { useOfflineEvents, type OfflineDownloadEvent } from "@/hooks/use-offline-events";
import { MIN_SIDEBAR_WIDTH } from "@/store/ui";

interface DownloadsByManga {
  [mangaId: string]: {
    mangaSlug: string;
    downloads: OfflineQueuedDownload[];
  };
}

export function GlobalDownloadStatus() {
  const { collapsed: sidebarCollapsed } = useUIStore();
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [downloads, setDownloads] = useState<OfflineQueuedDownload[]>([]);

  // Calculate available width for content (sidebar width - padding)
  const contentWidth = sidebarCollapsed ? 0 : Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth) - 16; // 16px total horizontal padding

  // Load initial queue
  useEffect(() => {
    getOfflineQueue()
      .then((queue) => {
        setDownloads(queue);
      })
      .catch((error) => {
        console.error("Failed to load download queue:", error);
      });
  }, []);

  // Listen for real-time updates
  useOfflineEvents({
    onEvent: useCallback((event: OfflineDownloadEvent) => {
      switch (event.type) {
        case "download-started":
          // Optimistically update status to downloading
          if (event.queueId !== undefined) {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === event.queueId
                  ? { ...item, status: "downloading" as const }
                  : item
              )
            );
          }
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
        <Box className="border-t border-border">
          <Box px="xs" py="sm">
            <Button
              variant="subtle"
              size="compact-sm"
              fullWidth
              justify="space-between"
              onClick={() => router.push("/downloads")}
              rightSection={<ArrowRight size={12} />}
              styles={{
                label: {
                  fontSize: "0.75rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            >
              View All Downloads
            </Button>
          </Box>
          <ScrollArea.Autosize mah={300} scrollbarSize={6}>
            <Box pt="xs" px="xs" pb={0} style={{ maxWidth: contentWidth }}>
              {Object.entries(downloadsByManga).map(([mangaId, { mangaSlug, downloads: mangaDownloads }]) => (
                <Box key={mangaId} mb="sm" style={{ maxWidth: '100%' }}>
                  <Text
                    size="xs"
                    fw={600}
                  c="dimmed"
                  mb={4}
                  title={mangaSlug}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {mangaSlug}
                </Text>
                <Box className="space-y-2">
                  {mangaDownloads.map((download) => {
                    const percent =
                      download.progressTotal > 0
                        ? Math.round((download.progressCurrent / download.progressTotal) * 100)
                        : 0;

                    // Format chapter display - simplified logic
                    let chapterDisplay = "Full manga";
                    if (download.chapterId) {
                      if (download.chapterNumber && download.chapterTitle) {
                        chapterDisplay = `Ch. ${download.chapterNumber}: ${download.chapterTitle}`;
                      } else if (download.chapterNumber) {
                        chapterDisplay = `Chapter ${download.chapterNumber}`;
                      } else if (download.chapterTitle) {
                        chapterDisplay = download.chapterTitle;
                      } else {
                        // Fallback: show last 8 chars of ID
                        chapterDisplay = `Ch. ${download.chapterId.slice(-8)}`;
                      }
                    }

                    return (
                      <Box
                        key={download.id}
                        className="rounded border border-border bg-background/50 p-2"
                        style={{ maxWidth: '100%', overflow: 'hidden' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1" style={{ maxWidth: '100%' }}>
                          <Text
                            size="xs"
                            className="flex-1"
                            title={download.chapterId || "Full manga download"}
                            style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {chapterDisplay}
                          </Text>
                          {download.status === "queued" && (
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => handleCancel(download.id)}
                              aria-label="Cancel download"
                              className="flex-shrink-0"
                            >
                              <X size={12} />
                            </ActionIcon>
                          )}
                        </div>

                        {download.status === "downloading" && (
                          <>
                            <Progress size="xs" value={percent} mb={4} />
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
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
                          <Text
                            size="xs"
                            c="red"
                            title={download.errorMessage}
                            style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
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
        </Box>
      </Collapse>
    </Box>
  );
}

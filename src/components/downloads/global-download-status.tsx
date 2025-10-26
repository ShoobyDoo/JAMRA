"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Box,
  Collapse,
  Progress,
  Text,
  ActionIcon,
  ScrollArea,
  Popover,
  Badge,
  Tooltip,
} from "@mantine/core";
import { ChevronDown, ChevronUp, Download, X, WifiOff } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import {
  getOfflineQueue,
  cancelOfflineDownload,
  type OfflineQueuedDownload,
} from "@/lib/api";
import { STYLES } from "@/lib/constants";
import {
  useOfflineEvents,
  type OfflineDownloadEvent,
} from "@/hooks/use-offline-events";
import { MIN_SIDEBAR_WIDTH } from "@/store/ui";
import { logger } from "@/lib/logger";

interface DownloadsByManga {
  [mangaId: string]: {
    mangaSlug: string;
    mangaTitle?: string;
    downloads: OfflineQueuedDownload[];
  };
}

const DOWNLOAD_CLASSES = {
  buttonLabel:
    "block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium",
  sectionMaxWidth: "max-w-full",
  itemContainer: "max-w-full overflow-hidden",
  itemHeader: "mb-1 flex w-full items-start justify-between gap-2 max-w-full",
  textInline: `flex-1 min-w-0 ${STYLES.TEXT_TRUNCATE_INLINE}`,
  textBlock: STYLES.TEXT_TRUNCATE,
  badge: `${STYLES.BADGE_COUNTER} absolute right-1.5 top-1.5`,
};

// Helper to display manga title, handling cases where backend populates slug with ID
function getMangaDisplayName(download: OfflineQueuedDownload): string {
  if (download.mangaTitle && download.mangaTitle.trim()) {
    return download.mangaTitle;
  }

  // Check if mangaSlug looks like a ULID
  const ulidPattern = /^[0-9A-Z]{26}$/;
  if (ulidPattern.test(download.mangaSlug)) {
    return `Manga (${download.mangaSlug.slice(0, 8)}...)`;
  }

  return download.mangaSlug;
}

export function GlobalDownloadStatus() {
  const sidebarCollapsed = useUIStore((state) => state.collapsed);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const [expanded, setExpanded] = useState(false);
  const [popoverOpened, setPopoverOpened] = useState(false);
  const [downloads, setDownloads] = useState<OfflineQueuedDownload[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const queueRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate available width for content (sidebar width - padding)
  const contentWidth = sidebarCollapsed
    ? 0
    : Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth) - 16; // 16px total horizontal padding

  // Debounced queue refresh function
  const refreshQueueDebounced = useCallback(() => {
    if (queueRefreshTimeoutRef.current) {
      clearTimeout(queueRefreshTimeoutRef.current);
    }
    queueRefreshTimeoutRef.current = setTimeout(() => {
      getOfflineQueue()
        .then((queue) => {
          setDownloads(queue);
        })
        .catch((error) => {
          logger.error("Failed to refresh queue", {
            component: "GlobalDownloadStatus",
            action: "refresh-queue-debounced",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });
    }, 500); // 500ms debounce
  }, []);

  // Load initial queue
  useEffect(() => {
    getOfflineQueue()
      .then((queue) => {
        setDownloads(queue);
      })
      .catch((error) => {
        logger.error("Failed to load offline download queue", {
          component: "GlobalDownloadStatus",
          action: "load-queue",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    // Cleanup debounce timeout on unmount
    return () => {
      if (queueRefreshTimeoutRef.current) {
        clearTimeout(queueRefreshTimeoutRef.current);
      }
    };
  }, []);

  // Listen for real-time updates
  const { connected } = useOfflineEvents({
    onEvent: useCallback((event: OfflineDownloadEvent) => {
      switch (event.type) {
        case "download-queued":
          // New item added to queue - debounced refresh to avoid flooding during bulk operations
          refreshQueueDebounced();
          break;

        case "download-started":
          // Optimistically update status to downloading
          if (event.queueId !== undefined) {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === event.queueId
                  ? { ...item, status: "downloading" as const }
                  : item,
              ),
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
                      progressCurrent:
                        event.progressCurrent ?? item.progressCurrent,
                      progressTotal: event.progressTotal ?? item.progressTotal,
                    }
                  : item,
              ),
            );
          }
          break;

        case "download-completed":
          if (event.queueId !== undefined) {
            setDownloads((prev) =>
              prev.filter((item) => item.id !== event.queueId),
            );
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
                  : item,
              ),
            );
          }
          break;
      }
    }, [refreshQueueDebounced]),
  });

  // Update SSE connected state
  useEffect(() => {
    setSseConnected(connected);
  }, [connected]);

  // Fallback polling when SSE is disconnected - only if there are active downloads
  useEffect(() => {
    if (sseConnected || downloads.length === 0) {
      return; // SSE is connected or no active downloads, no need to poll
    }

    const pollInterval = setInterval(() => {
      getOfflineQueue()
        .then((queue) => {
          setDownloads(queue);
        })
        .catch((error) => {
          logger.error("Failed to poll offline download queue", {
            component: "GlobalDownloadStatus",
            action: "poll-queue",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });
    }, 15000); // Poll every 15 seconds when SSE is disconnected and downloads are active

    return () => {
      clearInterval(pollInterval);
    };
  }, [sseConnected, downloads.length]);


  // Group downloads by manga
  const downloadsByManga: DownloadsByManga = useMemo(() => {
    return downloads.reduce((acc, download) => {
      if (!acc[download.mangaId]) {
        acc[download.mangaId] = {
          mangaSlug: download.mangaSlug,
          mangaTitle: getMangaDisplayName(download),
          downloads: [],
        };
      }
      acc[download.mangaId].downloads.push(download);
      return acc;
    }, {} as DownloadsByManga);
  }, [downloads]);

  const handleCancel = async (queueId: number) => {
    try {
      await cancelOfflineDownload(queueId);
      setDownloads((prev) => prev.filter((item) => item.id !== queueId));
    } catch (error) {
      logger.error("Failed to cancel offline download", {
        component: "GlobalDownloadStatus",
        action: "cancel-download",
        queueId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  // Render downloads list content (shared between expanded sidebar and popover)
  const renderDownloadsContent = (maxWidth?: number) => {
    const mangaEntries = Object.entries(downloadsByManga);

    return (
      <>
        {downloads.length > 0 ? (
          <ScrollArea.Autosize mah={400} scrollbarSize={6}>
            <Box px="xs" pb="sm" style={{ maxWidth }}>
              {mangaEntries.map(
                ([mangaId, { mangaTitle, downloads: mangaDownloads }]) => (
                  <Box
                    key={mangaId}
                    mb="sm"
                    className={DOWNLOAD_CLASSES.sectionMaxWidth}
                  >
                    <Text
                      size="xs"
                      fw={600}
                      c="dimmed"
                      mb={4}
                      title={mangaTitle}
                      className={DOWNLOAD_CLASSES.textBlock}
                    >
                      {mangaTitle}
                    </Text>
                    <Box className="space-y-2">
                      {mangaDownloads.map((download) => {
                        const percent =
                          download.progressTotal > 0
                            ? Math.round(
                                (download.progressCurrent /
                                  download.progressTotal) *
                                  100,
                              )
                            : 0;

                        // Format chapter display
                        let chapterDisplay = "Full manga";
                        if (download.chapterId) {
                          if (download.chapterNumber && download.chapterTitle) {
                            chapterDisplay = `Ch. ${download.chapterNumber}: ${download.chapterTitle}`;
                          } else if (download.chapterNumber) {
                            chapterDisplay = `Chapter ${download.chapterNumber}`;
                          } else if (download.chapterTitle) {
                            chapterDisplay = download.chapterTitle;
                          } else {
                            chapterDisplay = `Ch. ${download.chapterId.slice(-8)}`;
                          }
                        }

                        return (
                          <Box
                            key={download.id}
                            className={cn(
                              "rounded border border-border bg-background/50 p-2",
                              DOWNLOAD_CLASSES.itemContainer,
                            )}
                          >
                            <div className={DOWNLOAD_CLASSES.itemHeader}>
                              <Text
                                size="xs"
                                className={DOWNLOAD_CLASSES.textInline}
                                title={
                                  download.chapterId || "Full manga download"
                                }
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
                                  className={DOWNLOAD_CLASSES.textBlock}
                                >
                                  {download.progressCurrent} /{" "}
                                  {download.progressTotal} pages ({percent}%)
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
                                className={DOWNLOAD_CLASSES.textBlock}
                              >
                                Failed: {download.errorMessage || "Unknown error"}
                              </Text>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ),
              )}
            </Box>
          </ScrollArea.Autosize>
        ) : (
          <Box px="xs" py="lg">
            <Text size="xs" c="dimmed">
              No downloads in queue
            </Text>
          </Box>
        )}
      </>
    );
  };

  // If sidebar is collapsed, show popover on click
  if (sidebarCollapsed) {
    return (
      <Box className="flex-shrink-0 border-t border-border">
        <Popover
          width={280}
          position="right"
          withArrow
          shadow="md"
          opened={popoverOpened}
          onChange={setPopoverOpened}
        >
          <Popover.Target>
            <button
              onClick={() => setPopoverOpened(!popoverOpened)}
              className={cn(
                "flex w-full items-center gap-2 p-3 hover:bg-muted/50 transition-colors relative",
                "justify-center",
              )}
              aria-label={`Queue (${downloads.length} items)`}
            >
              <Download size={18} className="flex-shrink-0" />
              {downloads.length > 0 && (
                <Badge size="xs" circle className={DOWNLOAD_CLASSES.badge}>
                  {downloads.length}
                </Badge>
              )}
            </button>
          </Popover.Target>

          <Popover.Dropdown p={0}>
            <Box className="border-b border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Text size="sm" fw={500}>
                  Queue ({downloads.length})
                </Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => setPopoverOpened(false)}
                  aria-label="Close"
                >
                  <X size={14} />
                </ActionIcon>
              </div>
              {!sseConnected && (
                <Box className="flex items-center gap-1 mt-1">
                  <WifiOff size={12} className="text-amber-500" />
                  <Text size="xs" c="dimmed">
                    Offline mode - updates may be delayed
                  </Text>
                </Box>
              )}
            </Box>
            {renderDownloadsContent(280)}
          </Popover.Dropdown>
        </Popover>
      </Box>
    );
  }

  // Expanded sidebar view
  return (
    <Box className="flex-shrink-0 border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-2 p-3 hover:bg-muted/50 transition-colors",
        )}
      >
        <Download size={18} className="flex-shrink-0" />
        <Text size="sm" fw={500} className="flex-1 text-left">
          Queue ({downloads.length})
        </Text>
        {!sseConnected && (
          <Tooltip label="Offline mode - updates may be delayed">
            <WifiOff size={14} className="text-amber-500" />
          </Tooltip>
        )}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <Collapse in={expanded}>
        <Box className="border-t border-border">
          {renderDownloadsContent(contentWidth)}
        </Box>
      </Collapse>
    </Box>
  );
}

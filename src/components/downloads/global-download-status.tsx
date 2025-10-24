"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Box, Text, Badge, Tooltip } from "@mantine/core";
import { Download, ArrowRight, WifiOff } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getOfflineQueue, type OfflineQueuedDownload } from "@/lib/api";
import { STYLES } from "@/lib/constants";
import {
  useOfflineEvents,
  type OfflineDownloadEvent,
} from "@/hooks/use-offline-events";
import { logger } from "@/lib/logger";

const DOWNLOAD_CLASSES = {
  badge: `${STYLES.BADGE_COUNTER} absolute right-1.5 top-1.5`,
};

export function GlobalDownloadStatus() {
  const sidebarCollapsed = useUIStore((state) => state.collapsed);
  const router = useRouter();
  const [downloads, setDownloads] = useState<OfflineQueuedDownload[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const queueRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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


  // If sidebar is collapsed, navigate to downloads page on click
  if (sidebarCollapsed) {
    return (
      <Box className="flex-shrink-0 border-t border-border">
        <button
          onClick={() => router.push("/downloads")}
          className={cn(
            "flex w-full items-center gap-2 p-3 hover:bg-muted/50 transition-colors relative",
            "justify-center",
          )}
          aria-label={`Downloads (${downloads.length} active)`}
        >
          <Download size={18} className="flex-shrink-0" />
          {downloads.length > 0 && (
            <Badge size="xs" circle className={DOWNLOAD_CLASSES.badge}>
              {downloads.length}
            </Badge>
          )}
          {!sseConnected && (
            <Badge
              size="xs"
              color="yellow"
              circle
              className="absolute left-1.5 top-1.5"
            >
              <WifiOff size={10} />
            </Badge>
          )}
        </button>
      </Box>
    );
  }

  // Expanded sidebar view - navigate to downloads page on click
  return (
    <Box className="flex-shrink-0 border-t border-border">
      <button
        onClick={() => router.push("/downloads")}
        className={cn(
          "flex w-full items-center gap-2 p-3 hover:bg-muted/50 transition-colors",
        )}
      >
        <Download size={18} className="flex-shrink-0" />
        <Text size="sm" fw={500} className="flex-1 text-left">
          Downloads ({downloads.length})
        </Text>
        {!sseConnected && (
          <Tooltip label="Offline mode - updates may be delayed">
            <WifiOff size={14} className="text-amber-500" />
          </Tooltip>
        )}
        <ArrowRight size={16} className="flex-shrink-0" />
      </button>
    </Box>
  );
}

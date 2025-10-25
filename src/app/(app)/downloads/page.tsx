"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Box, Title, Text, Tabs } from "@mantine/core";
import { Download, History, FolderArchive } from "lucide-react";
import {
  getOfflineQueue,
  cancelOfflineDownload,
  retryOfflineDownload,
  retryFrozenDownloads,
  type OfflineQueuedDownload,
  getOfflineDownloadHistory,
  deleteOfflineHistoryItem,
  clearOfflineDownloadHistory,
  type OfflineDownloadHistoryItem,
} from "@/lib/api";
import {
  useOfflineEvents,
  type OfflineDownloadEvent,
} from "@/hooks/use-offline-events";
import { logger } from "@/lib/logger";
import {
  isFrozen,
  groupByManga,
  groupByExtension,
  groupByStatus,
} from "@/components/downloads/download-utils";
import { DownloadsQueueSection } from "@/components/downloads/downloads-queue-section";
import { DownloadsHistorySection } from "@/components/downloads/downloads-history-section";
import { ManagerTab } from "@/components/downloads/manager-tab";
import type {
  GroupBy,
  StatusFilter,
  DownloadsQueueStats,
} from "@/components/downloads/types";
import { DOWNLOAD_HISTORY_LIMIT } from "@/lib/constants";
import { usePerformanceMonitor } from "@/hooks/use-performance-monitor";

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<OfflineQueuedDownload[]>([]);
  const [history, setHistory] = useState<OfflineDownloadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      return localStorage.getItem("downloads-active-tab") ?? "active";
    }
    return "active";
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );

  // Filter/group state
  const [groupBy, setGroupBy] = useState<GroupBy>("manga");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  usePerformanceMonitor("DownloadsPage", {
    detail: { initialTab: "active" },
  });

  // Persist active tab to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && activeTab) {
      localStorage.setItem("downloads-active-tab", activeTab);
    }
  }, [activeTab]);

  // Load initial queue and history
  useEffect(() => {
    Promise.all([getOfflineQueue(), getOfflineDownloadHistory(DOWNLOAD_HISTORY_LIMIT)])
      .then(([queue, historyData]) => {
        setDownloads(queue);
        setHistory(historyData);
        setLoading(false);
      })
      .catch((error) => {
        logger.error("Failed to load download data", {
          component: "DownloadsPage",
          action: "initial-load",
          error: error instanceof Error ? error : new Error(String(error)),
        });
        setLoading(false);
      });
  }, []);

  // Listen for real-time updates
  useOfflineEvents({
    onEvent: useCallback((event: OfflineDownloadEvent) => {
      switch (event.type) {
        case "download-started":
          if (event.queueId !== undefined) {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === event.queueId
                  ? {
                      ...item,
                      status: "downloading" as const,
                      startedAt: Date.now(),
                    }
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
            const completedId = event.queueId;
            setDownloads((prev) =>
              prev.filter((item) => item.id !== completedId),
            );
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(completedId);
              return next;
            });
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
    }, []),
  });

  // Filter downloads by status
  const filteredDownloads = useMemo(() => {
    let filtered = downloads;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => {
        if (statusFilter === "frozen") return isFrozen(d);
        return d.status === statusFilter;
      });
    }

    return filtered;
  }, [downloads, statusFilter]);

  // Group filtered downloads
  const groupedDownloads = useMemo(() => {
    if (groupBy === "none") {
      return new Map([["all", filteredDownloads]]);
    }

    switch (groupBy) {
      case "manga":
        return groupByManga(filteredDownloads);
      case "extension":
        return groupByExtension(filteredDownloads);
      case "status":
        return groupByStatus(filteredDownloads);
      default:
        return new Map([["all", filteredDownloads]]);
    }
  }, [filteredDownloads, groupBy]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredDownloads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDownloads.map((d) => d.id)));
    }
  }, [filteredDownloads, selectedIds.size]);

  const handleSelect = useCallback(
    (id: number, index: number, event: React.MouseEvent) => {
      const newSelected = new Set(selectedIds);

      if (event.shiftKey && lastSelectedIndex !== null) {
        // Range selection
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          if (filteredDownloads[i]) {
            newSelected.add(filteredDownloads[i].id);
          }
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
      } else {
        // Single selection
        newSelected.clear();
        newSelected.add(id);
      }

      setSelectedIds(newSelected);
      setLastSelectedIndex(index);
    },
    [selectedIds, lastSelectedIndex, filteredDownloads],
  );

  // Actions
  const handleCancel = useCallback(async (queueId: number) => {
    try {
      await cancelOfflineDownload(queueId);
      const cancelledId = queueId;
      setDownloads((prev) => prev.filter((item) => item.id !== cancelledId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(cancelledId);
        return next;
      });
    } catch (error) {
      logger.error("Failed to cancel download", {
        component: "DownloadsPage",
        action: "cancel-download",
        queueId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  const handleCancelSelected = useCallback(async () => {
    const promises = Array.from(selectedIds).map((id) => handleCancel(id));
    await Promise.all(promises);
    setSelectedIds(new Set());
  }, [selectedIds, handleCancel]);

  const handleCancelAll = useCallback(async () => {
    const promises = filteredDownloads.map((d) => handleCancel(d.id));
    await Promise.all(promises);
    setSelectedIds(new Set());
  }, [filteredDownloads, handleCancel]);

  const handleResumeFrozen = useCallback(async () => {
    try {
      const result = await retryFrozenDownloads();
      logger.info("Retried frozen downloads", {
        component: "DownloadsPage",
        action: "retry-frozen",
        retriedCount: result.retriedCount,
        retriedIds: result.retriedIds,
      });
      // Downloads will be updated via SSE events
    } catch (error) {
      logger.error("Failed to retry frozen downloads", {
        component: "DownloadsPage",
        action: "retry-frozen",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  const handleRetryDownload = useCallback(async (queueId: number) => {
    try {
      await retryOfflineDownload(queueId);
      logger.info("Retrying individual download", {
        component: "DownloadsPage",
        action: "retry-download",
        queueId,
      });
    } catch (error) {
      logger.error("Failed to retry individual download", {
        component: "DownloadsPage",
        action: "retry-download",
        queueId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  const handleDeleteHistory = useCallback(async (historyId: number) => {
    try {
      await deleteOfflineHistoryItem(historyId);
      setHistory((prev) => prev.filter((item) => item.id !== historyId));
    } catch (error) {
      logger.error("Failed to delete offline history item", {
        component: "DownloadsPage",
        action: "delete-history-item",
        historyId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearOfflineDownloadHistory();
      setHistory([]);
    } catch (error) {
      logger.error("Failed to clear offline download history", {
        component: "DownloadsPage",
        action: "clear-history",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "active") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === "Delete" && selectedIds.size > 0) {
        e.preventDefault();
        handleCancelSelected();
      } else if (e.key === "Escape") {
        setSelectedIds(new Set());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, handleSelectAll, handleCancelSelected, selectedIds.size]);

  // Stats
  const stats = useMemo<DownloadsQueueStats>(() => {
    const activeCount = downloads.filter(
      (d) => d.status === "downloading",
    ).length;
    const queuedCount = downloads.filter((d) => d.status === "queued").length;
    const frozenCount = downloads.filter((d) => isFrozen(d)).length;
    const failedCount = downloads.filter((d) => d.status === "failed").length;

    return {
      total: downloads.length,
      activeCount,
      queuedCount,
      frozenCount,
      failedCount,
    };
  }, [downloads]);

  if (loading) {
    return (
      <Box>
        <Title order={1} mb="md">
          Downloads
        </Title>
        <Text c="dimmed">Loading downloads...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box mb="xl">
        <Title order={1} mb="xs">
          Downloads
        </Title>
        <Text c="dimmed" size="sm">
          Manage your offline manga downloads
        </Text>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List className="[&_button:hover:not([data-active])]:bg-muted/50">
          <Tabs.Tab value="active" leftSection={<Download size={16} />}>
            Active Downloads ({stats.total})
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<History size={16} />}>
            History ({history.length})
          </Tabs.Tab>
          <Tabs.Tab value="manager" leftSection={<FolderArchive size={16} />}>
            Manager
          </Tabs.Tab>
        </Tabs.List>

        {/* Active Downloads Tab */}
        <Tabs.Panel value="active" pt="md">
          <DownloadsQueueSection
            stats={stats}
            groupBy={groupBy}
            statusFilter={statusFilter}
            filteredDownloads={filteredDownloads}
            groupedDownloads={groupedDownloads}
            selectedIds={selectedIds}
            onGroupByChange={setGroupBy}
            onStatusFilterChange={setStatusFilter}
            onSelectAll={handleSelectAll}
            onSelect={handleSelect}
            onCancel={handleCancel}
            onCancelSelected={handleCancelSelected}
            onCancelAll={handleCancelAll}
            onResumeFrozen={handleResumeFrozen}
            onRetryDownload={handleRetryDownload}
            totalDownloadsCount={downloads.length}
          />
        </Tabs.Panel>

        {/* History Tab */}
        <Tabs.Panel value="history" pt="md">
          <DownloadsHistorySection
            history={history}
            onDeleteHistory={handleDeleteHistory}
            onClearHistory={handleClearHistory}
          />
        </Tabs.Panel>

        {/* Manager Tab */}
        <Tabs.Panel value="manager" pt="md">
          <ManagerTab />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

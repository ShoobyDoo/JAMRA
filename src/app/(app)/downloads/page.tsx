"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Title,
  Text,
  Button,
  ActionIcon,
  Progress,
  Badge,
  Tabs,
  Select,
  Checkbox,
  Group,
  Stack,
  Tooltip,
} from "@mantine/core";
import {
  Download,
  X,
  Trash2,
  History,
  RotateCw,
  AlertTriangle,
} from "lucide-react";
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
import {
  isFrozen,
  getDownloadStats,
  formatETA,
  formatSpeed,
  groupByManga,
  groupByExtension,
  groupByStatus,
  formatChapterDisplay,
} from "@/components/downloads/download-utils";

type GroupBy = "none" | "manga" | "extension" | "status";
type StatusFilter = "all" | "queued" | "downloading" | "frozen" | "failed";

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<OfflineQueuedDownload[]>([]);
  const [history, setHistory] = useState<OfflineDownloadHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>("active");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );

  // Filter/group state
  const [groupBy, setGroupBy] = useState<GroupBy>("manga");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Load initial queue and history
  useEffect(() => {
    Promise.all([getOfflineQueue(), getOfflineDownloadHistory(100)])
      .then(([queue, historyData]) => {
        setDownloads(queue);
        setHistory(historyData);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load download data:", error);
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
      console.error("Failed to cancel download:", error);
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
      console.log(`Retried ${result.retriedCount} frozen downloads`);
      // Downloads will be updated via SSE events
    } catch (error) {
      console.error("Failed to retry frozen downloads:", error);
    }
  }, []);

  const handleDeleteHistory = useCallback(async (historyId: number) => {
    try {
      await deleteOfflineHistoryItem(historyId);
      setHistory((prev) => prev.filter((item) => item.id !== historyId));
    } catch (error) {
      console.error("Failed to delete history item:", error);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearOfflineDownloadHistory();
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
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
  const stats = useMemo(() => {
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

  const getStatusBadge = (download: OfflineQueuedDownload) => {
    if (isFrozen(download)) {
      return (
        <Badge
          color="yellow"
          size="sm"
          leftSection={<AlertTriangle size={12} />}
        >
          Frozen
        </Badge>
      );
    }

    const statusMap = {
      queued: { color: "blue", label: "Queued" },
      downloading: { color: "cyan", label: "Downloading" },
      completed: { color: "green", label: "Completed" },
      failed: { color: "red", label: "Failed" },
      paused: { color: "gray", label: "Paused" },
    };

    const config = statusMap[download.status as keyof typeof statusMap] || {
      color: "gray",
      label: download.status,
    };
    return (
      <Badge color={config.color} size="sm">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Box p="xl">
        <Title order={1} mb="md">
          Downloads
        </Title>
        <Text c="dimmed">Loading downloads...</Text>
      </Box>
    );
  }

  return (
    <Box p="xl">
      <Box mb="xl">
        <Title order={1} mb="xs">
          Downloads
        </Title>
        <Text c="dimmed" size="sm">
          Manage your offline manga downloads
        </Text>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="active" leftSection={<Download size={16} />}>
            Active Downloads ({stats.total})
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<History size={16} />}>
            History ({history.length})
          </Tabs.Tab>
        </Tabs.List>

        {/* Active Downloads Tab */}
        <Tabs.Panel value="active" pt="md">
          {/* Controls Bar */}
          <Group justify="space-between" mb="md">
            <Group>
              <Checkbox
                checked={
                  selectedIds.size === filteredDownloads.length &&
                  filteredDownloads.length > 0
                }
                indeterminate={
                  selectedIds.size > 0 &&
                  selectedIds.size < filteredDownloads.length
                }
                onChange={handleSelectAll}
                label="Select All"
              />

              <Select
                value={groupBy}
                onChange={(value) => setGroupBy(value as GroupBy)}
                data={[
                  { value: "none", label: "No Grouping" },
                  { value: "manga", label: "Group by Manga" },
                  { value: "extension", label: "Group by Extension" },
                  { value: "status", label: "Group by Status" },
                ]}
                w={180}
                checkIconPosition="right"
              />

              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                data={[
                  { value: "all", label: "All Status" },
                  { value: "queued", label: "Queued" },
                  { value: "downloading", label: "Downloading" },
                  { value: "frozen", label: "Frozen" },
                  { value: "failed", label: "Failed" },
                ]}
                w={150}
                checkIconPosition="right"
              />
            </Group>

            <Group>
              {stats.frozenCount > 0 && (
                <Button
                  variant="light"
                  color="yellow"
                  size="sm"
                  leftSection={<RotateCw size={16} />}
                  onClick={handleResumeFrozen}
                >
                  Resume Frozen ({stats.frozenCount})
                </Button>
              )}

              {selectedIds.size > 0 && (
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  leftSection={<X size={16} />}
                  onClick={handleCancelSelected}
                >
                  Cancel Selected ({selectedIds.size})
                </Button>
              )}

              {downloads.length > 0 && (
                <Button
                  variant="subtle"
                  color="red"
                  size="sm"
                  leftSection={<Trash2 size={16} />}
                  onClick={handleCancelAll}
                >
                  Cancel All
                </Button>
              )}
            </Group>
          </Group>

          {/* Stats Bar */}
          <Group gap="lg" mb="md">
            <Text size="sm" c="dimmed">
              Total: <strong>{stats.total}</strong>
            </Text>
            <Text size="sm" c="cyan">
              Active: <strong>{stats.activeCount}</strong>
            </Text>
            <Text size="sm" c="blue">
              Queued: <strong>{stats.queuedCount}</strong>
            </Text>
            {stats.frozenCount > 0 && (
              <Text size="sm" c="yellow">
                Frozen: <strong>{stats.frozenCount}</strong>
              </Text>
            )}
            {stats.failedCount > 0 && (
              <Text size="sm" c="red">
                Failed: <strong>{stats.failedCount}</strong>
              </Text>
            )}
          </Group>

          {/* Downloads List */}
          {filteredDownloads.length === 0 ? (
            <Box ta="center" py="xl">
              <Download
                size={48}
                className="mx-auto mb-4 text-muted-foreground"
              />
              <Text c="dimmed" size="lg" mb="xs">
                No active downloads
              </Text>
              <Text c="dimmed" size="sm">
                Downloads will appear here when you start downloading manga
                chapters
              </Text>
            </Box>
          ) : (
            <Stack gap="xs">
              {Array.from(groupedDownloads.entries()).map(
                ([groupKey, groupDownloads]) => (
                  <Box key={groupKey}>
                    {groupBy !== "none" && (
                      <Text
                        fw={600}
                        size="sm"
                        c="dimmed"
                        mb="xs"
                        tt="capitalize"
                      >
                        {groupKey} ({groupDownloads.length})
                      </Text>
                    )}

                    <Stack gap="xs">
                      {groupDownloads.map((download, index) => {
                        const percent =
                          download.progressTotal > 0
                            ? Math.round(
                                (download.progressCurrent /
                                  download.progressTotal) *
                                  100,
                              )
                            : 0;
                        const { speed, eta } = getDownloadStats(download);
                        const chapterDisplay = formatChapterDisplay(download);
                        const isSelected = selectedIds.has(download.id);
                        const frozen = isFrozen(download);

                        return (
                          <Box
                            key={download.id}
                            className={`rounded border ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                : "border-border bg-background"
                            } p-2 cursor-pointer hover:bg-muted/50 transition-colors`}
                            onClick={(e) => handleSelect(download.id, index, e)}
                          >
                            <Group gap="xs" wrap="nowrap">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => {}}
                                onClick={(e) => e.stopPropagation()}
                              />

                              <Box className="flex-shrink-0" w={40} h={60}>
                                <div className="w-full h-full bg-muted rounded overflow-hidden">
                                  {/* Placeholder for cover - could fetch from cache */}
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                    <Download size={16} />
                                  </div>
                                </div>
                              </Box>

                              <Box className="flex-1 min-w-0">
                                <Text
                                  fw={600}
                                  size="sm"
                                  className="truncate"
                                  mb={2}
                                >
                                  {download.mangaTitle || download.mangaSlug}
                                </Text>
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  className="truncate"
                                  mb={4}
                                >
                                  {chapterDisplay}
                                </Text>

                                {download.status === "downloading" && (
                                  <Box>
                                    <Progress
                                      value={percent}
                                      size="xs"
                                      color={frozen ? "yellow" : "cyan"}
                                      mb={4}
                                    />
                                    <Group gap="sm">
                                      <Text size="xs" c="dimmed">
                                        {download.progressCurrent} /{" "}
                                        {download.progressTotal} pages (
                                        {percent}%)
                                      </Text>
                                      {speed > 0 && (
                                        <>
                                          <Text size="xs" c="dimmed">
                                            {formatSpeed(speed)}
                                          </Text>
                                          {eta && (
                                            <Text size="xs" c="dimmed">
                                              ETA: {formatETA(eta)}
                                            </Text>
                                          )}
                                        </>
                                      )}
                                    </Group>
                                  </Box>
                                )}

                                {download.status === "failed" &&
                                  download.errorMessage && (
                                    <Text
                                      size="xs"
                                      c="red"
                                      className="truncate"
                                    >
                                      Error: {download.errorMessage}
                                    </Text>
                                  )}
                              </Box>

                              <Group gap="xs" className="flex-shrink-0">
                                {getStatusBadge(download)}

                                {(download.status === "queued" ||
                                  download.status === "failed" ||
                                  frozen) && (
                                  <Tooltip label="Cancel">
                                    <ActionIcon
                                      size="sm"
                                      variant="subtle"
                                      color="red"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancel(download.id);
                                      }}
                                    >
                                      <X size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}

                                {frozen && (
                                  <Tooltip label="Retry">
                                    <ActionIcon
                                      size="sm"
                                      variant="subtle"
                                      color="yellow"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await retryOfflineDownload(
                                            download.id,
                                          );
                                          console.log(
                                            "Retrying download:",
                                            download.id,
                                          );
                                        } catch (error) {
                                          console.error(
                                            "Failed to retry download:",
                                            error,
                                          );
                                        }
                                      }}
                                    >
                                      <RotateCw size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            </Group>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                ),
              )}
            </Stack>
          )}
        </Tabs.Panel>

        {/* History Tab */}
        <Tabs.Panel value="history" pt="md">
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Recently completed downloads
            </Text>
            {history.length > 0 && (
              <Button
                variant="subtle"
                color="red"
                size="sm"
                leftSection={<Trash2 size={16} />}
                onClick={handleClearHistory}
              >
                Clear History
              </Button>
            )}
          </Group>

          {history.length === 0 ? (
            <Box ta="center" py="xl">
              <History
                size={48}
                className="mx-auto mb-4 text-muted-foreground"
              />
              <Text c="dimmed" size="lg" mb="xs">
                No download history
              </Text>
              <Text c="dimmed" size="sm">
                Completed downloads will appear here
              </Text>
            </Box>
          ) : (
            <Stack gap="xs">
              {history.map((item) => {
                const percent =
                  item.progressTotal > 0
                    ? Math.round(
                        (item.progressCurrent / item.progressTotal) * 100,
                      )
                    : 0;

                let chapterDisplay = "Full manga";
                if (item.chapterId) {
                  if (item.chapterNumber && item.chapterTitle) {
                    chapterDisplay = `Chapter ${item.chapterNumber}: ${item.chapterTitle}`;
                  } else if (item.chapterNumber) {
                    chapterDisplay = `Chapter ${item.chapterNumber}`;
                  } else if (item.chapterTitle) {
                    chapterDisplay = item.chapterTitle;
                  } else {
                    chapterDisplay = `Chapter ${item.chapterId.slice(-8)}`;
                  }
                }

                const completedDate = new Date(item.completedAt);
                const formattedDate =
                  completedDate.toLocaleDateString() +
                  " " +
                  completedDate.toLocaleTimeString();

                return (
                  <Box
                    key={item.id}
                    className="rounded border border-border bg-background p-3"
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Box className="flex-1 min-w-0">
                        <Text fw={600} size="sm" className="truncate" mb={2}>
                          {item.mangaTitle || item.mangaSlug}
                        </Text>
                        <Text size="xs" c="dimmed" className="truncate" mb={2}>
                          {chapterDisplay}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Completed: {formattedDate}
                        </Text>
                        {item.status === "completed" && (
                          <Text size="xs" c="green" mt={4}>
                            ✓ {item.progressCurrent} / {item.progressTotal}{" "}
                            pages ({percent}%)
                          </Text>
                        )}
                        {item.status === "failed" && item.errorMessage && (
                          <Text size="xs" c="red" className="truncate" mt={4}>
                            Error: {item.errorMessage}
                          </Text>
                        )}
                      </Box>

                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteHistory(item.id)}
                      >
                        <X size={16} />
                      </ActionIcon>
                    </Group>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

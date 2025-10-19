"use client";

import { memo } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Progress,
  Select,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  AlertTriangle,
  Download,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import type { OfflineQueuedDownload } from "@/lib/api";
import {
  formatChapterDisplay,
  formatETA,
  formatSpeed,
  getDownloadStats,
  isFrozen,
} from "@/components/downloads/download-utils";
import { cn } from "@/lib/utils";
import type {
  GroupBy,
  StatusFilter,
  DownloadsQueueStats,
} from "@/components/downloads/types";

export interface DownloadsQueueSectionProps {
  stats: DownloadsQueueStats;
  groupBy: GroupBy;
  statusFilter: StatusFilter;
  filteredDownloads: OfflineQueuedDownload[];
  groupedDownloads: Map<string, OfflineQueuedDownload[]>;
  selectedIds: Set<number>;
  onGroupByChange: (value: GroupBy) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSelectAll: () => void;
  onSelect: (
    downloadId: number,
    index: number,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
  onCancel: (downloadId: number) => void;
  onCancelSelected: () => void;
  onCancelAll: () => void;
  onResumeFrozen: () => void;
  onRetryDownload: (downloadId: number) => void;
  totalDownloadsCount: number;
}

export const DownloadsQueueSection = memo(function DownloadsQueueSection({
  stats,
  groupBy,
  statusFilter,
  filteredDownloads,
  groupedDownloads,
  selectedIds,
  onGroupByChange,
  onStatusFilterChange,
  onSelectAll,
  onSelect,
  onCancel,
  onCancelSelected,
  onCancelAll,
  onResumeFrozen,
  onRetryDownload,
  totalDownloadsCount,
}: DownloadsQueueSectionProps) {
  const getStatusBadge = (download: OfflineQueuedDownload) => {
    if (isFrozen(download)) {
      return (
        <Badge color="yellow" size="sm" leftSection={<AlertTriangle size={12} />}>
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
    } as const;

    const config = statusMap[download.status as keyof typeof statusMap] ?? {
      color: "gray",
      label: download.status,
    };

    return (
      <Badge color={config.color} size="sm">
        {config.label}
      </Badge>
    );
  };

  if (filteredDownloads.length === 0) {
    return (
      <Box ta="center" py="xl">
        <Download size={48} className="mx-auto mb-4 text-muted-foreground" />
        <Text c="dimmed" size="lg" mb="xs">
          No active downloads
        </Text>
        <Text c="dimmed" size="sm">
          Downloads will appear here when you start downloading manga chapters
        </Text>
      </Box>
    );
  }

  return (
    <>
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
            onChange={onSelectAll}
            label="Select All"
          />

          <Select
            value={groupBy}
            onChange={(value) => onGroupByChange((value as GroupBy) ?? "none")}
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
            onChange={(value) =>
              onStatusFilterChange((value as StatusFilter) ?? "all")
            }
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
              onClick={onResumeFrozen}
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
              onClick={onCancelSelected}
            >
              Cancel Selected ({selectedIds.size})
            </Button>
          )}

          {totalDownloadsCount > 0 && (
            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<Trash2 size={16} />}
              onClick={onCancelAll}
            >
              Cancel All
            </Button>
          )}
        </Group>
      </Group>

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

      <Stack gap="xs">
        {Array.from(groupedDownloads.entries()).map(
          ([groupKey, groupDownloads]) => (
            <Box key={groupKey}>
              {groupBy !== "none" && (
                <Text fw={600} size="sm" c="dimmed" mb="xs" tt="capitalize">
                  {groupKey} ({groupDownloads.length})
                </Text>
              )}

              <Stack gap="xs">
                {groupDownloads.map((download, index) => {
                  const percent =
                    download.progressTotal > 0
                      ? Math.round(
                          (download.progressCurrent / download.progressTotal) *
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
                      className={cn(
                        "cursor-pointer rounded border p-2 transition-colors",
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                      onClick={(event) => onSelect(download.id, index, event)}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={(event) => event.stopPropagation()}
                        />

                        <Box className="flex-shrink-0" w={40} h={60}>
                          <div className="h-full w-full rounded bg-muted">
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              <Download size={16} />
                            </div>
                          </div>
                        </Box>

                        <Box className="flex-1 min-w-0">
                          <Text fw={600} size="sm" className="truncate" mb={2}>
                            {download.mangaTitle || download.mangaSlug}
                          </Text>
                          <Text size="xs" c="dimmed" className="truncate" mb={4}>
                            {chapterDisplay}
                          </Text>

                          {download.status === "downloading" && (
                            <Box>
                              <Progress value={percent} size="xs" mb={4} />
                              <Group gap="xs" c="dimmed" size="xs">
                                <Text size="xs">
                                  {percent}% • {formatSpeed(speed)}
                                </Text>
                                <Text size="xs">• ETA {formatETA(eta)}</Text>
                              </Group>
                            </Box>
                          )}
                        </Box>

                        <Group gap="xs" className="flex-shrink-0" wrap="nowrap">
                          {getStatusBadge(download)}

                          {(download.status === "queued" ||
                            download.status === "failed" ||
                            frozen) && (
                            <Tooltip label="Cancel">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="red"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onCancel(download.id);
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRetryDownload(download.id);
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
    </>
  );
});

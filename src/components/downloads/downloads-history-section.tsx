"use client";

import { memo, useState, useMemo } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Select,
  Collapse,
} from "@mantine/core";
import { History, X, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import type { OfflineDownloadHistoryItem } from "@/lib/api";
import { useDebouncedValue } from "@mantine/hooks";

export interface DownloadsHistorySectionProps {
  history: OfflineDownloadHistoryItem[];
  onDeleteHistory: (historyId: number) => void;
  onClearHistory: () => void;
}

type DateGroup = "today" | "this-week" | "this-month" | "older";

function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return "today";
  if (diffDays < 7) return "this-week";
  if (diffDays < 30) return "this-month";
  return "older";
}

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  "today": "Today",
  "this-week": "This Week",
  "this-month": "This Month",
  "older": "Older",
};

export const DownloadsHistorySection = memo(function DownloadsHistorySection({
  history,
  onDeleteHistory,
  onClearHistory,
}: DownloadsHistorySectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string | null>("all");
  const [sortBy, setSortBy] = useState<string | null>("newest");
  const [expandedGroups, setExpandedGroups] = useState<Set<DateGroup>>(
    new Set()
  );

  // Filter and sort history
  const filteredAndSortedHistory = useMemo(() => {
    let filtered = history;

    // Filter by search query
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.mangaTitle?.toLowerCase().includes(query) ||
          item.mangaSlug?.toLowerCase().includes(query) ||
          item.chapterTitle?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.completedAt).getTime();
      const dateB = new Date(b.completedAt).getTime();
      return sortBy === "oldest" ? dateA - dateB : dateB - dateA;
    });

    return sorted;
  }, [history, debouncedQuery, statusFilter, sortBy]);

  // Group by date
  const groupedHistory = useMemo(() => {
    const groups: Record<DateGroup, OfflineDownloadHistoryItem[]> = {
      "today": [],
      "this-week": [],
      "this-month": [],
      "older": [],
    };

    filteredAndSortedHistory.forEach((item) => {
      const date = new Date(item.completedAt);
      const group = getDateGroup(date);
      groups[group].push(item);
    });

    return groups;
  }, [filteredAndSortedHistory]);

  const toggleGroup = (group: DateGroup) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  };

  if (history.length === 0) {
    return (
      <Box ta="center" py="xl">
        <History size={48} className="mx-auto mb-4 text-muted-foreground" />
        <Text c="dimmed" size="lg" mb="xs">
          No download history
        </Text>
        <Text c="dimmed" size="sm">
          Completed downloads will appear here
        </Text>
      </Box>
    );
  }

  const renderHistoryItem = (item: OfflineDownloadHistoryItem) => {
    const percent =
      item.progressTotal > 0
        ? Math.round((item.progressCurrent / item.progressTotal) * 100)
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
    const formattedDate = `${completedDate.toLocaleDateString()} ${completedDate.toLocaleTimeString()}`;

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
                ✓ {item.progressCurrent} / {item.progressTotal} pages ({percent}%)
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
            onClick={() => onDeleteHistory(item.id)}
          >
            <X size={16} />
          </ActionIcon>
        </Group>
      </Box>
    );
  };

  return (
    <>
      {/* Filters and Controls */}
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="sm" className="flex-1">
          <TextInput
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<Search size={16} />}
            className="flex-1"
            styles={{ root: { minWidth: 200 } }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: "all", label: "All Status" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
            ]}
            styles={{ root: { width: 150 } }}
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            data={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
            ]}
            styles={{ root: { width: 150 } }}
          />
        </Group>
        <Button
          variant="subtle"
          color="red"
          size="sm"
          leftSection={<Trash2 size={16} />}
          onClick={onClearHistory}
        >
          Clear History
        </Button>
      </Group>

      {/* Result count */}
      <Text size="sm" c="dimmed" mb="md">
        {filteredAndSortedHistory.length} of {history.length} downloads
      </Text>

      {/* Grouped History */}
      <Stack gap="md">
        {(Object.keys(groupedHistory) as DateGroup[]).map((group) => {
          const items = groupedHistory[group];
          if (items.length === 0) return null;

          const isExpanded = expandedGroups.has(group);

          return (
            <Box key={group}>
              <Button
                variant="subtle"
                fullWidth
                onClick={() => toggleGroup(group)}
                rightSection={
                  isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                }
                styles={{
                  root: { justifyContent: "space-between" },
                  inner: { justifyContent: "space-between" },
                }}
                mb="xs"
              >
                <Group gap="xs">
                  <Text fw={600}>{DATE_GROUP_LABELS[group]}</Text>
                  <Text c="dimmed" size="sm">
                    ({items.length})
                  </Text>
                </Group>
              </Button>

              <Collapse in={isExpanded}>
                <Stack gap="xs">
                  {items.map(renderHistoryItem)}
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Stack>

      {/* No results message */}
      {filteredAndSortedHistory.length === 0 && (
        <Box ta="center" py="xl">
          <History size={48} className="mx-auto mb-4 text-muted-foreground" />
          <Text c="dimmed" size="lg" mb="xs">
            No matching downloads
          </Text>
          <Text c="dimmed" size="sm">
            Try adjusting your search or filters
          </Text>
        </Box>
      )}
    </>
  );
});

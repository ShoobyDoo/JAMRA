"use client";

import { memo } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { History, X, Trash2 } from "lucide-react";
import type { OfflineDownloadHistoryItem } from "@/lib/api";

export interface DownloadsHistorySectionProps {
  history: OfflineDownloadHistoryItem[];
  onDeleteHistory: (historyId: number) => void;
  onClearHistory: () => void;
}

export const DownloadsHistorySection = memo(function DownloadsHistorySection({
  history,
  onDeleteHistory,
  onClearHistory,
}: DownloadsHistorySectionProps) {
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

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Recently completed downloads
        </Text>
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

      <Stack gap="xs">
        {history.map((item) => {
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
                      ✓ {item.progressCurrent} / {item.progressTotal} pages (
                      {percent}%)
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
        })}
      </Stack>
    </>
  );
});

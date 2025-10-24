"use client";

import { useMemo } from "react";
import { Box, Text, Grid, Progress, Stack, Group, Badge, Skeleton } from "@mantine/core";
import { HardDrive, Database, FileText, Image } from "lucide-react";
import type { StorageStats } from "@/lib/api/offline";

interface StorageDashboardProps {
  stats: StorageStats | null;
  loading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function StorageDashboard({ stats, loading }: StorageDashboardProps) {
  // Calculate extension stats
  const extensionStats = useMemo(() => {
    if (!stats) return [];

    return Object.entries(stats.byExtension)
      .map(([extensionId, bytes]) => ({
        extensionId,
        bytes,
        formatted: formatBytes(bytes),
        percentage: stats.totalBytes > 0 ? (bytes / stats.totalBytes) * 100 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [stats]);

  // Calculate top manga by size
  const topManga = useMemo(() => {
    if (!stats) return [];

    return [...stats.byManga]
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 10);
  }, [stats]);

  if (loading) {
    return (
      <Stack gap="lg">
        {/* Summary Cards Skeleton */}
        <Grid>
          {[1, 2, 3, 4].map((i) => (
            <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 3 }}>
              <Box className="rounded border border-border bg-background p-4">
                <Skeleton height={20} width="60%" mb="xs" />
                <Skeleton height={32} width="80%" mb="xs" />
                <Skeleton height={16} width="40%" />
              </Box>
            </Grid.Col>
          ))}
        </Grid>

        {/* Extension Breakdown Skeleton */}
        <Box className="rounded border border-border bg-background p-4">
          <Skeleton height={24} width="200px" mb="md" />
          <Stack gap="md">
            {[1, 2, 3].map((i) => (
              <Box key={i}>
                <Skeleton height={16} width="150px" mb="xs" />
                <Skeleton height={8} mb="xs" />
                <Skeleton height={14} width="80px" />
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Top Manga Skeleton */}
        <Box className="rounded border border-border bg-background p-4">
          <Skeleton height={24} width="250px" mb="md" />
          <Stack gap="sm">
            {[1, 2, 3, 4, 5].map((i) => (
              <Group key={i} justify="space-between">
                <Skeleton height={16} width="60%" />
                <Skeleton height={16} width="80px" />
              </Group>
            ))}
          </Stack>
        </Box>
      </Stack>
    );
  }

  if (!stats) {
    return (
      <Box>
        <Text c="dimmed">No storage data available</Text>
      </Box>
    );
  }

  return (
    <Stack gap="lg">
      {/* Summary Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Box className="rounded border border-border bg-background p-4">
            <Group gap="sm" mb="xs">
              <HardDrive size={20} className="text-primary" />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Total Storage
              </Text>
            </Group>
            <Text size="xl" fw={700}>
              {formatBytes(stats.totalBytes)}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              {formatNumber(stats.pageCount)} pages
            </Text>
          </Box>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Box className="rounded border border-border bg-background p-4">
            <Group gap="sm" mb="xs">
              <Database size={20} className="text-blue-500" />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Offline Manga
              </Text>
            </Group>
            <Text size="xl" fw={700}>
              {formatNumber(stats.mangaCount)}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              {extensionStats.length} {extensionStats.length === 1 ? "extension" : "extensions"}
            </Text>
          </Box>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Box className="rounded border border-border bg-background p-4">
            <Group gap="sm" mb="xs">
              <FileText size={20} className="text-green-500" />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Total Chapters
              </Text>
            </Group>
            <Text size="xl" fw={700}>
              {formatNumber(stats.chapterCount)}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Avg: {stats.mangaCount > 0 ? Math.round(stats.chapterCount / stats.mangaCount) : 0} per manga
            </Text>
          </Box>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Box className="rounded border border-border bg-background p-4">
            <Group gap="sm" mb="xs">
              <Image size={20} className="text-purple-500" />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Average Size
              </Text>
            </Group>
            <Text size="xl" fw={700}>
              {stats.chapterCount > 0 ? formatBytes(Math.round(stats.totalBytes / stats.chapterCount)) : "0 B"}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Per chapter
            </Text>
          </Box>
        </Grid.Col>
      </Grid>

      {/* Extension Breakdown */}
      {extensionStats.length > 0 && (
        <Box>
          <Text size="md" fw={600} mb="md">
            Storage by Extension
          </Text>
          <Stack gap="sm">
            {extensionStats.map((ext) => (
              <Box key={ext.extensionId}>
                <Group justify="space-between" mb={4}>
                  <Text size="sm">{ext.extensionId}</Text>
                  <Badge size="sm" variant="light">
                    {ext.formatted}
                  </Badge>
                </Group>
                <Progress
                  value={ext.percentage}
                  size="sm"
                  radius="sm"
                  color="blue"
                />
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Top Manga by Size */}
      {topManga.length > 0 && (
        <Box>
          <Text size="md" fw={600} mb="md">
            Largest Manga
          </Text>
          <Stack gap="xs">
            {topManga.map((manga, index) => (
              <Box
                key={manga.mangaId}
                className="flex items-center justify-between rounded border border-border bg-background/50 p-3"
              >
                <Group gap="sm">
                  <Badge size="sm" variant="outline" circle>
                    {index + 1}
                  </Badge>
                  <div>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {manga.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {manga.chapterCount} {manga.chapterCount === 1 ? "chapter" : "chapters"}
                    </Text>
                  </div>
                </Group>
                <Text size="sm" fw={600} c="dimmed">
                  {formatBytes(manga.totalBytes)}
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

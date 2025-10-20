"use client";

import { useEffect } from "react";
import { useHistory } from "@/store/history";
import { Skeleton, Paper, Text, Title, Stack, Group } from "@mantine/core";
import { BookOpen, Library, TrendingUp, Star } from "lucide-react";
import Link from "next/link";

export default function HistoryStatsPage() {
  const { stats, loadStats, isLoading, error } = useHistory();

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Reading Statistics</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive font-medium">
            Failed to load statistics
          </p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reading Statistics</h1>
        <p className="text-muted-foreground mt-1">
          Track your reading habits and progress
        </p>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Paper key={i} p="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Skeleton height={16} width={96} />
                <Skeleton height={16} width={16} />
              </Group>
              <Skeleton height={32} width={64} mb="xs" />
              <Skeleton height={12} width={128} />
            </Paper>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Paper p="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Total Entries
              </Text>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </Group>
            <Text size="xl" fw={700}>
              {stats.totalEntries}
            </Text>
            <Text size="xs" c="dimmed">
              All recorded actions
            </Text>
          </Paper>

          <Paper p="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Chapters Read
              </Text>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </Group>
            <Text size="xl" fw={700}>
              {stats.chaptersRead}
            </Text>
            <Text size="xs" c="dimmed">
              Total reading sessions
            </Text>
          </Paper>

          <Paper p="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Manga Started
              </Text>
              <Star className="h-4 w-4 text-muted-foreground" />
            </Group>
            <Text size="xl" fw={700}>
              {stats.mangaStarted}
            </Text>
            <Text size="xs" c="dimmed">
              Unique titles read
            </Text>
          </Paper>

          <Paper p="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Library Additions
              </Text>
              <Library className="h-4 w-4 text-muted-foreground" />
            </Group>
            <Text size="xl" fw={700}>
              {stats.libraryAdditions}
            </Text>
            <Text size="xs" c="dimmed">
              Manga added to library
            </Text>
          </Paper>
        </div>
      ) : null}

      {/* Action Breakdown */}
      {!isLoading && stats && (
        <Paper p="md" withBorder>
          <Stack gap="md">
            <div>
              <Title order={3}>Activity Breakdown</Title>
              <Text size="sm" c="dimmed">
                Distribution of your actions
              </Text>
            </div>
            <Stack gap="md">
              {Object.entries(stats.actionCounts).map(([action, count]) => {
                const total = stats.totalEntries;
                const percentage =
                  total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={action} className="space-y-2">
                    <Group justify="space-between">
                      <Text size="sm" fw={500} tt="capitalize">
                        {action.replace(/_/g, " ")}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {count} ({percentage}%)
                      </Text>
                    </Group>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Most Read Manga */}
      {!isLoading && stats && stats.mostReadManga.length > 0 && (
        <Paper p="md" withBorder>
          <Stack gap="md">
            <div>
              <Title order={3}>Most Read Manga</Title>
              <Text size="sm" c="dimmed">
                Your top 10 most frequently read titles
              </Text>
            </div>
            <Stack gap="xs">
              {stats.mostReadManga.map((manga, index) => (
                <Group
                  key={manga.mangaId}
                  justify="space-between"
                  className="py-2 border-b last:border-0"
                >
                  <Group gap="md">
                    <Text size="xl" fw={700} c="dimmed" style={{ width: 32 }}>
                      {index + 1}
                    </Text>
                    <Link
                      href={`/manga/${manga.mangaId}`}
                      className="font-medium hover:underline"
                    >
                      {manga.title}
                    </Link>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {manga.count} {manga.count === 1 ? "chapter" : "chapters"}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}
    </div>
  );
}

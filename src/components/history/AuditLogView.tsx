import {
  Alert,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconBook,
  IconBookmark,
  IconClock,
  IconDownload,
  IconPuzzle,
  IconSettings,
} from "@tabler/icons-react";
import React, { useMemo } from "react";
import { useDownloadQueue } from "../../hooks/queries/useDownloadQueries";
import { useLibraryList } from "../../hooks/queries/useLibraryQueries";
import { useReadingActivity } from "../../hooks/queries/useReadingActivityQueries";
import { formatRelativeTime } from "../../lib/date";
import { EmptyState } from "../shared/EmptyState";
import { PageLoader } from "../shared/PageLoader";

type AuditEvent = {
  id: string;
  type:
    | "library_added"
    | "library_updated"
    | "reading"
    | "download"
    | "settings"
    | "extension";
  timestamp: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean>;
};

export const AuditLogView: React.FC = () => {
  const { data: libraryData, isLoading: libraryLoading } = useLibraryList();
  const { data: downloadData, isLoading: downloadLoading } = useDownloadQueue();
  const { data: readingData, isLoading: readingLoading } = useReadingActivity();

  const isLoading = libraryLoading || downloadLoading || readingLoading;

  // Aggregate all events from different sources
  const auditEvents: AuditEvent[] = useMemo(() => {
    const events: AuditEvent[] = [];

    // Library additions
    if (libraryData?.items) {
      libraryData.items.forEach((item) => {
        events.push({
          id: `library-added-${item.id}`,
          type: "library_added",
          timestamp: item.dateAdded,
          title: "Added to Library",
          description: item.title,
          metadata: {
            status: item.status,
            favorite: item.favorite,
          },
        });

        // Library updates (if lastUpdated is different from dateAdded)
        if (item.lastUpdated !== item.dateAdded) {
          events.push({
            id: `library-updated-${item.id}-${item.lastUpdated}`,
            type: "library_updated",
            timestamp: item.lastUpdated,
            title: "Library Item Updated",
            description: item.title,
            metadata: {
              status: item.status,
              favorite: item.favorite,
            },
          });
        }
      });
    }

    // Reading activity
    if (readingData) {
      readingData.forEach((activity) => {
        events.push({
          id: `reading-${activity.progress.id}`,
          type: "reading",
          timestamp: activity.progress.lastRead,
          title: "Reading Progress",
          description: `${activity.libraryItem.title} - Chapter ${activity.progress.chapterNumber || "?"}`,
          metadata: {
            page: activity.progress.pageNumber,
            totalPages: activity.progress.totalPages || 0,
            completed: activity.progress.completed,
          },
        });
      });
    }

    // Downloads
    if (downloadData?.downloads) {
      downloadData.downloads.forEach((download) => {
        events.push({
          id: `download-${download.id}`,
          type: "download",
          timestamp: download.createdAt,
          title: `Download ${download.status}`,
          description: `${downloadData.downloads.length} chapter(s)`,
          metadata: {
            status: download.status,
            progress: download.progress,
          },
        });
      });
    }

    // Sort by timestamp (most recent first)
    return events.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [libraryData, downloadData, readingData]);

  if (isLoading) {
    return <PageLoader message="Loading audit log..." />;
  }

  if (auditEvents.length === 0) {
    return (
      <EmptyState
        icon={<IconClock size={48} className="text-gray-400" />}
        title="No activity recorded yet"
        description="Your app activity will appear here"
      />
    );
  }

  const getEventIcon = (type: AuditEvent["type"]) => {
    switch (type) {
      case "library_added":
      case "library_updated":
        return <IconBookmark size={16} />;
      case "reading":
        return <IconBook size={16} />;
      case "download":
        return <IconDownload size={16} />;
      case "settings":
        return <IconSettings size={16} />;
      case "extension":
        return <IconPuzzle size={16} />;
      default:
        return <IconAlertCircle size={16} />;
    }
  };

  const getEventColor = (type: AuditEvent["type"]) => {
    switch (type) {
      case "library_added":
        return "green";
      case "library_updated":
        return "blue";
      case "reading":
        return "violet";
      case "download":
        return "cyan";
      case "settings":
        return "gray";
      case "extension":
        return "orange";
      default:
        return "gray";
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="lg" fw={600}>
          Audit Log
        </Text>
        <Badge variant="light" size="lg">
          {auditEvents.length} {auditEvents.length === 1 ? "event" : "events"}
        </Badge>
      </Group>

      <Card padding="md" radius="md" withBorder>
        <Timeline
          active={auditEvents.length}
          bulletSize={32}
          lineWidth={2}
          color="gray"
        >
          {auditEvents.map((event) => (
            <Timeline.Item
              key={event.id}
              bullet={
                <ThemeIcon
                  size={32}
                  variant="light"
                  radius="xl"
                  color={getEventColor(event.type)}
                >
                  {getEventIcon(event.type)}
                </ThemeIcon>
              }
            >
              <Group justify="space-between" wrap="nowrap" mb="xs">
                <Text size="sm" fw={600}>
                  {event.title}
                </Text>
                <Text size="xs" c="dimmed" className="shrink-0">
                  {formatRelativeTime(event.timestamp)}
                </Text>
              </Group>

              <Text size="sm" c="dimmed" mb="xs">
                {event.description}
              </Text>

              {event.metadata && (
                <Group gap="xs" wrap="wrap">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <Badge key={key} variant="dot" size="xs" color="gray">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </Group>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Future Enhancement"
        color="blue"
        variant="light"
      >
        This audit log aggregates events from multiple sources. A dedicated
        backend endpoint for comprehensive activity tracking (settings updates,
        extension installs, etc.) is planned for future releases.
      </Alert>
    </Stack>
  );
};

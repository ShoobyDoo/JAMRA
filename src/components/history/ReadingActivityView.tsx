import React from "react";
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Badge,
  Image,
  Progress,
  ActionIcon,
} from "@mantine/core";
import { IconBook, IconPlayerPlay } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { useRecentReadingActivity } from "../../hooks/queries/useReadingActivityQueries";
import { formatRelativeTime } from "../../lib/date";
import { buildRoute, ROUTES } from "../../routes/routes.config";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { PageLoader } from "../shared/PageLoader";

export const ReadingActivityView: React.FC = () => {
  const navigate = useNavigate();
  const { data: activities, isLoading, isError, error } = useRecentReadingActivity({
    limit: 50,
  });

  if (isLoading) {
    return <PageLoader message="Loading reading activity..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Error loading reading activity"
        message={
          error instanceof Error ? error.message : "Failed to load reading activity"
        }
        className="mx-auto max-w-2xl"
      />
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        icon={<IconBook size={48} className="text-gray-400" />}
        title="No reading activity yet"
        description="Start reading some manga to see your history here"
        action={
          <Button variant="light" onClick={() => navigate(ROUTES.DISCOVER)}>
            Discover Manga
          </Button>
        }
      />
    );
  }

  const handleResume = (libraryId: string, chapterId: string) => {
    navigate(buildRoute.reader(libraryId, chapterId));
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="lg" fw={600}>
          Reading Activity
        </Text>
        <Badge variant="light" size="lg">
          {activities.length} {activities.length === 1 ? "entry" : "entries"}
        </Badge>
      </Group>

      <Stack gap="xs">
        {activities.map((activity, index) => {
          const { libraryItem, progress } = activity;
          const progressPercent = progress.totalPages
            ? Math.round((progress.pageNumber / progress.totalPages) * 100)
            : 0;

          return (
            <Card
              key={`${progress.id}-${index}`}
              padding="md"
              radius="md"
              withBorder
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleResume(libraryItem.id, progress.chapterId)}
            >
              <Group wrap="nowrap" gap="md">
                {/* Cover Image */}
                <div className="relative flex-shrink-0">
                  <Image
                    src={libraryItem.coverUrl || "/placeholder.png"}
                    alt={libraryItem.title}
                    width={80}
                    height={120}
                    radius="sm"
                    className="object-cover"
                    fallbackSrc="/placeholder.png"
                  />
                  {progress.completed && (
                    <Badge
                      size="xs"
                      variant="filled"
                      color="green"
                      className="absolute top-1 right-1"
                    >
                      ✓
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <Stack gap="xs" className="flex-1 min-w-0">
                  <Group justify="space-between" wrap="nowrap">
                    <Text
                      size="md"
                      fw={600}
                      lineClamp={1}
                      className="flex-1 min-w-0"
                    >
                      {libraryItem.title}
                    </Text>
                    <Text size="xs" c="dimmed" className="flex-shrink-0">
                      {formatRelativeTime(progress.lastRead)}
                    </Text>
                  </Group>

                  <Group gap="xs" wrap="wrap">
                    <Badge variant="light" size="sm">
                      Chapter {progress.chapterNumber || "?"}
                    </Badge>
                    <Badge variant="dot" size="sm" color="gray">
                      Page {progress.pageNumber}
                      {progress.totalPages && ` of ${progress.totalPages}`}
                    </Badge>
                    {libraryItem.status && (
                      <Badge
                        variant="outline"
                        size="sm"
                        color={
                          libraryItem.status === "reading"
                            ? "blue"
                            : libraryItem.status === "completed"
                              ? "green"
                              : "gray"
                        }
                      >
                        {libraryItem.status.replace("_", " ")}
                      </Badge>
                    )}
                  </Group>

                  {/* Progress Bar */}
                  {progress.totalPages && (
                    <Stack gap={4}>
                      <Progress
                        value={progressPercent}
                        size="sm"
                        radius="xl"
                        color={progress.completed ? "green" : "blue"}
                      />
                      <Text size="xs" c="dimmed">
                        {progressPercent}% complete
                      </Text>
                    </Stack>
                  )}
                </Stack>

                {/* Action Button */}
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="blue"
                  aria-label="Resume reading"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResume(libraryItem.id, progress.chapterId);
                  }}
                >
                  <IconPlayerPlay size={20} />
                </ActionIcon>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
};

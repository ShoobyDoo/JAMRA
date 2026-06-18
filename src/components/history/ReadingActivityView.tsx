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
          // Clamp the displayed page number so a stale/incremented backend
          // value (e.g. pageNumber bumped past the last page on completion)
          // never renders as "PAGE 51 OF 50".
          const clampedPageNumber = progress.totalPages
            ? Math.min(progress.pageNumber, progress.totalPages)
            : progress.pageNumber;
          // Clamp percent to 100 and force exactly 100 when complete, since
          // the raw ratio can exceed 100% for the same reason as above.
          const progressPercent = progress.totalPages
            ? progress.completed
              ? 100
              : Math.min(
                  100,
                  Math.round((progress.pageNumber / progress.totalPages) * 100),
                )
            : 0;

          return (
            <Card
              key={`${progress.id}-${index}`}
              padding="xs"
              radius="md"
              withBorder
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleResume(libraryItem.id, progress.chapterId)}
            >
              <Group wrap="nowrap" gap="sm">
                {/* Cover Image */}
                <div className="relative flex-shrink-0">
                  <Image
                    src={libraryItem.coverUrl || "/placeholder.png"}
                    alt={libraryItem.title}
                    width={56}
                    height={80}
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
                <Stack gap={4} className="flex-1 min-w-0">
                  <Group justify="space-between" wrap="nowrap">
                    <Text
                      size="sm"
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
                      Page {clampedPageNumber}
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
                    <Stack gap={2}>
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
                  size="md"
                  variant="light"
                  color="blue"
                  aria-label="Resume reading"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResume(libraryItem.id, progress.chapterId);
                  }}
                >
                  <IconPlayerPlay size={18} />
                </ActionIcon>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
};

import {
  AspectRatio,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Menu,
  Paper,
  Spoiler,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowsSort,
  IconBook,
  IconBookmark,
  IconChevronDown,
  IconDownload,
  IconPlayerPlay,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ErrorState } from "../components/shared/ErrorState";
import { PageLoader } from "../components/shared/PageLoader";
import {
  useExtensionChapters,
  useExtensionManga,
} from "../hooks/queries/useExtensionsQueries";
import {
  useAddToLibrary,
  useLibraryList,
  useRemoveFromLibrary,
  useUpdateLibraryItem,
} from "../hooks/queries/useLibraryQueries";
import { useStartDownload } from "../hooks/queries/useDownloadQueries";
import { buildRoute } from "../routes/routes.config";
import type { LibraryStatus } from "../types";

const STATUS_LABELS: Record<LibraryStatus, string> = {
  reading: "Reading",
  plan_to_read: "Plan to Read",
  completed: "Completed",
  dropped: "Dropped",
  on_hold: "On Hold",
};

const STATUS_OPTIONS: LibraryStatus[] = [
  "reading",
  "plan_to_read",
  "completed",
  "on_hold",
  "dropped",
];

export const MangaDetailsPage: React.FC = () => {
  const { extensionId, mangaId } = useParams<{
    extensionId: string;
    mangaId: string;
  }>();
  const navigate = useNavigate();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: mangaData, isLoading: isLoadingManga } = useExtensionManga(
    extensionId,
    mangaId,
  );
  const { data: chaptersData, isLoading: isLoadingChapters } =
    useExtensionChapters(extensionId, mangaId);
  const { data: libraryData } = useLibraryList();
  const addToLibrary = useAddToLibrary();
  const startDownload = useStartDownload();

  const manga = mangaData?.manga;
  const chapters = useMemo(
    () => chaptersData?.chapters || [],
    [chaptersData],
  );

  const libraryItem = libraryData?.items?.find(
    (item) => item.mangaId === mangaId && item.extensionId === extensionId,
  );

  const isInLibrary = Boolean(libraryItem);
  const removeFromLibrary = useRemoveFromLibrary(libraryItem?.id ?? "");
  const updateLibraryItem = useUpdateLibraryItem(libraryItem?.id ?? "");

  // Single source of truth for chapter order, shared by the table and the
  // Start/Continue Reading button so they can never disagree.
  const sortedChapters = useMemo(() => {
    const withOrder = [...chapters].sort((a, b) => {
      const aNum = a.chapterNumber !== undefined ? Number(a.chapterNumber) : NaN;
      const bNum = b.chapterNumber !== undefined ? Number(b.chapterNumber) : NaN;
      if (isNaN(aNum) && isNaN(bNum)) return 0;
      if (isNaN(aNum)) return 1;
      if (isNaN(bNum)) return -1;
      return aNum - bNum;
    });

    return sortDirection === "asc" ? withOrder : withOrder.reverse();
  }, [chapters, sortDirection]);

  const firstChapterToRead = useMemo(() => {
    if (sortedChapters.length === 0) return undefined;
    // "Start/Continue Reading" should always open the earliest chapter,
    // regardless of which direction the table is currently sorted.
    return sortDirection === "asc"
      ? sortedChapters[0]
      : sortedChapters[sortedChapters.length - 1];
  }, [sortedChapters, sortDirection]);

  const handleAddToLibrary = () => {
    if (!manga || !extensionId) {
      return;
    }

    addToLibrary.mutate(
      {
        mangaId: manga.id,
        extensionId,
        title: manga.title,
        status: "plan_to_read",
        coverUrl: manga.coverUrl,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Added to Library",
            message: `${manga.title} has been added to your library`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Failed to Add",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  };

  const handleRemoveFromLibrary = () => {
    if (!libraryItem || !manga) {
      return;
    }

    removeFromLibrary.mutate(undefined, {
      onSuccess: () => {
        notifications.show({
          title: "Removed from Library",
          message: `${manga.title} has been removed from your library`,
          color: "blue",
        });
      },
      onError: (error) => {
        notifications.show({
          title: "Failed to Remove",
          message: error instanceof Error ? error.message : "Unknown error",
          color: "red",
        });
      },
    });
  };

  const handleChangeStatus = (status: LibraryStatus) => {
    if (!libraryItem || status === libraryItem.status) {
      return;
    }

    updateLibraryItem.mutate(
      { status },
      {
        onSuccess: () => {
          notifications.show({
            title: "Status Updated",
            message: `Marked as ${STATUS_LABELS[status]}`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Failed to Update Status",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  };

  const handleStartReading = () => {
    if (!libraryItem || !firstChapterToRead) {
      return;
    }

    navigate(buildRoute.reader(libraryItem.id, firstChapterToRead.id));
  };

  const handleReadChapter = (chapterId: string) => {
    if (!libraryItem) {
      notifications.show({
        title: "Add to Library",
        message:
          "Add this manga to your library to unlock the reader and track progress.",
        color: "yellow",
      });
      return;
    }

    navigate(buildRoute.reader(libraryItem.id, chapterId));
  };

  const handleToggleSortDirection = () => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  };

  const handleDownloadAll = () => {
    if (!libraryItem || !extensionId || sortedChapters.length === 0) {
      return;
    }

    startDownload.mutate(
      {
        libraryId: libraryItem.id,
        extensionId,
        chapterIds: sortedChapters.map((chapter) => chapter.id),
        chapterNumbers: Object.fromEntries(
          sortedChapters
            .filter((chapter) => chapter.chapterNumber !== undefined)
            .map((chapter) => [chapter.id, String(chapter.chapterNumber)]),
        ),
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Download Queued",
            message: `${sortedChapters.length} chapter(s) queued for download`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Failed to Queue Download",
            message: error instanceof Error ? error.message : "Unknown error",
            color: "red",
          });
        },
      },
    );
  };

  if (isLoadingManga) {
    return <PageLoader />;
  }

  if (!manga) {
    return (
      <div className="mx-auto max-w-6xl px-4">
        <ErrorState
          title="Manga Not Found"
          message="Unable to load manga details. Please try again."
        />
      </div>
    );
  }

  const currentStatusLabel = libraryItem
    ? STATUS_LABELS[libraryItem.status]
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-8 grid gap-8 md:grid-cols-[300px_1fr]">
        <div>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section>
              <AspectRatio ratio={3 / 4}>
                {manga.coverUrl ? (
                  <Image src={manga.coverUrl} alt={manga.title} fit="cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--mantine-color-gray-1)]">
                    <IconBook
                      size={64}
                      style={{ color: "var(--mantine-color-gray-5)" }}
                    />
                  </div>
                )}
              </AspectRatio>
            </Card.Section>

            <div className="mt-4 flex flex-col gap-3">
              {isInLibrary ? (
                <>
                  <Button
                    leftSection={<IconPlayerPlay size={18} />}
                    fullWidth
                    size="md"
                    onClick={handleStartReading}
                    disabled={!firstChapterToRead}
                  >
                    Start Reading
                  </Button>

                  <Menu shadow="md" width="target" position="bottom">
                    <Menu.Target>
                      <Button
                        variant="light"
                        color="green"
                        fullWidth
                        rightSection={<IconChevronDown size={16} />}
                      >
                        {currentStatusLabel ?? "In Library"}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Reading Status</Menu.Label>
                      {STATUS_OPTIONS.map((status) => (
                        <Menu.Item
                          key={status}
                          onClick={() => handleChangeStatus(status)}
                          disabled={
                            updateLibraryItem.isPending ||
                            status === libraryItem?.status
                          }
                          fw={status === libraryItem?.status ? 700 : 400}
                        >
                          {STATUS_LABELS[status]}
                        </Menu.Item>
                      ))}
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={handleRemoveFromLibrary}
                        disabled={removeFromLibrary.isPending}
                      >
                        Remove from Library
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>

                  <Button
                    variant="outline"
                    leftSection={<IconDownload size={18} />}
                    fullWidth
                    onClick={handleDownloadAll}
                    loading={startDownload.isPending}
                    disabled={sortedChapters.length === 0}
                  >
                    Download All
                  </Button>
                </>
              ) : (
                <Button
                  leftSection={<IconBookmark size={18} />}
                  fullWidth
                  size="md"
                  onClick={handleAddToLibrary}
                  loading={addToLibrary.isPending}
                >
                  Add to Library
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Title order={1} className="mb-4">
            {manga.title}
          </Title>

          {(manga.authors?.length || manga.status) && (
            <Group gap="lg" className="mb-4">
              {manga.authors && manga.authors.length > 0 && (
                <Text size="sm" c="dimmed">
                  <Text span fw={600} c="var(--mantine-color-text)">
                    Author:
                  </Text>{" "}
                  {manga.authors.join(", ")}
                </Text>
              )}
              {manga.status && (
                <Text size="sm" c="dimmed">
                  <Text span fw={600} c="var(--mantine-color-text)">
                    Status:
                  </Text>{" "}
                  {manga.status.charAt(0).toUpperCase() +
                    manga.status.slice(1)}
                </Text>
              )}
            </Group>
          )}

          {manga.tags && manga.tags.length > 0 && (
            <Group gap="xs" className="mb-4">
              {manga.tags.map((tag) => (
                <Badge key={tag} variant="light" size="md">
                  {tag}
                </Badge>
              ))}
            </Group>
          )}

          {manga.description && (
            <Paper shadow="xs" p="md" radius="md" className="mb-6">
              <Title order={4} className="mb-2">
                Description
              </Title>
              <Spoiler
                maxHeight={120}
                showLabel="Show more"
                hideLabel="Show less"
              >
                <Text c="dimmed">{manga.description}</Text>
              </Spoiler>
            </Paper>
          )}

          <Paper shadow="xs" p="md" radius="md">
            <div className="mb-4 flex items-center justify-between">
              <Title order={4}>
                Chapters ({chapters.length})
              </Title>
              <Group gap="sm">
                {isLoadingChapters && <Loader size="sm" />}
                <Tooltip
                  label={
                    sortDirection === "asc"
                      ? "Sorted ascending — click to reverse"
                      : "Sorted descending — click to reverse"
                  }
                >
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={
                      sortDirection === "asc" ? (
                        <IconSortAscending size={16} />
                      ) : (
                        <IconSortDescending size={16} />
                      )
                    }
                    rightSection={<IconArrowsSort size={14} />}
                    onClick={handleToggleSortDirection}
                  >
                    {sortDirection === "asc" ? "Oldest first" : "Newest first"}
                  </Button>
                </Tooltip>
              </Group>
            </div>

            {sortedChapters.length === 0 ? (
              <Text c="dimmed">No chapters available</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Chapter</Table.Th>
                    <Table.Th>Title</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedChapters.map((chapter) => (
                    <Table.Tr
                      key={chapter.id}
                      onClick={() => handleReadChapter(chapter.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Read chapter ${chapter.chapterNumber || chapter.id}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleReadChapter(chapter.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Table.Td>
                        {chapter.chapterNumber || "Unknown"}
                      </Table.Td>
                      <Table.Td>{chapter.title || "Untitled"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            {!isInLibrary && chapters.length > 0 && (
              <Text size="sm" c="dimmed" mt="sm">
                Add this manga to your library to load chapters in the reader
                and keep your progress synced.
              </Text>
            )}
          </Paper>
        </div>
      </div>
    </div>
  );
};

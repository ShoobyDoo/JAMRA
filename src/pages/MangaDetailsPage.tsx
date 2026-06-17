import {
  ActionIcon,
  AspectRatio,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Paper,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconBook,
  IconBookmark,
  IconBookmarkFilled,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import React from "react";
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
} from "../hooks/queries/useLibraryQueries";
import { buildRoute } from "../routes/routes.config";

export const MangaDetailsPage: React.FC = () => {
  const { extensionId, mangaId } = useParams<{
    extensionId: string;
    mangaId: string;
  }>();
  const navigate = useNavigate();

  const { data: mangaData, isLoading: isLoadingManga } = useExtensionManga(
    extensionId,
    mangaId,
  );
  const { data: chaptersData, isLoading: isLoadingChapters } =
    useExtensionChapters(extensionId, mangaId);
  const { data: libraryData } = useLibraryList();
  const addToLibrary = useAddToLibrary();

  const manga = mangaData?.manga;
  const chapters = chaptersData?.chapters || [];

  const libraryItem = libraryData?.items?.find(
    (item) => item.mangaId === mangaId && item.extensionId === extensionId,
  );

  const isInLibrary = Boolean(libraryItem);

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

  const handleStartReading = () => {
    if (!libraryItem || chapters.length === 0) {
      return;
    }

    const firstChapter = [...chapters].sort((a, b) => {
      const aNum = a.chapterNumber !== undefined ? Number(a.chapterNumber) : NaN;
      const bNum = b.chapterNumber !== undefined ? Number(b.chapterNumber) : NaN;
      if (isNaN(aNum)) return 1;
      if (isNaN(bNum)) return -1;
      return aNum - bNum;
    })[0];
    navigate(buildRoute.reader(libraryItem.id, firstChapter.id));
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
                  <div className="flex h-full w-full items-center justify-center bg-gray-100">
                    <IconBook size={64} className="text-gray-400" />
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
                    disabled={chapters.length === 0}
                  >
                    Start Reading
                  </Button>
                  <Badge
                    size="lg"
                    variant="light"
                    color="green"
                    leftSection={<IconBookmarkFilled size={14} />}
                    className="w-full justify-center"
                  >
                    In Library
                  </Badge>
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
              <Text className="text-gray-700">{manga.description}</Text>
            </Paper>
          )}

          <Paper shadow="xs" p="md" radius="md">
            <div className="mb-4 flex items-center justify-between">
              <Title order={4}>
                Chapters ({chapters.length})
              </Title>
              {isLoadingChapters && <Loader size="sm" />}
            </div>

            {chapters.length === 0 ? (
              <Text c="dimmed">No chapters available</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Chapter</Table.Th>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Language</Table.Th>
                    <Table.Th className="text-right">Read</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {chapters.map((chapter) => (
                    <Table.Tr key={chapter.id}>
                      <Table.Td>
                        {chapter.chapterNumber || "Unknown"}
                      </Table.Td>
                      <Table.Td>{chapter.title || "Untitled"}</Table.Td>
                      <Table.Td>
                        {chapter.translatedLanguage || "N/A"}
                      </Table.Td>
                      <Table.Td className="text-right">
                        <ActionIcon
                          variant={isInLibrary ? "filled" : "light"}
                          color={isInLibrary ? "blue" : "gray"}
                          size="md"
                          aria-label={`Read chapter ${chapter.chapterNumber || chapter.id}`}
                          onClick={() => handleReadChapter(chapter.id)}
                        >
                          <IconPlayerPlay size={18} />
                        </ActionIcon>
                      </Table.Td>
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

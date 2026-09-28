import { Alert, Loader, Paper, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import React from "react";
import { useParams } from "react-router";
import { apiClient } from "../api/client";
import { MangaReader } from "../components/reader/manga-reader";
import { API_PATHS } from "../constants/api";
import type { LibraryItem } from "../types";

export const ReaderPage: React.FC = () => {
  const { libraryId, chapterId } = useParams<{
    libraryId: string;
    chapterId: string;
  }>();

  const [libraryItem, setLibraryItem] = React.useState<LibraryItem | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!libraryId) return;

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    apiClient
      .get<LibraryItem>(API_PATHS.libraryItem(libraryId), {
        signal: controller.signal,
      })
      .then((item) => {
        if (!isMounted) return;
        setLibraryItem(item);
      })
      .catch((err) => {
        if (!isMounted || controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Unable to load library item",
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [libraryId]);

  if (!libraryId || !chapterId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Missing context"
          color="red"
        >
          Reader routes require both a library id and chapter id. Use the
          library or manga details page to choose a chapter and try again.
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Paper
          radius="lg"
          p="lg"
          className="flex items-center justify-center gap-3 bg-transparent"
        >
          <Loader color="white" />
          <Text c="white">Loading reader...</Text>
        </Paper>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Unable to open reader"
          color="red"
        >
          {error}
        </Alert>
      </div>
    );
  }

  const mangaTitle = libraryItem?.title ?? "Unknown Manga";

  return (
    <MangaReader
      libraryId={libraryId}
      mangaTitle={mangaTitle}
      chapterId={chapterId}
    />
  );
};

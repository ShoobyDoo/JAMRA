import { Anchor, Progress, Text, Title } from "@mantine/core";
import { IconBook } from "@tabler/icons-react";
import React from "react";
import { useNavigate } from "react-router";
import { EmptyState } from "../components/shared/EmptyState";
import { ErrorState } from "../components/shared/ErrorState";
import { MangaCardGrid } from "../components/shared/MangaCardGrid";
import { PageLoader } from "../components/shared/PageLoader";
import { UnifiedMangaCard } from "../components/shared/UnifiedMangaCard";
import { useContinueReadingEntries } from "../hooks/queries/useHomeQueries";
import { formatRelativeTime } from "../lib/date";
import type { ContinueReadingEntry } from "../types";
import { buildRoute, ROUTES } from "../routes/routes.config";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data: continueReadingEntries,
    isPending,
    isError,
    error,
    refetch,
  } = useContinueReadingEntries();

  const handleViewAllContinueReading = () => {
    navigate(ROUTES.LIBRARY);
  };

  const handleContinueReading = (entry: ContinueReadingEntry) => {
    navigate(buildRoute.reader(entry.libraryId, entry.chapterId));
  };

  const handleOpenMangaDetails = (entry: ContinueReadingEntry) => {
    navigate(buildRoute.mangaDetails(entry.extensionId, entry.mangaId));
  };

  const hasEntries = (continueReadingEntries?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full">
      {/* Continue Reading Section */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between">
          <Title order={2}>Continue Reading</Title>
          <Anchor
            component="button"
            onClick={handleViewAllContinueReading}
            c="brand"
            className="hover:underline"
          >
            View All
          </Anchor>
        </div>

        {isError && (
          <ErrorState
            title="Unable to load progress"
            message={error instanceof Error ? error.message : "Unexpected error"}
            onRetry={() => refetch()}
            className="mb-4"
          />
        )}

        {isPending ? (
          <PageLoader message="Loading your progress..." />
        ) : hasEntries ? (
          <MangaCardGrid>
            {continueReadingEntries?.map((entry) => {
              const progressLabel =
                entry.totalPages
                  ? `${entry.pageNumber}/${entry.totalPages}`
                  : "Resume";
              const relativeUpdatedAt = formatRelativeTime(
                entry.lastReadAt ?? entry.updatedAt,
              );

              return (
                <UnifiedMangaCard
                  key={entry.libraryId}
                  id={entry.mangaId}
                  extensionId={entry.extensionId}
                  title={entry.title}
                  coverUrl={entry.coverUrl}
                  onCardClick={() => handleContinueReading(entry)}
                  onDetailsClick={() => handleOpenMangaDetails(entry)}
                  footerContent={
                    <>
                      <Text
                        size="xs"
                        c="white"
                        fw={500}
                        className="mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                      >
                        {entry.chapterNumber
                          ? `Chapter ${entry.chapterNumber}`
                          : "Resume"}
                      </Text>
                      <div className="mb-2 flex items-center justify-between text-xs tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        <span>Progress</span>
                        <span>{progressLabel}</span>
                      </div>
                      <Progress
                        value={entry.progressPercent ?? 0}
                        size="sm"
                        radius="xl"
                        color="blue"
                      />
                      <div className="mt-2 text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        Updated {relativeUpdatedAt}
                      </div>
                    </>
                  }
                />
              );
            })}
          </MangaCardGrid>
        ) : (
          <EmptyState
            icon={<IconBook size={28} style={{ color: "var(--mantine-color-dimmed)" }} />}
            title="No recent progress"
            description="Start reading any manga to see it appear here."
          />
        )}
      </section>
    </div>
  );
};

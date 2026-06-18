import { Button, Group, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconAlertCircle, IconSearch } from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { useExtensionSearchInfinite } from "../../hooks/queries/useExtensionsQueries";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { MangaCardGrid } from "../shared/MangaCardGrid";
import { PageLoader } from "../shared/PageLoader";
import { UnifiedMangaCard } from "../shared/UnifiedMangaCard";

interface ExtensionBrowsePanelProps {
  extensionId: string;
  extensionName: string;
  showExtensionBadge?: boolean;
  /** When provided, the panel's own search input is hidden and this query drives the search instead. */
  externalQuery?: string;
}

export const ExtensionBrowsePanel: React.FC<ExtensionBrowsePanelProps> = ({
  extensionId,
  extensionName,
  showExtensionBadge = false,
  externalQuery,
}) => {
  const isControlled = externalQuery !== undefined;
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(
    isControlled ? externalQuery : query,
    350,
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useExtensionSearchInfinite(extensionId, { query: debouncedQuery });

  const results = data?.pages.flatMap((page) => page.results) ?? [];

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleLoadMore = () => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  };

  return (
    <div>
      {!isControlled && (
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={`Search ${extensionName}`}
          radius="md"
          size="md"
          leftSection={<IconSearch size={18} />}
          className="mb-6"
          aria-label={`Search ${extensionName}`}
        />
      )}

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Failed to load results."
          }
          onRetry={() => refetch()}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<IconAlertCircle size={28} />}
          title={
            debouncedQuery
              ? `No results found for "${debouncedQuery}"`
              : "No browse results available"
          }
          description={
            debouncedQuery
              ? undefined
              : "This extension may not support browsing without a search query. Try searching for something."
          }
        />
      ) : (
        <>
          <MangaCardGrid>
            {results.map((manga) => (
              <UnifiedMangaCard
                key={manga.id}
                id={manga.id}
                extensionId={extensionId}
                title={manga.title}
                coverUrl={manga.coverUrl}
                status={manga.status}
                extensionName={showExtensionBadge ? extensionName : undefined}
              />
            ))}
          </MangaCardGrid>

          <div ref={sentinelRef} />

          <Group justify="center" className="mt-6">
            {isFetchingNextPage ? (
              <Text size="sm" c="dimmed">
                Loading more...
              </Text>
            ) : hasNextPage ? (
              <Button variant="light" onClick={handleLoadMore}>
                Load more
              </Button>
            ) : results.length > 0 ? (
              <Text size="sm" c="dimmed">
                No more results
              </Text>
            ) : null}
          </Group>
        </>
      )}
    </div>
  );
};

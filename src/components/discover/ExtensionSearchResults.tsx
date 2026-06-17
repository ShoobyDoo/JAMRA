import { Text, Title } from "@mantine/core";
import React from "react";
import { useExtensionSearch } from "../../hooks/queries/useExtensionsQueries";
import type { ExtensionSearchResult } from "../../types";
import { MangaCardGrid } from "../shared/MangaCardGrid";
import { PageLoader } from "../shared/PageLoader";
import { UnifiedMangaCard } from "../shared/UnifiedMangaCard";

interface ExtensionSearchResultsProps {
  extensionId: string;
  extensionName: string;
  searchQuery: string;
  limit?: number;
  showHeader?: boolean;
}

export const ExtensionSearchResults: React.FC<ExtensionSearchResultsProps> = ({
  extensionId,
  extensionName,
  searchQuery,
  limit,
  showHeader = true,
}) => {
  const { data, isLoading } = useExtensionSearch(extensionId, {
    query: searchQuery,
  });

  const results = limit ? (data?.results || []).slice(0, limit) : data?.results || [];

  if (isLoading) {
    return showHeader ? (
      <div>
        <Title order={3} className="mb-4">
          {extensionName}
        </Title>
        <PageLoader />
      </div>
    ) : (
      <PageLoader />
    );
  }

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div>
      {showHeader && (
        <div className="mb-4 flex items-center justify-between">
          <Title order={3}>
            {extensionName}
            <Text span size="sm" c="dimmed" className="ml-2">
              ({results.length} results)
            </Text>
          </Title>
        </div>
      )}
      <MangaCardGrid>
        {results.map((manga: ExtensionSearchResult) => (
          <UnifiedMangaCard
            key={manga.id}
            id={manga.id}
            extensionId={extensionId}
            title={manga.title}
            coverUrl={manga.coverUrl}
            extensionName={showHeader ? undefined : extensionName}
            status={manga.status}
          />
        ))}
      </MangaCardGrid>
    </div>
  );
};

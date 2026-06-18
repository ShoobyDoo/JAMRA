import { Text } from "@mantine/core";
import React from "react";
import type { ExtensionSearchResult } from "../../types";
import { MangaCardGrid } from "../shared/MangaCardGrid";
import { UnifiedMangaCard } from "../shared/UnifiedMangaCard";

interface MangaGridProps {
  results: ExtensionSearchResult[];
  extensionId: string;
  extensionName?: string;
  onSelect?: (result: ExtensionSearchResult) => void;
}

export const MangaGrid: React.FC<MangaGridProps> = ({
  results,
  extensionId,
  extensionName,
  onSelect,
}) => {
  if (results.length === 0) {
    return <Text c="dimmed">No manga found</Text>;
  }

  return (
    <MangaCardGrid>
      {results.map((result) => (
        <UnifiedMangaCard
          key={`${extensionId}-${result.id}`}
          id={result.id}
          extensionId={extensionId}
          title={result.title}
          coverUrl={result.coverUrl}
          extensionName={extensionName}
          status={result.status}
          onDetailsClick={onSelect ? () => onSelect(result) : undefined}
          onCardClick={onSelect ? () => onSelect(result) : undefined}
        />
      ))}
    </MangaCardGrid>
  );
};

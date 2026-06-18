import React from "react";
import type { LibraryItem } from "../../types";
import { EmptyState } from "../shared/EmptyState";
import { MangaCardGrid } from "../shared/MangaCardGrid";
import { PageLoader } from "../shared/PageLoader";
import { LibraryCard } from "./LibraryCard";

interface LibraryGridProps {
  items: LibraryItem[];
  isLoading?: boolean;
}

export const LibraryGrid: React.FC<LibraryGridProps> = ({
  items,
  isLoading,
}) => {
  if (isLoading) {
    return <PageLoader />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your library is empty"
        description="Start adding manga from the Discover page"
      />
    );
  }

  return (
    <MangaCardGrid>
      {items.map((item) => (
        <LibraryCard key={item.id} item={item} />
      ))}
    </MangaCardGrid>
  );
};

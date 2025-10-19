"use client";

import { useEffect, useState } from "react";
import { useLibrary } from "@/store/library";
import { LibraryGrid } from "@/components/library/library-grid";
import { LibraryFilterBar } from "@/components/library/library-filter-bar";
import type { LibraryStatus, LibrarySortOption } from "@/store/library";
import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryPage() {
  const {
    getSortedEntries,
    loadLibrary,
    loadStats,
    setFilters,
    setSortBy,
    filters,
    sortBy,
    sortOrder,
    isLoading,
    error,
  } = useLibrary();

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadLibrary();
    loadStats();
  }, [loadLibrary, loadStats]);

  const handleStatusChange = (status: LibraryStatus | undefined) => {
    setFilters({ status });
  };

  const handleFavoriteToggle = () => {
    setFilters({ favorite: filters.favorite ? undefined : true });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setFilters({ searchQuery: query || undefined });
  };

  const handleSortChange = (
    newSortBy: LibrarySortOption,
    order: "asc" | "desc",
  ) => {
    setSortBy(newSortBy, order);
  };

  const entries = getSortedEntries();

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive font-medium">Failed to load library</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Library</h1>
        <p className="text-muted-foreground mt-1">
          Track and organize your manga collection
        </p>
      </div>

      {/* Filters */}
      <LibraryFilterBar
        selectedStatus={filters.status}
        onStatusChange={handleStatusChange}
        favoriteOnly={filters.favorite ?? false}
        onFavoriteToggle={handleFavoriteToggle}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        totalCount={entries.length}
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <LibraryGrid
          entries={entries}
          emptyMessage={
            filters.status || filters.favorite || searchQuery
              ? "No manga found matching your filters"
              : "Your library is empty. Start adding manga from the discover page!"
          }
        />
      )}
    </div>
  );
}

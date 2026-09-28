import React, { useMemo, useState } from "react";
import {
  Button,
  Group,
  SegmentedControl,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconHeart, IconSearch, IconX } from "@tabler/icons-react";
import { LibraryGrid } from "../components/library/LibraryGrid";
import {
  useLibraryList,
  useLibraryStats,
} from "../hooks/queries/useLibraryQueries";
import {
  formatLibraryStatus,
  LIBRARY_STATUS_COLORS,
  LIBRARY_STATUS_ORDER,
  LIBRARY_STATUS_STATS_KEY,
} from "../constants/library";
import type { LibraryStatus } from "../types";

export const LibraryPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<LibraryStatus | null>(null);
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | undefined>(
    undefined,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Build filters object
  const filters = useMemo(
    () => ({
      ...(statusFilter && { status: statusFilter }),
      ...(favoriteFilter !== undefined && { favorite: favoriteFilter }),
      ...(searchQuery && { search: searchQuery }),
    }),
    [favoriteFilter, searchQuery, statusFilter],
  );

  const { data: libraryData, isLoading } = useLibraryList(filters);
  const { data: stats } = useLibraryStats();

  const handleClearFilters = () => {
    setStatusFilter(null);
    setFavoriteFilter(undefined);
    setSearchQuery("");
  };

  const hasActiveFilters =
    statusFilter !== null || favoriteFilter !== undefined || Boolean(searchQuery);

  const items = libraryData?.items || [];

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Title order={1} className="mb-2">
          Library
        </Title>
        {stats && (
          <Text size="sm" c="dimmed">
            {stats.total} manga in your library
          </Text>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Stats Summary */}
        {stats && (
          <Group gap="xs" className="mb-4 flex-wrap">
            <Button
              variant={statusFilter === null ? "filled" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              All ({stats.total})
            </Button>
            {LIBRARY_STATUS_ORDER.map((status) => {
              const statKey = LIBRARY_STATUS_STATS_KEY[status];
              const count = stats[statKey];
              return (
                <Button
                  key={status}
                  variant={statusFilter === status ? "filled" : "outline"}
                  size="sm"
                  color={LIBRARY_STATUS_COLORS[status]}
                  onClick={() =>
                    setStatusFilter(statusFilter === status ? null : status)
                  }
                >
                  {formatLibraryStatus(status)} ({count})
                </Button>
              );
            })}
          </Group>
        )}

        {/* Search and Filters Row */}
        <Group gap="md" className="flex-wrap">
          <TextInput
            placeholder="Search library..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            className="flex-1 min-w-[250px]"
          />

          <SegmentedControl
            value={favoriteFilter ? "favorites" : "all"}
            onChange={(value) =>
              setFavoriteFilter(value === "favorites" ? true : undefined)
            }
            data={[
              { label: "All", value: "all" },
              {
                label: (
                  <Group gap={4}>
                    <IconHeart size={14} />
                    <span>Favorites</span>
                  </Group>
                ),
                value: "favorites",
              },
            ]}
          />

          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconX size={16} />}
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </Group>
      </div>

      {/* Library Grid */}
      <LibraryGrid items={items} isLoading={isLoading} />
    </div>
  );
};

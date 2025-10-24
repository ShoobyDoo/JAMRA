"use client";

import { Search, Heart, SortAsc, SortDesc } from "lucide-react";
import { TextInput, Button, Badge, Select, ActionIcon, Group, Tooltip } from "@mantine/core";
import type { LibraryStatus } from "@/lib/api";
import type { LibrarySortOption } from "@/store/library";

interface LibraryFilterBarProps {
  selectedStatus?: LibraryStatus;
  onStatusChange: (status: LibraryStatus | undefined) => void;
  favoriteOnly: boolean;
  onFavoriteToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: LibrarySortOption;
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: LibrarySortOption, order: "asc" | "desc") => void;
  totalCount: number;
}

const STATUS_OPTIONS: { value: LibraryStatus; label: string }[] = [
  { value: "reading", label: "Reading" },
  { value: "plan_to_read", label: "Plan to Read" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "dropped", label: "Dropped" },
];

const SORT_OPTIONS: { value: LibrarySortOption; label: string }[] = [
  { value: "updated_at", label: "Last Updated" },
  { value: "added_at", label: "Date Added" },
  { value: "title", label: "Title" },
  { value: "rating", label: "Rating" },
  { value: "progress", label: "Progress" },
];

export function LibraryFilterBar({
  selectedStatus,
  onStatusChange,
  favoriteOnly,
  onFavoriteToggle,
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  totalCount,
}: LibraryFilterBarProps) {
  const toggleSortOrder = () => {
    onSortChange(sortBy, sortOrder === "asc" ? "desc" : "asc");
  };

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <Group gap="xs" wrap="wrap">
        <Button
          variant={selectedStatus === undefined ? "filled" : "outline"}
          size="sm"
          onClick={() => onStatusChange(undefined)}
        >
          All
          <Badge
            variant={selectedStatus === undefined ? "filled" : "light"}
            className="ml-2"
            style={selectedStatus === undefined ? { backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white' } : undefined}
          >
            {totalCount}
          </Badge>
        </Button>

        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedStatus === option.value ? "filled" : "outline"}
            size="sm"
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </Group>

      {/* Search, Sort, and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <TextInput
          placeholder="Search your library..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftSection={<Search className="h-4 w-4" />}
          className="flex-1"
        />

        {/* Sort */}
        <Group gap="xs">
          <Select
            value={sortBy}
            onChange={(value) =>
              onSortChange(value as LibrarySortOption, sortOrder)
            }
            placeholder="Sort by"
            data={SORT_OPTIONS}
            className="w-[180px]"
            checkIconPosition="right"
          />

          <ActionIcon variant="outline" size="lg" onClick={toggleSortOrder}>
            {sortOrder === "asc" ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </ActionIcon>

          <Tooltip label="Show favorites only" position="bottom" withArrow>
            <ActionIcon
              variant={favoriteOnly ? "filled" : "outline"}
              size="lg"
              onClick={onFavoriteToggle}
            >
              <Heart
                className={`h-4 w-4 ${favoriteOnly ? "fill-current" : ""}`}
              />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>
    </div>
  );
}

"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { TextInput, Select, Group } from "@mantine/core";
import type { HistoryActionType } from "@/lib/api";
import type { HistorySortOption } from "@/store/history";

interface HistoryFilterBarProps {
  actionType?: HistoryActionType;
  onActionTypeChange: (type: HistoryActionType | undefined) => void;
  dateRange?: { startDate?: number; endDate?: number };
  onDateRangeChange: (startDate?: number, endDate?: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: HistorySortOption;
  onSortChange: (sort: HistorySortOption) => void;
  totalCount: number;
}

export function HistoryFilterBar({
  actionType,
  onActionTypeChange,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCount,
}: HistoryFilterBarProps) {
  const handleQuickDateRange = (range: string | null) => {
    if (!range) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    switch (range) {
      case "today":
        onDateRangeChange(now - day, now);
        break;
      case "week":
        onDateRangeChange(now - 7 * day, now);
        break;
      case "month":
        onDateRangeChange(now - 30 * day, now);
        break;
      case "all":
        onDateRangeChange(undefined, undefined);
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <TextInput
          placeholder="Search manga or chapters..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftSection={<Search className="h-4 w-4" />}
          className="flex-1"
        />

        {/* Action Type Filter */}
        <Select
          value={actionType ?? "all"}
          onChange={(value) =>
            onActionTypeChange(
              value === "all" ? undefined : (value as HistoryActionType),
            )
          }
          placeholder="All Actions"
          data={[
            { value: "all", label: "All Actions" },
            { value: "read", label: "Read" },
            { value: "library_add", label: "Added to Library" },
            { value: "library_remove", label: "Removed from Library" },
            { value: "favorite", label: "Favorited" },
          ]}
          className="w-full sm:w-[180px]"
          checkIconPosition="right"
        />

        {/* Date Range Filter */}
        <Select
          value={
            !dateRange?.startDate
              ? "all"
              : dateRange.startDate > Date.now() - 24 * 60 * 60 * 1000
                ? "today"
                : dateRange.startDate > Date.now() - 7 * 24 * 60 * 60 * 1000
                  ? "week"
                  : "month"
          }
          onChange={handleQuickDateRange}
          placeholder="All Time"
          data={[
            { value: "all", label: "All Time" },
            { value: "today", label: "Today" },
            { value: "week", label: "Last 7 Days" },
            { value: "month", label: "Last 30 Days" },
          ]}
          className="w-full sm:w-[180px]"
          checkIconPosition="right"
        />
      </div>

      {/* Sort Controls */}
      <div className="flex items-center">
        <Group gap="xs">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select
            value={sortBy}
            onChange={(value) => onSortChange(value as HistorySortOption)}
            placeholder="Sort by"
            data={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
              { value: "manga", label: "By Manga" },
            ]}
            className="w-[180px]"
            checkIconPosition="right"
          />

          <span className="text-sm text-muted-foreground ml-2">
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
          </span>
        </Group>
      </div>
    </div>
  );
}

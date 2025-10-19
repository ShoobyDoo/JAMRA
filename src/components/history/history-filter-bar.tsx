"use client";

import {
  Search,
  SlidersHorizontal,
  Grid2X2,
  List,
  LayoutGrid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HistoryActionType } from "@/lib/api";
import type { HistorySortOption, HistoryViewMode } from "@/store/history";

interface HistoryFilterBarProps {
  actionType?: HistoryActionType;
  onActionTypeChange: (type: HistoryActionType | undefined) => void;
  dateRange?: { startDate?: number; endDate?: number };
  onDateRangeChange: (startDate?: number, endDate?: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: HistorySortOption;
  onSortChange: (sort: HistorySortOption) => void;
  viewMode: HistoryViewMode;
  onViewModeChange: (mode: HistoryViewMode) => void;
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
  viewMode,
  onViewModeChange,
  totalCount,
}: HistoryFilterBarProps) {
  const handleQuickDateRange = (range: string) => {
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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search manga or chapters..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Action Type Filter */}
        <Select
          value={actionType ?? "all"}
          onValueChange={(value) =>
            onActionTypeChange(
              value === "all" ? undefined : (value as HistoryActionType),
            )
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="library_add">Added to Library</SelectItem>
            <SelectItem value="library_remove">Removed from Library</SelectItem>
            <SelectItem value="favorite">Favorited</SelectItem>
          </SelectContent>
        </Select>

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
          onValueChange={handleQuickDateRange}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort and View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select
            value={sortBy}
            onValueChange={(value) => onSortChange(value as HistorySortOption)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="manga">By Manga</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground ml-2">
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={viewMode === "timeline" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("timeline")}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("list")}
            className="h-8 w-8 p-0"
          >
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

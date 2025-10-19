"use client";

import { Search, Heart, SortAsc, SortDesc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LibraryStatus, LibrarySortOption } from "@/store/library";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedStatus === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusChange(undefined)}
        >
          All
          <Badge variant="secondary" className="ml-2">
            {totalCount}
          </Badge>
        </Button>

        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedStatus === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Search, Sort, and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value) => onSortChange(value as LibrarySortOption, sortOrder)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={toggleSortOrder}>
            {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>

          <Button
            variant={favoriteOnly ? "default" : "outline"}
            size="icon"
            onClick={onFavoriteToggle}
            title="Show favorites only"
          >
            <Heart className={`h-4 w-4 ${favoriteOnly ? "fill-current" : ""}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}

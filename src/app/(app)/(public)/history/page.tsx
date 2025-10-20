"use client";

import { useEffect, useState } from "react";
import { useHistory } from "@/store/history";
import { HistoryTimeline } from "@/components/history/history-timeline";
import { HistoryFilterBar } from "@/components/history/history-filter-bar";
import { Skeleton, Button, Menu } from "@mantine/core";
import { Download, MoreVertical, Trash2, BarChart3 } from "lucide-react";
import type { HistoryActionType } from "@/lib/api";
import { exportHistory, type ExportFormat } from "@/lib/history-export";
import Link from "next/link";

export default function HistoryPage() {
  const {
    entries,
    stats,
    filters,
    sortBy,
    viewMode,
    isLoading,
    error,
    hasMore,
    loadHistory,
    loadStats,
    loadMore,
    setFilters,
    setSortBy,
    setViewMode,
    getGroupedByDate,
    clearAllHistory,
  } = useHistory();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadHistory(false);
    loadStats();
  }, [loadHistory, loadStats]);

  const handleExport = (format: ExportFormat) => {
    exportHistory(entries, format);
  };

  const handleClearHistory = async () => {
    if (showClearConfirm) {
      await clearAllHistory();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  const handleActionTypeChange = (
    actionType: HistoryActionType | undefined,
  ) => {
    setFilters({ actionType });
  };

  const handleDateRangeChange = (startDate?: number, endDate?: number) => {
    setFilters({ startDate, endDate });
  };

  const handleSearchChange = (query: string) => {
    setFilters({ searchQuery: query || undefined });
  };

  const groupedEntries = getGroupedByDate();

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">History</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive font-medium">Failed to load history</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">History</h1>
          <p className="text-muted-foreground mt-1">
            {stats?.totalEntries
              ? `${stats.totalEntries} total ${stats.totalEntries === 1 ? "entry" : "entries"}`
              : "Recently viewed chapters will show up here"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/history/stats">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              Statistics
            </Button>
          </Link>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Actions</Menu.Label>
              <Menu.Item
                leftSection={<Download className="h-4 w-4" />}
                onClick={() => handleExport("json")}
              >
                Export as JSON
              </Menu.Item>
              <Menu.Item
                leftSection={<Download className="h-4 w-4" />}
                onClick={() => handleExport("csv")}
              >
                Export as CSV
              </Menu.Item>
              <Menu.Item
                leftSection={<Download className="h-4 w-4" />}
                onClick={() => handleExport("md")}
              >
                Export as Markdown
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<Trash2 className="h-4 w-4" />}
                onClick={handleClearHistory}
              >
                {showClearConfirm
                  ? "Click again to confirm"
                  : "Clear All History"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* Filters */}
      <HistoryFilterBar
        actionType={filters.actionType}
        onActionTypeChange={handleActionTypeChange}
        dateRange={
          filters.startDate || filters.endDate
            ? { startDate: filters.startDate, endDate: filters.endDate }
            : undefined
        }
        onDateRangeChange={handleDateRangeChange}
        searchQuery={filters.searchQuery ?? ""}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={entries.length}
      />

      {/* Content */}
      {isLoading && entries.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-lg border p-4"
            >
              <Skeleton height={48} width={48} radius="sm" />
              <div className="flex-1 space-y-2">
                <Skeleton height={16} width="75%" />
                <Skeleton height={12} width="50%" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium">No history yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filters.actionType || filters.startDate || filters.searchQuery
              ? "No entries found matching your filters"
              : "Start reading manga to build your history"}
          </p>
        </div>
      ) : (
        <>
          <HistoryTimeline entries={groupedEntries} viewMode={viewMode} />

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={loadMore}
                loading={isLoading}
                variant="outline"
                size="lg"
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

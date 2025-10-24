"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TextInput,
  Group,
  MultiSelect,
  Button,
  Popover,
  Stack,
  Text,
  NumberInput,
  ActionIcon,
} from "@mantine/core";
import { Search, Filter, X } from "lucide-react";
import { useDebouncedValue } from "@mantine/hooks";

export interface SearchFilters {
  query: string;
  extensions: string[];
  sizeMin?: number; // in bytes
  sizeMax?: number; // in bytes
  dateFrom?: number; // timestamp
  dateTo?: number; // timestamp
}

interface OfflineSearchProps {
  availableExtensions: string[];
  onFiltersChange: (filters: SearchFilters) => void;
  initialFilters?: Partial<SearchFilters>;
}

export function OfflineSearch({
  availableExtensions,
  onFiltersChange,
  initialFilters = {},
}: OfflineSearchProps) {
  const [query, setQuery] = useState(initialFilters.query || "");
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(
    initialFilters.extensions || [],
  );
  const [sizeMinMB, setSizeMinMB] = useState<number | string>(
    initialFilters.sizeMin ? Math.round(initialFilters.sizeMin / (1024 * 1024)) : "",
  );
  const [sizeMaxMB, setSizeMaxMB] = useState<number | string>(
    initialFilters.sizeMax ? Math.round(initialFilters.sizeMax / (1024 * 1024)) : "",
  );
  const [daysAgo, setDaysAgo] = useState<number | string>("");

  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [filterPopoverOpened, setFilterPopoverOpened] = useState(false);

  // Calculate active filter count
  const activeFilterCount =
    selectedExtensions.length +
    (sizeMinMB ? 1 : 0) +
    (sizeMaxMB ? 1 : 0) +
    (daysAgo ? 1 : 0);

  // Emit filter changes
  useEffect(() => {
    const filters: SearchFilters = {
      query: debouncedQuery,
      extensions: selectedExtensions,
    };

    if (sizeMinMB && typeof sizeMinMB === "number") {
      filters.sizeMin = sizeMinMB * 1024 * 1024;
    }

    if (sizeMaxMB && typeof sizeMaxMB === "number") {
      filters.sizeMax = sizeMaxMB * 1024 * 1024;
    }

    if (daysAgo && typeof daysAgo === "number") {
      const timestamp = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
      filters.dateFrom = timestamp;
    }

    onFiltersChange(filters);
  }, [debouncedQuery, selectedExtensions, sizeMinMB, sizeMaxMB, daysAgo, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    setSelectedExtensions([]);
    setSizeMinMB("");
    setSizeMaxMB("");
    setDaysAgo("");
  }, []);

  const handleClearSearch = useCallback(() => {
    setQuery("");
  }, []);

  const extensionOptions = availableExtensions.map((ext) => ({
    value: ext,
    label: ext,
  }));

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="wrap">
        {/* Search Input */}
        <TextInput
          placeholder="Search offline manga..."
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          leftSection={<Search size={16} />}
          rightSection={
            query ? (
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X size={14} />
              </ActionIcon>
            ) : null
          }
          className="flex-1"
          styles={{ root: { minWidth: 200 } }}
        />

        {/* Filter Popover */}
        <Popover
          width={320}
          position="bottom-end"
          shadow="md"
          opened={filterPopoverOpened}
          onChange={setFilterPopoverOpened}
        >
          <Popover.Target>
            <Button
              variant={activeFilterCount > 0 ? "filled" : "subtle"}
              leftSection={<Filter size={16} />}
              onClick={() => setFilterPopoverOpened(!filterPopoverOpened)}
            >
              Filters
              {activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
          </Popover.Target>

          <Popover.Dropdown>
            <Stack gap="md">
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={600}>
                    Filters
                  </Text>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={handleClearFilters}
                    >
                      Clear all
                    </Button>
                  )}
                </Group>
              </div>

              {/* Extension Filter */}
              {extensionOptions.length > 0 && (
                <MultiSelect
                  label="Extensions"
                  placeholder="All extensions"
                  data={extensionOptions}
                  value={selectedExtensions}
                  onChange={setSelectedExtensions}
                  searchable
                  clearable
                  size="xs"
                />
              )}

              {/* Size Filter */}
              <div>
                <Text size="xs" fw={600} mb="xs">
                  Size (MB)
                </Text>
                <Group gap="xs" grow>
                  <NumberInput
                    placeholder="Min"
                    value={sizeMinMB}
                    onChange={setSizeMinMB}
                    min={0}
                    size="xs"
                  />
                  <NumberInput
                    placeholder="Max"
                    value={sizeMaxMB}
                    onChange={setSizeMaxMB}
                    min={0}
                    size="xs"
                  />
                </Group>
              </div>

              {/* Date Filter */}
              <div>
                <Text size="xs" fw={600} mb="xs">
                  Downloaded within
                </Text>
                <NumberInput
                  placeholder="Days ago"
                  value={daysAgo}
                  onChange={setDaysAgo}
                  min={1}
                  size="xs"
                  rightSection={
                    <Text size="xs" c="dimmed">
                      days
                    </Text>
                  }
                />
              </div>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>

      {/* Active Filters Display */}
      {(query || activeFilterCount > 0) && (
        <Group gap="xs">
          {query && (
            <Button
              variant="light"
              size="compact-xs"
              rightSection={<X size={12} />}
              onClick={handleClearSearch}
            >
              Search: {query}
            </Button>
          )}
          {selectedExtensions.map((ext) => (
            <Button
              key={ext}
              variant="light"
              size="compact-xs"
              rightSection={<X size={12} />}
              onClick={() =>
                setSelectedExtensions((prev) => prev.filter((e) => e !== ext))
              }
            >
              {ext}
            </Button>
          ))}
          {sizeMinMB && (
            <Button
              variant="light"
              size="compact-xs"
              rightSection={<X size={12} />}
              onClick={() => setSizeMinMB("")}
            >
              Min: {sizeMinMB} MB
            </Button>
          )}
          {sizeMaxMB && (
            <Button
              variant="light"
              size="compact-xs"
              rightSection={<X size={12} />}
              onClick={() => setSizeMaxMB("")}
            >
              Max: {sizeMaxMB} MB
            </Button>
          )}
          {daysAgo && (
            <Button
              variant="light"
              size="compact-xs"
              rightSection={<X size={12} />}
              onClick={() => setDaysAgo("")}
            >
              Last {daysAgo} days
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}

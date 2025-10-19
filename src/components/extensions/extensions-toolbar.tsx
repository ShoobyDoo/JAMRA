"use client";

import { memo } from "react";
import {
  ActionIcon,
  Group,
  SegmentedControl,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { ArrowDown, ArrowUp, RefreshCcw } from "lucide-react";
import type { ExtensionListOptions } from "@/lib/api";

export type StatusFilter = "all" | "enabled" | "disabled";

interface StatusSummary {
  total: number;
  enabled: number;
  disabled: number;
}

interface ExtensionsToolbarProps {
  search: string;
  statusFilter: StatusFilter;
  sort: NonNullable<ExtensionListOptions["sort"]>;
  order: NonNullable<ExtensionListOptions["order"]>;
  statusSummary: StatusSummary;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSortChange: (value: NonNullable<ExtensionListOptions["sort"]>) => void;
  onToggleOrder: () => void;
  onRefresh: () => void;
}

export const ExtensionsToolbar = memo(function ExtensionsToolbar({
  search,
  statusFilter,
  sort,
  order,
  statusSummary,
  onSearchChange,
  onStatusFilterChange,
  onSortChange,
  onToggleOrder,
  onRefresh,
}: ExtensionsToolbarProps) {
  return (
    <Group gap="md" align="center" wrap="nowrap">
      <TextInput
        placeholder="Search by name or author"
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        className="flex-1"
      />
      <Group gap="xs" align="center" wrap="nowrap">
        <SegmentedControl
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(value as StatusFilter)}
          data={[
            { label: "All", value: "all" },
            { label: "Enabled", value: "enabled" },
            { label: "Disabled", value: "disabled" },
          ]}
        />
        <SegmentedControl
          value={sort}
          onChange={(value) =>
            onSortChange(value as NonNullable<ExtensionListOptions["sort"]>)
          }
          data={[
            { label: "Name", value: "name" },
            { label: "Installed", value: "installedAt" },
            { label: "Author", value: "author" },
            { label: "Language", value: "language" },
          ]}
        />
        <Tooltip label={order === "asc" ? "Ascending" : "Descending"}>
          <ActionIcon variant="light" size="input-sm" onClick={onToggleOrder}>
            {order === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Refresh">
          <ActionIcon variant="light" size="input-sm" onClick={onRefresh}>
            <RefreshCcw size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Text size="sm" c="dimmed" className="whitespace-nowrap">
        {statusSummary.total === 0
          ? "No extensions installed yet."
          : `${statusSummary.enabled} enabled · ${statusSummary.disabled} disabled`}
      </Text>
    </Group>
  );
});

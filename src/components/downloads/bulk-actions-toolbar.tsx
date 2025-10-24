"use client";

import { Box, Group, Button, Text, ActionIcon, Tooltip } from "@mantine/core";
import { X, Trash2, Archive, CheckCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onValidate?: () => void;
  onDownload?: () => void;
  loading?: boolean;
  className?: string;
}

export function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onClearSelection,
  onDelete,
  onArchive,
  onValidate,
  onDownload,
  loading = false,
  className,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Box
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform",
        "rounded-lg border border-border bg-background shadow-lg",
        "px-4 py-3",
        className,
      )}
      style={{ minWidth: 400 }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm">
          <Tooltip label="Clear selection">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onClearSelection}
              disabled={loading}
            >
              <X size={16} />
            </ActionIcon>
          </Tooltip>

          <Text size="sm" fw={600}>
            {selectedCount} of {totalCount} selected
          </Text>
        </Group>

        <Group gap="xs">
          {onDownload && (
            <Tooltip label="Download selected">
              <Button
                variant="subtle"
                size="compact-sm"
                leftSection={<Download size={14} />}
                onClick={onDownload}
                disabled={loading}
              >
                Download
              </Button>
            </Tooltip>
          )}

          {onValidate && (
            <Tooltip label="Validate metadata">
              <Button
                variant="subtle"
                size="compact-sm"
                leftSection={<CheckCircle size={14} />}
                onClick={onValidate}
                disabled={loading}
              >
                Validate
              </Button>
            </Tooltip>
          )}

          {onArchive && (
            <Tooltip label="Archive as ZIP">
              <Button
                variant="subtle"
                size="compact-sm"
                leftSection={<Archive size={14} />}
                onClick={onArchive}
                disabled={loading}
              >
                Archive
              </Button>
            </Tooltip>
          )}

          {onDelete && (
            <Tooltip label="Delete selected">
              <Button
                variant="subtle"
                size="compact-sm"
                color="red"
                leftSection={<Trash2 size={14} />}
                onClick={onDelete}
                disabled={loading}
              >
                Delete
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>
    </Box>
  );
}

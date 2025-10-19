"use client";

import { memo } from "react";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { ArrowDownToLine } from "lucide-react";
import { compareVersions } from "@jamra/extension-registry";
import type { ManagedExtension } from "@/lib/api";

interface ExtensionUpdateBannerProps {
  extension: ManagedExtension;
  isBusy: boolean;
  onApplyUpdate: (extension: ManagedExtension) => void;
  onAcknowledgeUpdate: (extension: ManagedExtension) => void;
}

export const ExtensionUpdateBanner = memo(function ExtensionUpdateBanner({
  extension,
  isBusy,
  onApplyUpdate,
  onAcknowledgeUpdate,
}: ExtensionUpdateBannerProps) {
  if (!extension.source?.registryId) {
    return (
      <Alert color="gray" title="Updates">
        <Text size="sm">
          Updates are not managed for manually installed extensions.
        </Text>
      </Alert>
    );
  }

  const latest = extension.updateState?.latest;
  if (!latest) return null;

  const isNewer = compareVersions(latest.version, extension.version) > 0;
  const isAcknowledged =
    extension.updateState?.acknowledgedVersion === latest.version;

  if (!isNewer && isAcknowledged) {
    return null;
  }

  const awaitingAction = isNewer && !isAcknowledged;

  return (
    <Alert
      color={awaitingAction ? "violet" : "blue"}
      title={awaitingAction ? "Update available" : "Latest version"}
    >
      <Stack gap={6}>
        <Text size="sm">
          Latest version: <strong>{latest.version}</strong>
          {!awaitingAction && (
            <span className="text-dimmed"> (currently installed)</span>
          )}
        </Text>
        {latest.releaseNotes ? (
          <Text component="pre" className="whitespace-pre-wrap text-xs" c="dimmed">
            {latest.releaseNotes}
          </Text>
        ) : null}
        {awaitingAction && (
          <Group gap="sm">
            <Button
              size="xs"
              color="violet"
              loading={isBusy}
              onClick={() => onApplyUpdate(extension)}
              leftSection={<ArrowDownToLine size={14} />}
            >
              Install update
            </Button>
            <Button
              size="xs"
              variant="subtle"
              disabled={isBusy}
              onClick={() => onAcknowledgeUpdate(extension)}
            >
              Mark as read
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
});

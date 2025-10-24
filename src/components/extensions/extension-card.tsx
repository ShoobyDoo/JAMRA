"use client";

import { memo } from "react";
import {
  Alert,
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { Check, ChevronDown, ChevronUp, Copy, RefreshCcw } from "lucide-react";
import { compareVersions } from "@jamra/extension-registry";
import type { ManagedExtension } from "@/lib/api";
import { resolveIcon } from "./utils";
import { ExtensionUpdateBanner } from "./extension-update-banner";

interface ExtensionCardProps {
  extension: ManagedExtension;
  isExpanded: boolean;
  busyExtensionId: string | null;
  copiedField: string | null;
  onToggle: (event: React.MouseEvent) => void;
  onEnable: (extension: ManagedExtension) => void;
  onDisable: (extension: ManagedExtension) => void;
  onCheckUpdates: (extension: ManagedExtension) => void;
  onApplyUpdate: (extension: ManagedExtension) => void;
  onAcknowledgeUpdate: (extension: ManagedExtension) => void;
  onOpenSettings: (extension: ManagedExtension) => void;
  onRequestUninstall: (extension: ManagedExtension) => void;
  onCopy: (value: string, fieldId: string) => void;
}

export const ExtensionCard = memo(function ExtensionCard({
  extension,
  isExpanded,
  busyExtensionId,
  copiedField,
  onToggle,
  onEnable,
  onDisable,
  onCheckUpdates,
  onApplyUpdate,
  onAcknowledgeUpdate,
  onOpenSettings,
  onRequestUninstall,
  onCopy,
}: ExtensionCardProps) {
  const hasErrors = extension.errors.length > 0;
  const latest = extension.updateState?.latest;
  const supportsUpdates = Boolean(extension.source?.registryId);
  const updateBadge =
    supportsUpdates &&
    latest &&
    compareVersions(latest.version, extension.version) > 0;
  const sourceLabel = extension.source?.registryId ?? "Manual install";
  const lastChecked = extension.updateState?.lastCheckedAt
    ? new Date(extension.updateState.lastCheckedAt).toLocaleString()
    : undefined;
  const iconSrc = resolveIcon(extension.icon ?? extension.manifest.icon);
  const description = extension.description ?? "No description provided.";
  const truncatedDescription =
    description.length > 80 ? `${description.slice(0, 80)}...` : description;

  return (
    <Card withBorder padding="md" radius="md" className="extension-card-expandable">
      <Stack gap="sm">
        <Group
          justify="space-between"
          align="flex-start"
          gap="md"
          wrap="nowrap"
          p="md"
          className="-m-3 cursor-pointer rounded-md"
          onClick={onToggle}
        >
          <Group gap="sm" align="flex-start" wrap="nowrap" className="flex-1 min-w-0">
            <Avatar
              src={iconSrc}
              alt={`${extension.name} icon`}
              name={extension.name}
              radius="md"
              size={48}
              color={iconSrc ? undefined : "gray"}
              variant={iconSrc ? undefined : "filled"}
              className="shrink-0"
            />
            <Stack gap={4} className="flex-1 min-w-0">
              <Group gap="xs" align="center" wrap="wrap">
                <Title order={4} className="text-base">
                  {extension.name}
                </Title>
                <Badge size="xs" color="gray" variant="light">
                  v{extension.version}
                </Badge>
                {extension.enabled ? (
                  <Badge size="xs" color="green">
                    Enabled
                  </Badge>
                ) : (
                  <Badge size="xs" color="yellow">
                    Disabled
                  </Badge>
                )}
                {updateBadge ? (
                  <Badge size="xs" color="violet" variant="filled">
                    Update
                  </Badge>
                ) : null}
              </Group>
              <Text size="xs" c="dimmed" className="line-clamp-1">
                {isExpanded ? description : truncatedDescription}
              </Text>
              {!isExpanded && (
                <Text size="xs">
                  by <span className="font-medium">{extension.author.name}</span>
                </Text>
              )}
            </Stack>
          </Group>

          <Group gap="xs" align="center" className="shrink-0">
            {extension.enabled ? (
              <Button
                size="xs"
                color="yellow"
                variant="light"
                loading={busyExtensionId === extension.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onDisable(extension);
                }}
                className="hover:!bg-yellow-500/20"
              >
                Disable
              </Button>
            ) : (
              <Button
                size="xs"
                color="green"
                variant="light"
                loading={busyExtensionId === extension.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onEnable(extension);
                }}
                className="hover:!bg-green-500/20"
              >
                Enable
              </Button>
            )}
            <div className="cursor-pointer">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </Group>
        </Group>

        {isExpanded && (
          <>
            <Divider />
            <Stack gap={6}>
              <Text size="xs">
                Author: <span className="font-medium">{extension.author.name}</span>
              </Text>
              <Text size="xs" c="dimmed">
                Languages: {extension.languageCodes.join(", ") || "—"}
              </Text>
              <Text size="xs" c="dimmed">
                Source: {sourceLabel}
                {extension.source?.version ? ` · v${extension.source.version}` : ""}
              </Text>

              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Path
                </Text>
                <Group gap="xs" align="center" wrap="nowrap">
                  <Text size="xs" c="dimmed" className="flex-1 break-all font-mono">
                    {extension.entryPath ?? "Unknown"}
                  </Text>
                  <Tooltip
                    label={
                      copiedField === `path-${extension.id}` ? "Copied!" : "Copy path"
                    }
                  >
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopy(extension.entryPath ?? "Unknown", `path-${extension.id}`);
                      }}
                    >
                      {copiedField === `path-${extension.id}` ? (
                        <Check size={12} />
                      ) : (
                        <Copy size={12} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </div>

              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Extension ID
                </Text>
                <Group gap="xs" align="center" wrap="nowrap">
                  <Text size="xs" c="dimmed" className="flex-1 font-mono">
                    {extension.id}
                  </Text>
                  <Tooltip
                    label={
                      copiedField === `id-${extension.id}` ? "Copied!" : "Copy ID"
                    }
                  >
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopy(extension.id, `id-${extension.id}`);
                      }}
                    >
                      {copiedField === `id-${extension.id}` ? (
                        <Check size={12} />
                      ) : (
                        <Copy size={12} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </div>

              <Group gap="xs" wrap="wrap">
                <Badge size="sm" color="blue" variant="light">
                  Installed {new Date(extension.installedAt).toLocaleString()}
                </Badge>
                {extension.loaded ? (
                  <Badge size="sm" color="green" variant="light">
                    Loaded
                  </Badge>
                ) : (
                  <Badge size="sm" color="gray" variant="light">
                    Not loaded
                  </Badge>
                )}
                {lastChecked ? (
                  <Badge size="sm" color="gray" variant="outline">
                    Last checked {lastChecked}
                  </Badge>
                ) : null}
              </Group>
            </Stack>

            <Divider />

            <Group gap="xs" wrap="wrap">
              <Button
                size="xs"
                variant="light"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSettings(extension);
                }}
              >
                Settings
              </Button>
              {supportsUpdates ? (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<RefreshCcw size={14} />}
                  loading={busyExtensionId === extension.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCheckUpdates(extension);
                  }}
                >
                  Check updates
                </Button>
              ) : null}
              <Button
                size="xs"
                color="red"
                variant="outline"
                loading={busyExtensionId === extension.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestUninstall(extension);
                }}
              >
                Uninstall
              </Button>
            </Group>

            <ExtensionUpdateBanner
              extension={extension}
              isBusy={busyExtensionId === extension.id}
              onApplyUpdate={onApplyUpdate}
              onAcknowledgeUpdate={onAcknowledgeUpdate}
            />

            {hasErrors ? (
              <Alert color="red" title="Issues detected">
                <Stack gap={4}>
                  {extension.errors.map((message) => (
                    <Text key={message} size="sm">
                      {message}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            ) : null}
          </>
        )}
      </Stack>
    </Card>
  );
});

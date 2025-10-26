"use client";

import { memo } from "react";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { RefreshCcw, ArrowDownToLine } from "lucide-react";
import type {
  MarketplaceData,
  MarketplaceExtensionSummary,
} from "@/lib/api";
import { resolveIcon } from "./utils";

interface ExtensionsMarketplaceProps {
  marketplace: MarketplaceData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onInstall: (extension: MarketplaceExtensionSummary) => void;
}

export const ExtensionsMarketplace = memo(function ExtensionsMarketplace({
  marketplace,
  loading,
  error,
  onRefresh,
  onInstall,
}: ExtensionsMarketplaceProps) {
  return (
    <Stack gap="lg">
      <Card withBorder p="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <div>
              <Title order={3}>Marketplace</Title>
              <Text size="sm" c="dimmed">
                Browse curated registries and install vetted extension builds.
              </Text>
            </div>
            <Tooltip label="Refresh">
              <ActionIcon variant="light" onClick={onRefresh} loading={loading}>
                <RefreshCcw size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {error ? <Alert color="red">{error}</Alert> : null}

          {loading && !marketplace ? (
            <Group justify="center" py="lg">
              <Loader />
            </Group>
          ) : marketplace && marketplace.extensions.length > 0 ? (
            <Stack gap="md">
              {marketplace.extensions.map((extension) => {
                const latest = extension.latestVersion;
                const iconSrc = resolveIcon(extension.icon);
                return (
                  <Card
                    key={`${extension.registryId}:${extension.id}`}
                    withBorder
                    padding="lg"
                    radius="md"
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <div className="flex-1">
                          <Group gap="sm" align="flex-start" wrap="nowrap">
                            <Avatar
                              src={iconSrc}
                              alt={`${extension.name} icon`}
                              name={extension.name}
                              radius="md"
                              size={56}
                              color={iconSrc ? undefined : "gray"}
                              variant={iconSrc ? undefined : "filled"}
                              className="shrink-0"
                            />
                            <Stack gap={6} className="flex-1">
                              <Group gap="sm" align="center" wrap="wrap">
                                <Title order={4}>{extension.name}</Title>
                                {latest ? (
                                  <Badge color="gray" variant="light">
                                    v{latest.version}
                                  </Badge>
                                ) : null}
                                <Badge color="blue" variant="outline">
                                  {extension.registryLabel}
                                </Badge>
                              </Group>
                              <Text size="sm" c="dimmed">
                                {extension.summary}
                              </Text>
                              <Text size="sm">
                                Author:{" "}
                                <span className="font-medium">
                                  {extension.author.name}
                                </span>
                              </Text>
                              <Text size="xs" c="dimmed">
                                Tags:{" "}
                                {extension.tags.length > 0
                                  ? extension.tags.join(", ")
                                  : "—"}
                              </Text>
                              {latest?.releaseNotes ? (
                                <Text size="xs" c="dimmed">
                                  Latest release notes:{" "}
                                  {latest.releaseNotes.length > 160
                                    ? `${latest.releaseNotes.slice(0, 157)}...`
                                    : latest.releaseNotes}
                                </Text>
                              ) : null}
                            </Stack>
                          </Group>
                        </div>
                        <Button
                          size="xs"
                          variant="filled"
                          leftSection={<ArrowDownToLine size={14} />}
                          onClick={() => onInstall(extension)}
                        >
                          Install
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Text c="dimmed">No marketplace extensions available.</Text>
          )}
        </Stack>
      </Card>
    </Stack>
  );
});

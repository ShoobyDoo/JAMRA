"use client";

import { memo } from "react";
import { Alert, Button, Card, Stack, Switch, Text, TextInput, Title } from "@mantine/core";

interface InstallFromFileCardProps {
  installPath: string;
  autoEnable: boolean;
  isInstalling: boolean;
  error: string | null;
  onPathChange: (value: string) => void;
  onToggleAutoEnable: (value: boolean) => void;
  onInstall: () => void;
}

export const InstallFromFileCard = memo(function InstallFromFileCard({
  installPath,
  autoEnable,
  isInstalling,
  error,
  onPathChange,
  onToggleAutoEnable,
  onInstall,
}: InstallFromFileCardProps) {
  return (
    <Card withBorder p="lg">
      <Stack gap="sm">
        <Title order={3}>Install from file</Title>
        <Text size="sm" c="dimmed">
          Provide the absolute path to the compiled extension entry file. The API will copy it into the JAMRA data directory.
        </Text>
        <TextInput
          label="Extension entry path"
          placeholder="/path/to/extension/dist/index.js"
          value={installPath}
          onChange={(event) => onPathChange(event.currentTarget.value)}
        />
        <Stack gap="xs">
          <Switch
            label="Enable immediately after installation"
            checked={autoEnable}
            onChange={(event) => onToggleAutoEnable(event.currentTarget.checked)}
          />
          <Button loading={isInstalling} onClick={onInstall}>
            Install
          </Button>
        </Stack>
        {error ? <Alert color="red">{error}</Alert> : null}
      </Stack>
    </Card>
  );
});

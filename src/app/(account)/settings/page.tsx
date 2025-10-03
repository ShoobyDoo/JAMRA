"use client";

import { Button, Group, Stack, Text, Title } from "@mantine/core";

export default function SettingsPage() {
  return (
    <Stack gap="xl" p="xl" maw={720} mx="auto">
      <Stack gap="xs">
        <Title order={1}>Settings</Title>
        <Text c="dimmed">
          Configure appearance and account preferences for your reader.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Title order={2} size="h3">
          Appearance
        </Title>
        <Text size="sm" c="dimmed">
          Customize how the interface looks and feels.
        </Text>
        <Group gap="sm">
          <Button variant="light" color="brand" size="sm">
            Dark mode
          </Button>
          <Button variant="outline" color="accent" size="sm">
            Light mode
          </Button>
        </Group>
      </Stack>

      <Stack gap="sm">
        <Title order={2} size="h3">
          Account
        </Title>
        <Text size="sm" c="dimmed">
          Manage profile and authentication settings.
        </Text>
        <Button variant="filled" color="red" size="sm" w="fit-content">
          Delete account
        </Button>
      </Stack>
    </Stack>
  );
}

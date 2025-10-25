"use client";

import { Button, Paper, Stack, Text, Title } from "@mantine/core";

export default function ProfilePage() {
  return (
    <Stack gap="xl" maw={720} mx="auto">
      <Stack gap="xs">
        <Title order={1}>Profile</Title>
        <Text c="dimmed">
          Review your account details and tweak preferences.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Title order={2} size="h3">
          User Information
        </Title>
        <Text size="sm" c="dimmed">
          View and edit your personal details.
        </Text>
        <Paper withBorder p="lg" radius="lg">
          <Stack gap={8}>
            <Text size="sm">
              Username:{" "}
              <Text span c="dimmed" ff="monospace">
                Guest
              </Text>
            </Text>
            <Text size="sm">
              Email:{" "}
              <Text span c="dimmed" ff="monospace">
                guest@example.com
              </Text>
            </Text>
          </Stack>
        </Paper>
      </Stack>

      <Stack gap="sm">
        <Title order={2} size="h3">
          Preferences
        </Title>
        <Text size="sm" c="dimmed">
          Adjust your reading and notification preferences.
        </Text>
        <Button
          variant="light"
          color="brand"
          size="sm"
          radius="md"
          w="fit-content"
        >
          Edit preferences
        </Button>
      </Stack>
    </Stack>
  );
}

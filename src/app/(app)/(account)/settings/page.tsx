"use client";

import { Button, Group, Stack, Text, Title, Alert } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { AlertTriangle } from "lucide-react";
import { nukeUserData } from "@/lib/api";
import { useState } from "react";

export default function SettingsPage() {
  const [isNuking, setIsNuking] = useState(false);

  const handleNukeUserData = () => {
    modals.openConfirmModal({
      title: (
        <Group gap="xs">
          <AlertTriangle size={20} color="red" />
          <Text fw={600}>Nuclear Option: Clear All Data</Text>
        </Group>
      ),
      centered: true,
      children: (
        <Stack gap="md">
          <Text size="sm">
            This will <strong>permanently delete</strong>:
          </Text>
          <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
            <li>All reading progress and history</li>
            <li>All cached manga and chapters</li>
            <li>All downloaded images</li>
            <li>Extension cache data</li>
          </ul>
          <Alert color="red" icon={<AlertTriangle size={16} />}>
            <Text size="sm" fw={500}>
              This action is <strong>DESTRUCTIVE</strong> and{" "}
              <strong>CANNOT BE REVERSED</strong>.
            </Text>
          </Alert>
          <Text size="sm" c="dimmed">
            Your installed extensions will be preserved. This is primarily for
            development and testing purposes.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Yes, delete everything", cancel: "Cancel" },
      confirmProps: { color: "red", variant: "filled" },
      onConfirm: () => {
        // Second confirmation
        modals.openConfirmModal({
          title: (
            <Text fw={600} c="red">
              Are you absolutely sure?
            </Text>
          ),
          centered: true,
          children: (
            <Stack gap="md">
              <Text size="sm">
                This is your last chance to back out. All your reading data will
                be gone forever.
              </Text>
              <Text size="sm" fw={600} c="red">
                Type &quot;DELETE&quot; in your mind and click confirm if you&apos;re certain.
              </Text>
            </Stack>
          ),
          labels: { confirm: "Delete everything now", cancel: "Cancel" },
          confirmProps: { color: "red", variant: "filled" },
          onConfirm: async () => {
            setIsNuking(true);
            try {
              const result = await nukeUserData();
              notifications.show({
                title: "Data cleared",
                message: result.message,
                color: "green",
                autoClose: 2000,
              });

              // Reload the page after notification is visible
              setTimeout(() => {
                window.location.reload();
              }, 2500);
            } catch (error) {
              notifications.show({
                title: "Failed to clear data",
                message:
                  error instanceof Error ? error.message : "Unknown error",
                color: "red",
              });
            } finally {
              setIsNuking(false);
            }
          },
        });
      },
    });
  };

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

      <Stack
        gap="sm"
        p="md"
        style={{
          border: "2px solid var(--mantine-color-red-6)",
          borderRadius: "var(--mantine-radius-md)",
          backgroundColor: "var(--mantine-color-red-0)",
        }}
      >
        <Group gap="xs">
          <AlertTriangle size={20} color="red" />
          <Title order={2} size="h3" c="red">
            Danger Zone
          </Title>
        </Group>
        <Text size="sm" c="dimmed">
          Destructive actions that cannot be undone. Use with extreme caution.
        </Text>
        <Button
          variant="filled"
          color="red"
          size="sm"
          w="fit-content"
          onClick={handleNukeUserData}
          loading={isNuking}
          leftSection={<AlertTriangle size={16} />}
        >
          Clear all data
        </Button>
        <Text size="xs" c="dimmed" fs="italic">
          This will delete all reading progress, cached manga, and downloaded
          data. Extensions will be preserved.
        </Text>
      </Stack>
    </Stack>
  );
}

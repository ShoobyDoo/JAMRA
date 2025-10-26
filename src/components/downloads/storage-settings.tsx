"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Stack,
  Text,
  NumberInput,
  Switch,
  Select,
  Button,
  Group,
  Alert,
  Progress,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, Save, Trash2 } from "lucide-react";
import type { StorageStats } from "@/lib/api/offline";
import { logger } from "@/lib/logger";

interface StorageSettings {
  maxStorageGB: number;
  autoCleanupEnabled: boolean;
  cleanupStrategy: "oldest" | "largest" | "least-accessed";
  cleanupThresholdPercent: number;
}

interface StorageSettingsProps {
  stats: StorageStats | null;
}

export function StorageSettingsComponent({ stats }: StorageSettingsProps) {
  const [settings, setSettings] = useState<StorageSettings>({
    maxStorageGB: 10,
    autoCleanupEnabled: false,
    cleanupStrategy: "oldest",
    cleanupThresholdPercent: 90,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/offline/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      // Use defaults if settings don't exist yet (expected on first load)
      logger.debug("Failed to load storage settings, using defaults", {
        component: "StorageSettings",
        action: "load-settings",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch("/api/offline/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      notifications.show({
        title: "Settings saved",
        message: "Storage settings have been updated successfully",
        color: "green",
      });

      setHasChanges(false);
    } catch (error) {
      notifications.show({
        title: "Failed to save settings",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = <K extends keyof StorageSettings>(
    field: K,
    value: StorageSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleCleanup = async () => {
    try {
      setCleaning(true);

      const response = await fetch("/api/offline/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetFreeGB: 1 }),
      });

      if (!response.ok) {
        throw new Error(`Failed to perform cleanup: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        const freedGB = result.freedBytes / (1024 * 1024 * 1024);
        notifications.show({
          title: "Cleanup completed",
          message: `Freed ${freedGB.toFixed(2)} GB by removing ${result.itemsRemoved} item(s)`,
          color: "green",
        });

        // Reload the page to refresh storage stats
        window.location.reload();
      } else {
        throw new Error(result.errors?.join(", ") || "Cleanup failed");
      }
    } catch (error) {
      notifications.show({
        title: "Failed to perform cleanup",
        message: error instanceof Error ? error.message : "An error occurred",
        color: "red",
      });
    } finally {
      setCleaning(false);
    }
  };

  // Calculate storage usage percentage
  const currentStorageGB = stats ? stats.totalBytes / (1024 * 1024 * 1024) : 0;
  const usagePercent = settings.maxStorageGB > 0
    ? (currentStorageGB / settings.maxStorageGB) * 100
    : 0;
  const isNearLimit = usagePercent >= settings.cleanupThresholdPercent;

  return (
    <Stack gap="md">
      {/* Storage Limit */}
      <Box>
        <Text size="sm" fw={600} mb="xs">
          Storage Limit
        </Text>
        <NumberInput
          value={settings.maxStorageGB}
          onChange={(value) => handleChange("maxStorageGB", Number(value) || 0)}
          min={1}
          max={1000}
          step={1}
          suffix=" GB"
          description="Maximum storage space for offline manga"
          disabled={loading}
        />

        {/* Storage Usage Indicator */}
        {stats && (
          <Box mt="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">
                Current Usage
              </Text>
              <Text size="xs" fw={600}>
                {currentStorageGB.toFixed(2)} GB / {settings.maxStorageGB} GB
              </Text>
            </Group>
            <Progress
              value={Math.min(usagePercent, 100)}
              size="md"
              radius="sm"
              color={usagePercent >= 90 ? "red" : usagePercent >= 75 ? "yellow" : "blue"}
            />
            <Text size="xs" c="dimmed" mt={4}>
              {usagePercent.toFixed(1)}% used
            </Text>
          </Box>
        )}
      </Box>

      {/* Auto-Cleanup Settings */}
      <Box>
        <Switch
          label={
            <div>
              <Text size="sm" fw={600}>
                Auto-Cleanup
              </Text>
              <Text size="xs" c="dimmed">
                Automatically remove content when storage limit is reached
              </Text>
            </div>
          }
          checked={settings.autoCleanupEnabled}
          onChange={(event) =>
            handleChange("autoCleanupEnabled", event.currentTarget.checked)
          }
          disabled={loading}
        />
      </Box>

      {/* Cleanup Strategy */}
      {settings.autoCleanupEnabled && (
        <Box>
          <Select
            label="Cleanup Strategy"
            description="What to remove first when cleaning up storage"
            value={settings.cleanupStrategy}
            onChange={(value) =>
              handleChange("cleanupStrategy", value as typeof settings.cleanupStrategy)
            }
            data={[
              { value: "oldest", label: "Oldest Downloads First" },
              { value: "largest", label: "Largest Files First" },
              { value: "least-accessed", label: "Least Recently Accessed" },
            ]}
            disabled={loading}
          />
        </Box>
      )}

      {/* Cleanup Threshold */}
      {settings.autoCleanupEnabled && (
        <Box>
          <NumberInput
            label="Cleanup Threshold"
            description="Start cleanup when storage usage exceeds this percentage"
            value={settings.cleanupThresholdPercent}
            onChange={(value) =>
              handleChange("cleanupThresholdPercent", Number(value) || 90)
            }
            min={50}
            max={95}
            step={5}
            suffix="%"
            disabled={loading}
          />
        </Box>
      )}

      {/* Warning if near limit */}
      {isNearLimit && settings.autoCleanupEnabled && (
        <Alert
          icon={<AlertCircle size={16} />}
          title="Storage Near Limit"
          color="yellow"
          variant="light"
        >
          <Text size="sm">
            Your offline storage is at {usagePercent.toFixed(1)}% capacity.
            Auto-cleanup will activate soon to free up space.
          </Text>
        </Alert>
      )}

      {isNearLimit && !settings.autoCleanupEnabled && (
        <Alert
          icon={<AlertCircle size={16} />}
          title="Storage Near Limit"
          color="red"
          variant="light"
        >
          <Text size="sm">
            Your offline storage is at {usagePercent.toFixed(1)}% capacity.
            Consider enabling auto-cleanup or manually removing some content.
          </Text>
        </Alert>
      )}

      {/* Action Buttons */}
      <Group justify="space-between" mt="md">
        <Button
          variant="light"
          color="red"
          onClick={handleCleanup}
          disabled={cleaning || loading}
          loading={cleaning}
          leftSection={<Trash2 size={16} />}
        >
          Run Cleanup Now
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving || loading}
          loading={saving}
          leftSection={<Save size={16} />}
        >
          Save Settings
        </Button>
      </Group>
    </Stack>
  );
}

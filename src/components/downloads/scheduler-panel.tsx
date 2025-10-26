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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Clock, AlertCircle, Save, Zap } from "lucide-react";
import { logger } from "@/lib/logger";

interface SchedulerSettings {
  enabled: boolean;
  allowedStartHour: number;
  allowedEndHour: number;
  maxBandwidthMBps: number;
  pauseDuringActiveUse: boolean;
}

export function SchedulerPanel() {
  const [settings, setSettings] = useState<SchedulerSettings>({
    enabled: false,
    allowedStartHour: 0,
    allowedEndHour: 23,
    maxBandwidthMBps: 0, // 0 means unlimited
    pauseDuringActiveUse: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/offline/scheduler");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      // Use defaults if settings don't exist yet (expected on first load)
      logger.debug("Failed to load scheduler settings, using defaults", {
        component: "SchedulerPanel",
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

      const response = await fetch("/api/offline/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      notifications.show({
        title: "Scheduler settings saved",
        message: "Download scheduler has been updated successfully",
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

  const handleChange = <K extends keyof SchedulerSettings>(
    field: K,
    value: SchedulerSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Format hour for display
  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  // Check if downloads are currently allowed
  const currentHour = new Date().getHours();
  const isCurrentlyAllowed = settings.enabled
    ? currentHour >= settings.allowedStartHour &&
      currentHour < settings.allowedEndHour
    : true;

  return (
    <Stack gap="md">
      {/* Enable Scheduler */}
      <Box>
        <Switch
          label={
            <div>
              <Text size="sm" fw={600}>
                Enable Download Scheduler
              </Text>
              <Text size="xs" c="dimmed">
                Control when downloads are allowed to run
              </Text>
            </div>
          }
          checked={settings.enabled}
          onChange={(event) =>
            handleChange("enabled", event.currentTarget.checked)
          }
          disabled={loading}
        />
      </Box>

      {settings.enabled && (
        <>
          {/* Allowed Hours */}
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Download Window
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              Downloads will only run during these hours
            </Text>
            <Group gap="md" grow>
              <Select
                label="Start Time"
                value={settings.allowedStartHour.toString()}
                onChange={(value) =>
                  handleChange("allowedStartHour", parseInt(value || "0"))
                }
                data={Array.from({ length: 24 }, (_, i) => ({
                  value: i.toString(),
                  label: formatHour(i),
                }))}
                disabled={loading}
              />
              <Select
                label="End Time"
                value={settings.allowedEndHour.toString()}
                onChange={(value) =>
                  handleChange("allowedEndHour", parseInt(value || "23"))
                }
                data={Array.from({ length: 24 }, (_, i) => ({
                  value: i.toString(),
                  label: formatHour(i),
                }))}
                disabled={loading}
              />
            </Group>
          </Box>

          {/* Current Status */}
          <Alert
            icon={isCurrentlyAllowed ? <Clock size={16} /> : <AlertCircle size={16} />}
            title={isCurrentlyAllowed ? "Downloads Active" : "Downloads Paused"}
            color={isCurrentlyAllowed ? "green" : "yellow"}
            variant="light"
          >
            <Text size="sm">
              {isCurrentlyAllowed
                ? `Downloads are currently allowed (${formatHour(currentHour)})`
                : `Downloads are paused until ${formatHour(settings.allowedStartHour)}`}
            </Text>
          </Alert>

          {/* Bandwidth Limit */}
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Bandwidth Limit
            </Text>
            <NumberInput
              value={settings.maxBandwidthMBps}
              onChange={(value) =>
                handleChange("maxBandwidthMBps", Number(value) || 0)
              }
              min={0}
              max={1000}
              step={0.5}
              suffix=" MB/s"
              description="Maximum download speed (0 = unlimited)"
              disabled={loading}
              leftSection={<Zap size={16} />}
            />
          </Box>

          {/* Pause During Active Use */}
          <Box>
            <Switch
              label={
                <div>
                  <Text size="sm" fw={600}>
                    Pause During Active Use
                  </Text>
                  <Text size="xs" c="dimmed">
                    Automatically pause downloads when actively reading manga
                  </Text>
                </div>
              }
              checked={settings.pauseDuringActiveUse}
              onChange={(event) =>
                handleChange("pauseDuringActiveUse", event.currentTarget.checked)
              }
              disabled={loading}
            />
          </Box>
        </>
      )}

      {/* Info Alert */}
      {!settings.enabled && (
        <Alert
          icon={<AlertCircle size={16} />}
          title="Scheduler Disabled"
          color="blue"
          variant="light"
        >
          <Text size="sm">
            Downloads will run immediately when queued. Enable the scheduler to
            control when downloads are allowed.
          </Text>
        </Alert>
      )}

      {/* Save Button */}
      <Group justify="flex-end" mt="md">
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

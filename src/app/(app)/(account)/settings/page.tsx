"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { AlertTriangle, RefreshCw, Sidebar } from "lucide-react";
import { nukeUserData, updateCacheSettings, fetchCacheSettings } from "@/lib/api";
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_FORM = {
  enabled: true,
  ttlDays: 7,
  maxEntries: 32,
};

export default function SettingsPage() {
  const { sidebarWidth, setSidebarWidth } = useUIStore();
  const imageCache = useSettingsStore((state) => state.imageCache);
  const setImageCache = useSettingsStore((state) => state.setImageCache);
  const applyServerImageCacheSettings = useSettingsStore(
    (state) => state.applyServerImageCacheSettings,
  );

  const [isNuking, setIsNuking] = useState(false);
  const [isSavingCache, setIsSavingCache] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [cacheForm, setCacheForm] = useState(() => ({
    enabled: imageCache.enabled,
    ttlDays: Number(imageCache.ttlDays.toFixed(2)),
    maxEntries: imageCache.maxEntries,
  }));

  useEffect(() => {
    setCacheForm({
      enabled: imageCache.enabled,
      ttlDays: Number(imageCache.ttlDays.toFixed(2)),
      maxEntries: imageCache.maxEntries,
    });
  }, [imageCache.enabled, imageCache.ttlDays, imageCache.maxEntries]);

  const hasCacheChanges = useMemo(() => {
    return (
      cacheForm.enabled !== imageCache.enabled ||
      Number(cacheForm.ttlDays.toFixed(2)) !==
        Number(imageCache.ttlDays.toFixed(2)) ||
      cacheForm.maxEntries !== imageCache.maxEntries
    );
  }, [cacheForm, imageCache]);

  const cacheSummary = useMemo(() => {
    if (!cacheForm.enabled) {
      return "Caching disabled — covers will always load from the source.";
    }
    const ttlHours = cacheForm.ttlDays * 24;
    const prettyTtl = ttlHours < 48
      ? `${Math.max(ttlHours, 1).toFixed(0)} hour${ttlHours >= 2 ? "s" : ""}`
      : `${cacheForm.ttlDays.toFixed(1)} days`;
    return `Caching enabled — storing up to ${cacheForm.maxEntries} covers for ${prettyTtl}.`;
  }, [cacheForm]);

  const handleSaveCacheSettings = async () => {
    setIsSavingCache(true);
    try {
      const ttlMs = Math.max(0, cacheForm.ttlDays) * DAY_MS;
      const settings = await updateCacheSettings({
        enabled: cacheForm.enabled,
        ttlMs,
        maxEntries: Math.max(0, Math.round(cacheForm.maxEntries)),
      });

      applyServerImageCacheSettings(settings);
      setImageCache({
        enabled: settings.enabled,
        ttlDays: settings.ttlMs / DAY_MS,
        maxEntries: settings.maxEntries,
      });

      notifications.show({
        title: "Cache settings saved",
        message: "Cover caching preferences updated successfully.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Failed to update cache settings",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setIsSavingCache(false);
    }
  };

  const handleResetCacheSettings = () => {
    setCacheForm(DEFAULT_CACHE_FORM);
    setImageCache(DEFAULT_CACHE_FORM);
  };

  const handleRefreshCacheSettings = async () => {
    if (isRefreshingCache) return;
    setIsRefreshingCache(true);
    try {
      const settings = await fetchCacheSettings();
      applyServerImageCacheSettings(settings);
      setImageCache({
        enabled: settings.enabled,
        ttlDays: settings.ttlMs / DAY_MS,
        maxEntries: settings.maxEntries,
      });
      notifications.show({
        title: "Cache settings synced",
        message: "Pulled the latest settings from the API.",
        color: "blue",
      });
    } catch (error) {
      notifications.show({
        title: "Failed to sync settings",
        message: error instanceof Error ? error.message : "Unknown error",
        color: "red",
      });
    } finally {
      setIsRefreshingCache(false);
    }
  };

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
          <ul className="m-0 list-disc pl-6">
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
    <Stack gap="xl" p="xl" maw={900} mx="auto">
      <Stack gap="xs">
        <Title order={1}>Settings</Title>
        <Text c="dimmed">
          Tune the reader experience, caching behaviour, and maintenance tools.
        </Text>
      </Stack>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <div>
            <Title order={2} size="h3">
              Interface
            </Title>
            <Text size="sm" c="dimmed">
              Adjust layout preferences for navigation elements.
            </Text>
          </div>

          <Box>
            <Group gap="xs" mb="xs">
              <Sidebar size={16} />
              <Text size="sm" fw={500}>
                Sidebar Width
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              ({MIN_SIDEBAR_WIDTH}px – {MAX_SIDEBAR_WIDTH}px)
            </Text>
            <Group align="center" gap="md">
              <Slider
                value={sidebarWidth}
                onChange={setSidebarWidth}
                min={MIN_SIDEBAR_WIDTH}
                max={MAX_SIDEBAR_WIDTH}
                step={10}
                marks={[
                  { value: MIN_SIDEBAR_WIDTH, label: `${MIN_SIDEBAR_WIDTH}px` },
                  { value: 260, label: "Default" },
                  { value: MAX_SIDEBAR_WIDTH, label: `${MAX_SIDEBAR_WIDTH}px` },
                ]}
                className="flex-1"
              />
              <Text size="sm" fw={500} w={60} ta="center">
                {sidebarWidth}px
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => setSidebarWidth(260)}
              >
                Reset
              </Button>
            </Group>
          </Box>
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <div>
            <Title order={2} size="h3">
              Performance & Cache
            </Title>
            <Text size="sm" c="dimmed">
              Control how aggressively JAMRA caches cover art to keep the
              Discover page instant.
            </Text>
          </div>

          <Switch
            checked={cacheForm.enabled}
            onChange={(event) =>
              setCacheForm((prev) => ({
                ...prev,
                enabled: event.currentTarget.checked,
              }))
            }
            label="Enable cover image caching"
          />

          <NumberInput
            label="Cache TTL"
            description="How long covers stay cached before refreshing"
            value={cacheForm.ttlDays}
            onChange={(value) =>
              setCacheForm((prev) => ({
                ...prev,
                ttlDays: typeof value === "number" ? Math.max(value, 0) : 0,
              }))
            }
            min={0}
            max={30}
            step={0.5}
            decimalScale={2}
            suffix=" days"
            disabled={!cacheForm.enabled}
          />

          <NumberInput
            label="Cache Size"
            description="Maximum number of covers to keep per device"
            value={cacheForm.maxEntries}
            onChange={(value) =>
              setCacheForm((prev) => ({
                ...prev,
                maxEntries:
                  typeof value === "number" ? Math.max(0, Math.round(value)) : 0,
              }))
            }
            min={0}
            max={200}
            step={1}
            disabled={!cacheForm.enabled}
          />

          <Group gap="sm" mt="sm">
            <Button
              onClick={handleSaveCacheSettings}
              loading={isSavingCache}
              disabled={!hasCacheChanges && !isSavingCache}
            >
              Save cache settings
            </Button>
            <Button
              variant="light"
              onClick={handleRefreshCacheSettings}
              loading={isRefreshingCache}
              leftSection={<RefreshCw size={16} />}
            >
              Sync from API
            </Button>
            <Button
              variant="subtle"
              onClick={handleResetCacheSettings}
              disabled={
                cacheForm.enabled === DEFAULT_CACHE_FORM.enabled &&
                cacheForm.ttlDays === DEFAULT_CACHE_FORM.ttlDays &&
                cacheForm.maxEntries === DEFAULT_CACHE_FORM.maxEntries
              }
            >
              Reset to defaults
            </Button>
          </Group>

          <Alert color={cacheForm.enabled ? "green" : "gray"}>
            <Text size="sm">{cacheSummary}</Text>
          </Alert>
        </Stack>
      </Paper>

      <Paper
        withBorder
        p="lg"
        radius="md"
        className="border border-[var(--mantine-color-red-6)] bg-[var(--mantine-color-red-0)]"
      >
        <Stack gap="md">
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
      </Paper>
    </Stack>
  );
}

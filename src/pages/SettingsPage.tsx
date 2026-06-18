import {
  Card,
  Divider,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import React, { type ChangeEvent, useEffect } from "react";
import {
  DEFAULT_SETTINGS,
  DOWNLOAD_QUALITY_OPTIONS,
  PAGE_FIT_OPTIONS,
  PAGE_TURN_MODE_OPTIONS,
  READING_DIRECTION_OPTIONS,
  SETTING_KEYS,
  THEME_OPTIONS,
  getScopeFromKey,
} from "../constants";
import {
  useSetting,
  useUpdateSetting,
} from "../hooks/queries/useSettingsQueries";
export const SettingsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-6xl">
      <Title order={1} className="mb-2">
        Settings
      </Title>
      <Text c="dimmed" className="mb-6">
        Manage application preferences and behavior.
      </Text>

      <Stack gap="lg">
        {/* Window Behavior (Desktop) */}
        <Card withBorder padding="xl" radius="lg">
          <Stack gap="md">
            <div>
              <Text fw={600}>Window Behavior</Text>
              <Text size="sm" c="dimmed">
                Control how the application window behaves when closed.
              </Text>
            </div>
            <MinimizeToTraySwitch />
          </Stack>
        </Card>

        {/* Appearance Settings */}
        <Card withBorder padding="xl" radius="lg">
          <Stack gap="md">
            <div>
              <Text fw={600}>Appearance</Text>
              <Text size="sm" c="dimmed">
                Customize the look and feel of the application.
              </Text>
            </div>
            <SettingSelect
              settingKey={SETTING_KEYS.APP.THEME}
              label="Theme"
              description="Choose your preferred color theme"
              data={THEME_OPTIONS}
            />
          </Stack>
        </Card>

        {/* Reader Preferences */}
        <Card withBorder padding="xl" radius="lg">
          <Stack gap="md">
            <div>
              <Text fw={600}>Reader Preferences</Text>
              <Text size="sm" c="dimmed">
                Configure how manga pages are displayed and navigated.
              </Text>
            </div>
            <SettingSelect
              settingKey={SETTING_KEYS.READER.PAGE_FIT}
              label="Page Fit"
              description="How pages should fit on your screen"
              data={PAGE_FIT_OPTIONS}
            />
            <Divider />
            <SettingSelect
              settingKey={SETTING_KEYS.READER.READING_DIRECTION}
              label="Reading Direction"
              description="Direction for navigating pages"
              data={READING_DIRECTION_OPTIONS}
            />
            <Divider />
            <SettingSelect
              settingKey={SETTING_KEYS.READER.PAGE_TURN_MODE}
              label="Page Turn Mode"
              description="How to advance to the next page"
              data={PAGE_TURN_MODE_OPTIONS}
            />
            <Divider />
            <SettingSwitch
              settingKey={SETTING_KEYS.READER.SHOW_PAGE_NUMBERS}
              label="Show Page Numbers"
              description="Display current page number while reading"
            />
          </Stack>
        </Card>

        {/* Download Preferences */}
        <Card withBorder padding="xl" radius="lg">
          <Stack gap="md">
            <div>
              <Text fw={600}>Download Preferences</Text>
              <Text size="sm" c="dimmed">
                Control download quality and behavior.
              </Text>
            </div>
            <SettingSelect
              settingKey={SETTING_KEYS.DOWNLOADS.QUALITY}
              label="Download Quality"
              description="Image quality for downloaded chapters"
              data={DOWNLOAD_QUALITY_OPTIONS}
            />
            <Divider />
            <SettingNumber
              settingKey={SETTING_KEYS.DOWNLOADS.CONCURRENT_LIMIT}
              label="Concurrent Downloads"
              description="Maximum number of simultaneous downloads"
              min={1}
              max={10}
            />
            <Divider />
            <SettingSwitch
              settingKey={SETTING_KEYS.DOWNLOADS.AUTO_DELETE_AFTER_READ}
              label="Auto-delete After Reading"
              description="Automatically remove downloaded chapters after reading"
            />
          </Stack>
        </Card>

        {/* Catalog Settings */}
        <Card withBorder padding="xl" radius="lg">
          <Stack gap="md">
            <div>
              <Text fw={600}>Catalog Settings</Text>
              <Text size="sm" c="dimmed">
                Manage extension catalog synchronization.
              </Text>
            </div>
            <SettingSwitch
              settingKey={SETTING_KEYS.CATALOG.AUTO_SYNC}
              label="Auto-sync Catalog"
              description="Automatically sync extension catalogs on startup"
            />
            <Divider />
            <SettingNumber
              settingKey={SETTING_KEYS.CATALOG.SYNC_INTERVAL}
              label="Sync Interval (hours)"
              description="How often to check for catalog updates"
              min={1}
              max={168}
            />
          </Stack>
        </Card>
      </Stack>
    </div>
  );
};

/**
 * Select input for a setting
 */
interface SettingSelectProps {
  settingKey: string;
  label: string;
  description: string;
  data: readonly { value: string; label: string }[];
}

const SettingSelect: React.FC<SettingSelectProps> = ({
  settingKey,
  label,
  description,
  data,
}) => {
  const defaultValue = DEFAULT_SETTINGS[
    settingKey as keyof typeof DEFAULT_SETTINGS
  ] as string;
  const { data: setting, isLoading } = useSetting<string>(settingKey);
  const updateSetting = useUpdateSetting();
  const { setColorScheme } = useMantineColorScheme();

  const value = setting?.value ?? defaultValue;

  const handleChange = (newValue: string | null) => {
    if (!newValue) return;

    // Apply the Mantine color scheme immediately for instant visual feedback
    // when the user changes the Theme setting, ahead of persistence.
    if (
      settingKey === SETTING_KEYS.APP.THEME &&
      (newValue === "light" || newValue === "dark" || newValue === "auto")
    ) {
      setColorScheme(newValue);
    }

    updateSetting.mutate(
      {
        key: settingKey,
        value: newValue,
        scope: getScopeFromKey(settingKey),
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Setting Updated",
            message: `${label} has been updated`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Update Failed",
            message: error.message || "Failed to update setting",
            color: "red",
          });
        },
      },
    );
  };

  return (
    <Select
      label={label}
      description={description}
      data={[...data]}
      value={value}
      onChange={handleChange}
      disabled={isLoading || updateSetting.isPending}
    />
  );
};

/**
 * Switch input for a boolean setting
 */
interface SettingSwitchProps {
  settingKey: string;
  label: string;
  description: string;
}

const SettingSwitch: React.FC<SettingSwitchProps> = ({
  settingKey,
  label,
  description,
}) => {
  const defaultValue = DEFAULT_SETTINGS[
    settingKey as keyof typeof DEFAULT_SETTINGS
  ] as boolean;
  const { data: setting, isLoading } = useSetting<boolean>(settingKey);
  const updateSetting = useUpdateSetting();

  const checked = setting?.value ?? defaultValue;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.currentTarget.checked;

    updateSetting.mutate(
      {
        key: settingKey,
        value: newValue,
        scope: getScopeFromKey(settingKey),
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Setting Updated",
            message: `${label} has been updated`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Update Failed",
            message: error.message || "Failed to update setting",
            color: "red",
          });
        },
      },
    );
  };

  return (
    <Switch
      label={label}
      description={description}
      checked={checked}
      onChange={handleChange}
      disabled={isLoading || updateSetting.isPending}
    />
  );
};

/**
 * Special switch for minimize-to-tray that syncs with Tauri
 */
const MinimizeToTraySwitch: React.FC = () => {
  const settingKey = SETTING_KEYS.APP.MINIMIZE_TO_TRAY;
  const defaultValue = DEFAULT_SETTINGS[settingKey] as boolean;
  const { data: setting, isLoading } = useSetting<boolean>(settingKey);
  const updateSetting = useUpdateSetting();

  const checked = setting?.value ?? defaultValue;

  // Sync to Tauri state whenever the setting changes
  useEffect(() => {
    const syncToTauri = async () => {
      try {
        await invoke("set_minimize_to_tray", { enabled: checked });
      } catch (error) {
        console.error("Failed to sync minimize-to-tray to Tauri:", error);
      }
    };

    syncToTauri();
  }, [checked]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.currentTarget.checked;

    updateSetting.mutate(
      {
        key: settingKey,
        value: newValue,
        scope: getScopeFromKey(settingKey),
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Setting Updated",
            message: "Minimize to tray preference has been updated",
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Update Failed",
            message: error.message || "Failed to update setting",
            color: "red",
          });
        },
      },
    );
  };

  return (
    <Switch
      label="Minimize to System Tray"
      description="When enabled, closing the window minimizes to tray instead of exiting"
      checked={checked}
      onChange={handleChange}
      disabled={isLoading || updateSetting.isPending}
    />
  );
};

/**
 * Number input for a numeric setting
 */
interface SettingNumberProps {
  settingKey: string;
  label: string;
  description: string;
  min: number;
  max: number;
}

const SettingNumber: React.FC<SettingNumberProps> = ({
  settingKey,
  label,
  description,
  min,
  max,
}) => {
  const defaultValue = DEFAULT_SETTINGS[
    settingKey as keyof typeof DEFAULT_SETTINGS
  ] as number;
  const { data: setting, isLoading } = useSetting<number>(settingKey);
  const updateSetting = useUpdateSetting();

  const value = setting?.value ?? defaultValue;

  const handleChange = (newValue: string | number) => {
    const numValue = typeof newValue === "string" ? parseInt(newValue) : newValue;
    if (isNaN(numValue)) return;

    updateSetting.mutate(
      {
        key: settingKey,
        value: numValue,
        scope: getScopeFromKey(settingKey),
      },
      {
        onSuccess: () => {
          notifications.show({
            title: "Setting Updated",
            message: `${label} has been updated`,
            color: "green",
          });
        },
        onError: (error) => {
          notifications.show({
            title: "Update Failed",
            message: error.message || "Failed to update setting",
            color: "red",
          });
        },
      },
    );
  };

  return (
    <NumberInput
      label={label}
      description={description}
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      disabled={isLoading || updateSetting.isPending}
    />
  );
};

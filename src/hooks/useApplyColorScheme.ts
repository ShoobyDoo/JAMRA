import { useMantineColorScheme } from "@mantine/core";
import { useEffect } from "react";
import { SETTING_KEYS } from "../constants/settings";
import { useSetting } from "./queries/useSettingsQueries";

/**
 * Reads the persisted `app.theme` setting (light | dark | auto) and applies
 * it to Mantine's color scheme so the whole app reflects the user's choice,
 * including on initial load.
 */
export const useApplyColorScheme = (): void => {
  const { setColorScheme } = useMantineColorScheme();
  const { data: themeSetting } = useSetting<string>(SETTING_KEYS.APP.THEME);

  useEffect(() => {
    if (!themeSetting?.value) return;

    if (
      themeSetting.value === "light" ||
      themeSetting.value === "dark" ||
      themeSetting.value === "auto"
    ) {
      setColorScheme(themeSetting.value);
    }
  }, [themeSetting?.value, setColorScheme]);
};

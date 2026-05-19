import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { colors } from "@/constants/app-theme";
import {
  type FontStyle,
  defaultAppSettings,
  getAppSettings,
  getFontSizeScale,
  getScreenLayoutScale,
  subscribeAppSettings,
  type AppSettings
} from "@/lib/app-settings";

export type AppPalette = Record<keyof typeof colors, string>;
export type EffectiveThemeMode = "light" | "dark";
export type AppFontWeight = "700" | "800" | "900";

const darkPalette: AppPalette = {
  background: "#0f0f0f",
  surface: "#171717",
  surfaceStrong: "#222222",
  text: "#f5f5f5",
  muted: "#b8b8b8",
  faint: "#777777",
  line: "#2a2a2a",
  darkLine: "#e5e5e5",
  inverse: "#111111",
  ink: "#ffffff"
};

export const getEffectiveThemeMode = (
  settings: AppSettings,
  systemScheme: "light" | "dark" | "unspecified" | null | undefined
) =>
  settings.themeMode === "system"
    ? systemScheme === "dark"
      ? "dark"
      : "light"
    : settings.themeMode;

export const getAppPalette = (
  settings: AppSettings,
  systemScheme: "light" | "dark" | "unspecified" | null | undefined
) => {
  const effectiveMode = getEffectiveThemeMode(settings, systemScheme);

  return effectiveMode === "dark" ? darkPalette : colors;
};

export const getFontWeightForStyle = (fontStyle: FontStyle): AppFontWeight => {
  if (fontStyle === "bold") {
    return "900";
  }

  if (fontStyle === "standard") {
    return "700";
  }

  return "800";
};

export function useAppAppearance() {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);

  useEffect(() => {
    let isActive = true;

    const loadSettings = async () => {
      const storedSettings = await getAppSettings();
      if (isActive) {
        setSettings(storedSettings);
      }
    };

    loadSettings();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeAppSettings((nextSettings) => {
        setSettings(nextSettings);
      }),
    []
  );

  const palette = useMemo(
    () => getAppPalette(settings, systemScheme),
    [settings, systemScheme]
  );
  const effectiveThemeMode = useMemo(
    () => getEffectiveThemeMode(settings, systemScheme),
    [settings, systemScheme]
  );

  return {
    settings,
    effectiveThemeMode,
    palette,
    fontSizeScale: getFontSizeScale(settings.fontSize),
    layoutScale: getScreenLayoutScale(settings.screenLayout),
    emphasisWeight: getFontWeightForStyle(settings.fontStyle)
  };
}

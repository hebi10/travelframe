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
import { getFontFamilyForStyle, useAppFontsReady } from "@/lib/app-fonts";

export type AppPalette = Record<keyof typeof colors, string>;
export type EffectiveThemeMode = "light" | "dark";
export type AppFontWeight = "700" | "800" | "900";

let cachedAppSettings: AppSettings = defaultAppSettings;
let appSettingsCacheVersion = 0;

const darkPalette: AppPalette = {
  background: "#0f0f0f",
  chrome: "#000000",
  surface: "#171717",
  surfaceStrong: "#202020",
  text: "#eeeeee",
  muted: "#d6d6d6",
  faint: "#a8a8a8",
  line: "#2d2d2d",
  darkLine: "#777777",
  inverse: "#0f0f0f",
  ink: "#f2f2f2"
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
  if (fontStyle === "black_han_sans") {
    return "900";
  }

  if (fontStyle === "gowun_dodum") {
    return "700";
  }

  return "800";
};

export function useAppAppearance() {
  const systemScheme = useColorScheme();
  const fontsReady = useAppFontsReady();
  const [settings, setSettings] = useState<AppSettings>(cachedAppSettings);

  useEffect(() => {
    let isActive = true;
    const loadVersion = appSettingsCacheVersion;

    const loadSettings = async () => {
      const storedSettings = await getAppSettings();
      if (isActive) {
        if (appSettingsCacheVersion === loadVersion) {
          cachedAppSettings = storedSettings;
          appSettingsCacheVersion += 1;
          setSettings(storedSettings);
          return;
        }

        setSettings(cachedAppSettings);
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
        cachedAppSettings = nextSettings;
        appSettingsCacheVersion += 1;
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
    emphasisWeight: getFontWeightForStyle(settings.fontStyle),
    fontFamily: getFontFamilyForStyle(settings.fontStyle, fontsReady)
  };
}

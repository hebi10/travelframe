import type { GuideType } from "@/constants/camera-guides";
import type { TripClipRatio } from "@/constants/trip-clip";
import { localStorageAdapter } from "@/lib/local-storage";

const APP_SETTINGS_KEY = "travel-frame.settings.v1";
const settingsListeners = new Set<(settings: AppSettings) => void>();

export type ExportQuality = "standard" | "high" | "max";
export type ThemeMode = "light" | "dark" | "system";
export type FontStyle = "standard" | "compact" | "bold";
export type FontSize = "small" | "medium" | "large";
export type ScreenLayout = "compact" | "balanced" | "comfortable";

export const GUIDE_SIZE_MIN = 24;
export const GUIDE_SIZE_MAX = 86;
export const GUIDE_STROKE_WIDTH_MIN = 1;
export const GUIDE_STROKE_WIDTH_MAX = 5;
export const DEFAULT_GUIDE_COLOR = "rgba(255, 255, 255, 0.78)";

export type AppSettings = {
  defaultGuide: GuideType;
  guideVisible: boolean;
  guideSize: number;
  guideStrokeWidth: number;
  guideColor: string;
  overlayOpacity: number;
  defaultRatio: TripClipRatio;
  exportQuality: ExportQuality;
  themeMode: ThemeMode;
  fontStyle: FontStyle;
  fontSize: FontSize;
  screenLayout: ScreenLayout;
  cloudBackupEnabled: boolean;
};

export const defaultAppSettings: AppSettings = {
  defaultGuide: "circle",
  guideVisible: true,
  guideSize: 44,
  guideStrokeWidth: 1,
  guideColor: DEFAULT_GUIDE_COLOR,
  overlayOpacity: 0.4,
  defaultRatio: "9:16",
  exportQuality: "high",
  themeMode: "light",
  fontStyle: "compact",
  fontSize: "medium",
  screenLayout: "compact",
  cloudBackupEnabled: false
};

const themeModes: ThemeMode[] = ["light", "dark", "system"];
const fontStyles: FontStyle[] = ["standard", "compact", "bold"];
const fontSizes: FontSize[] = ["small", "medium", "large"];
const screenLayouts: ScreenLayout[] = ["compact", "balanced", "comfortable"];
const exportQualities: ExportQuality[] = ["standard", "high", "max"];
const tripClipRatios: TripClipRatio[] = ["9:16", "4:5", "1:1", "16:9", "3:4"];

const clampGuideSize = (value: unknown) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultAppSettings.guideSize;
  }

  return Math.round(Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, parsedValue)));
};

const clampGuideStrokeWidth = (value: unknown) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultAppSettings.guideStrokeWidth;
  }

  return Math.round(
    Math.max(GUIDE_STROKE_WIDTH_MIN, Math.min(GUIDE_STROKE_WIDTH_MAX, parsedValue))
  );
};

const normalizeSettings = (value: Partial<AppSettings> | null): AppSettings => {
  const nextSettings = {
    ...defaultAppSettings,
    ...(value ?? {})
  };

  return {
    ...nextSettings,
    guideVisible:
      typeof nextSettings.guideVisible === "boolean"
        ? nextSettings.guideVisible
        : defaultAppSettings.guideVisible,
    guideSize: clampGuideSize(nextSettings.guideSize),
    guideStrokeWidth: clampGuideStrokeWidth(nextSettings.guideStrokeWidth),
    guideColor:
      typeof nextSettings.guideColor === "string" && nextSettings.guideColor.trim()
        ? nextSettings.guideColor
        : defaultAppSettings.guideColor,
    defaultRatio: tripClipRatios.includes(nextSettings.defaultRatio)
      ? nextSettings.defaultRatio
      : defaultAppSettings.defaultRatio,
    exportQuality: exportQualities.includes(nextSettings.exportQuality)
      ? nextSettings.exportQuality
      : defaultAppSettings.exportQuality,
    themeMode: themeModes.includes(nextSettings.themeMode)
      ? nextSettings.themeMode
      : defaultAppSettings.themeMode,
    fontStyle: fontStyles.includes(nextSettings.fontStyle)
      ? nextSettings.fontStyle
      : defaultAppSettings.fontStyle,
    fontSize: fontSizes.includes(nextSettings.fontSize)
      ? nextSettings.fontSize
      : defaultAppSettings.fontSize,
    screenLayout: screenLayouts.includes(nextSettings.screenLayout)
      ? nextSettings.screenLayout
      : defaultAppSettings.screenLayout,
    cloudBackupEnabled:
      typeof nextSettings.cloudBackupEnabled === "boolean"
        ? nextSettings.cloudBackupEnabled
        : defaultAppSettings.cloudBackupEnabled
  };
};

export const getAppSettings = async () => {
  const value = await localStorageAdapter.getItem(APP_SETTINGS_KEY);

  if (!value) {
    return defaultAppSettings;
  }

  try {
    return normalizeSettings(JSON.parse(value) as Partial<AppSettings>);
  } catch {
    return defaultAppSettings;
  }
};

export const saveAppSettings = async (settings: AppSettings) => {
  const normalizedSettings = normalizeSettings(settings);
  await localStorageAdapter.setItem(
    APP_SETTINGS_KEY,
    JSON.stringify(normalizedSettings)
  );
  settingsListeners.forEach((listener) => listener(normalizedSettings));
  return normalizedSettings;
};

export const updateAppSettings = async (updates: Partial<AppSettings>) => {
  const current = await getAppSettings();
  return saveAppSettings({
    ...current,
    ...updates
  });
};

export const subscribeAppSettings = (listener: (settings: AppSettings) => void) => {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
};

export const getExportQualityCompression = (quality: ExportQuality) => {
  if (quality === "max") {
    return 0.98;
  }

  if (quality === "standard") {
    return 0.86;
  }

  return 0.94;
};

export const getUploadCompression = (quality: ExportQuality) => {
  if (quality === "max") {
    return 0.92;
  }

  if (quality === "standard") {
    return 0.8;
  }

  return 0.86;
};

export const getFontSizeScale = (fontSize: FontSize) => {
  if (fontSize === "small") {
    return 0.92;
  }

  if (fontSize === "large") {
    return 1.1;
  }

  return 1;
};

export const getScreenLayoutScale = (layout: ScreenLayout) => {
  if (layout === "balanced") {
    return 1.08;
  }

  if (layout === "comfortable") {
    return 1.18;
  }

  return 1;
};

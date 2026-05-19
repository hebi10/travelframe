import type { GuideType } from "@/constants/camera-guides";
import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_QUALITY_OPTIONS,
  type ImageQuality
} from "@/constants/image";
import type { TripClipRatio } from "@/constants/trip-clip";
import {
  DEFAULT_VIDEO_QUALITY,
  VIDEO_QUALITY_OPTIONS,
  type VideoQualityId
} from "@/constants/video";
import type { PhotoRatioLabel } from "@/types/photo";
import { localStorageAdapter } from "@/lib/local-storage";

const APP_SETTINGS_KEY = "travel-frame.settings.v1";
const settingsListeners = new Set<(settings: AppSettings) => void>();

export type ExportQuality = "standard" | "high" | "max";
export type ThemeMode = "light" | "dark" | "system";
export type FontStyle = "standard" | "compact" | "bold";
export type FontSize = "small" | "medium" | "large";
export type ScreenLayout = "compact" | "balanced" | "comfortable";
export type CameraSaveScope = "app" | "device" | "both";
export type TripClipExportFormat = "mp4" | "images";
export type AppImageSaveFormat = "original" | "png" | "jpeg";

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
  guideOffsetX: number;
  guideOffsetY: number;
  overlayOpacity: number;
  cameraRatio: PhotoRatioLabel;
  cameraSaveScope: CameraSaveScope;
  defaultRatio: TripClipRatio;
  exportQuality: ExportQuality;
  videoQuality: VideoQualityId;
  tripClipExportFormat: TripClipExportFormat;
  imageSaveFormat: AppImageSaveFormat;
  themeMode: ThemeMode;
  fontStyle: FontStyle;
  fontSize: FontSize;
  screenLayout: ScreenLayout;
  cloudBackupEnabled: boolean;
  imageBackupQuality: ImageQuality;
};

export const defaultAppSettings: AppSettings = {
  defaultGuide: "circle",
  guideVisible: true,
  guideSize: 44,
  guideStrokeWidth: 1,
  guideColor: DEFAULT_GUIDE_COLOR,
  guideOffsetX: 0,
  guideOffsetY: 0,
  overlayOpacity: 0.4,
  cameraRatio: "Original",
  cameraSaveScope: "app",
  defaultRatio: "9:16",
  exportQuality: "high",
  videoQuality: DEFAULT_VIDEO_QUALITY,
  tripClipExportFormat: "mp4",
  imageSaveFormat: "original",
  themeMode: "light",
  fontStyle: "compact",
  fontSize: "medium",
  screenLayout: "compact",
  cloudBackupEnabled: false,
  imageBackupQuality: DEFAULT_IMAGE_QUALITY
};

const themeModes: ThemeMode[] = ["light", "dark", "system"];
const fontStyles: FontStyle[] = ["standard", "compact", "bold"];
const fontSizes: FontSize[] = ["small", "medium", "large"];
const screenLayouts: ScreenLayout[] = ["compact", "balanced", "comfortable"];
const exportQualities: ExportQuality[] = ["standard", "high", "max"];
const videoQualities = VIDEO_QUALITY_OPTIONS.map((option) => option.id);
const tripClipExportFormats: TripClipExportFormat[] = ["mp4", "images"];
const imageSaveFormats: AppImageSaveFormat[] = ["original", "png", "jpeg"];
const imageBackupQualities = IMAGE_QUALITY_OPTIONS.map((option) => option.value);
const cameraRatios: PhotoRatioLabel[] = ["Original", "1:1", "3:4", "4:5", "9:16", "16:9"];
const cameraSaveScopes: CameraSaveScope[] = ["app", "device", "both"];
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

const normalizeGuideOffset = (value: unknown) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : 0;
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
    guideOffsetX: normalizeGuideOffset(nextSettings.guideOffsetX),
    guideOffsetY: normalizeGuideOffset(nextSettings.guideOffsetY),
    cameraRatio: cameraRatios.includes(nextSettings.cameraRatio)
      ? nextSettings.cameraRatio
      : defaultAppSettings.cameraRatio,
    cameraSaveScope: cameraSaveScopes.includes(nextSettings.cameraSaveScope)
      ? nextSettings.cameraSaveScope
      : defaultAppSettings.cameraSaveScope,
    defaultRatio: tripClipRatios.includes(nextSettings.defaultRatio)
      ? nextSettings.defaultRatio
      : defaultAppSettings.defaultRatio,
    exportQuality: exportQualities.includes(nextSettings.exportQuality)
      ? nextSettings.exportQuality
      : defaultAppSettings.exportQuality,
    videoQuality: videoQualities.includes(nextSettings.videoQuality)
      ? nextSettings.videoQuality
      : defaultAppSettings.videoQuality,
    tripClipExportFormat: tripClipExportFormats.includes(nextSettings.tripClipExportFormat)
      ? nextSettings.tripClipExportFormat
      : defaultAppSettings.tripClipExportFormat,
    imageSaveFormat: imageSaveFormats.includes(nextSettings.imageSaveFormat)
      ? nextSettings.imageSaveFormat
      : defaultAppSettings.imageSaveFormat,
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
        : defaultAppSettings.cloudBackupEnabled,
    imageBackupQuality: imageBackupQualities.includes(nextSettings.imageBackupQuality)
      ? nextSettings.imageBackupQuality
      : defaultAppSettings.imageBackupQuality
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

export const hasStoredAppSettings = async () => {
  const value = await localStorageAdapter.getItem(APP_SETTINGS_KEY);
  return Boolean(value);
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

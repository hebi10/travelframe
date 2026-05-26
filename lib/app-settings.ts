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
export type FontStyle = "noto_sans_kr" | "nanum_gothic" | "gowun_dodum" | "gugi" | "black_han_sans";
export type FontSize = "small" | "medium" | "large";
export type ScreenLayout = "compact" | "balanced" | "comfortable";
export type CameraSaveScope = "app" | "device" | "both";
export type CameraFacing = "back" | "front";
export type CameraShutterSoundMode = "silent" | "sound";
export type TripClipExportFormat = "mp4" | "images";
export type AppImageSaveFormat = "original" | "png" | "jpeg";
export type StorageMode = "local_only" | "local_backup" | "local_saver";
export type CloudBackupTarget = "photos" | "imageBundles" | "videos" | "music";
export type CloudBackupTargets = Record<CloudBackupTarget, boolean>;
export type GridGuideLineKey =
  | "verticalStart"
  | "verticalEnd"
  | "horizontalStart"
  | "horizontalEnd";
export type GridGuideLinePositions = Record<GridGuideLineKey, number>;
export type GuideShapeKey = "cross" | "triangle" | "square";
export type GuideShapePoint = {
  x: number;
  y: number;
};
export type GuideShapePoints = Record<GuideShapeKey, GuideShapePoint[]>;

export const GUIDE_SIZE_MIN = 24;
export const GUIDE_SIZE_MAX = 86;
export const SHAPE_GUIDE_SIZE_MIN = 4;
export const SHAPE_GUIDE_SIZE_MAX = 160;
export const GUIDE_STROKE_WIDTH_MIN = 1;
export const GUIDE_STROKE_WIDTH_MAX = 5;
export const DEFAULT_GUIDE_COLOR = "rgba(255, 255, 255, 0.78)";

export const getGuideSizeBounds = (guide: GuideType) =>
  guide === "triangle" || guide === "square"
    ? { min: SHAPE_GUIDE_SIZE_MIN, max: SHAPE_GUIDE_SIZE_MAX }
    : { min: GUIDE_SIZE_MIN, max: GUIDE_SIZE_MAX };
export const defaultGridGuideLinePositions: GridGuideLinePositions = {
  verticalStart: 28,
  verticalEnd: 72,
  horizontalStart: 28,
  horizontalEnd: 72
};
export const defaultGuideShapePoints: GuideShapePoints = {
  cross: [
    { x: 16, y: 50 },
    { x: 84, y: 50 },
    { x: 50, y: 16 },
    { x: 50, y: 84 }
  ],
  triangle: [
    { x: 50, y: 14 },
    { x: 84, y: 82 },
    { x: 16, y: 82 }
  ],
  square: [
    { x: 18, y: 18 },
    { x: 82, y: 18 },
    { x: 82, y: 82 },
    { x: 18, y: 82 }
  ]
};

export type AppSettings = {
  defaultGuide: GuideType;
  guideVisible: boolean;
  guideSize: number;
  guideStrokeWidth: number;
  guideColor: string;
  guideOffsetX: number;
  guideOffsetY: number;
  gridGuideLinePositions: GridGuideLinePositions;
  guideShapePoints: GuideShapePoints;
  overlayOpacity: number;
  cameraZoomPercent: number;
  cameraTorchEnabled: boolean;
  cameraFacing: CameraFacing;
  cameraRatio: PhotoRatioLabel;
  cameraSaveScope: CameraSaveScope;
  cameraShutterSoundMode: CameraShutterSoundMode;
  defaultRatio: TripClipRatio;
  exportQuality: ExportQuality;
  videoQuality: VideoQualityId;
  tripClipExportFormat: TripClipExportFormat;
  imageSaveFormat: AppImageSaveFormat;
  themeMode: ThemeMode;
  fontStyle: FontStyle;
  fontSize: FontSize;
  screenLayout: ScreenLayout;
  storageMode: StorageMode;
  cloudBackupEnabled: boolean;
  cloudBackupTargets: CloudBackupTargets;
  imageBackupQuality: ImageQuality;
};

export const defaultCloudBackupTargets: CloudBackupTargets = {
  photos: true,
  imageBundles: true,
  videos: true,
  music: true
};

export const defaultAppSettings: AppSettings = {
  defaultGuide: "circle",
  guideVisible: true,
  guideSize: 44,
  guideStrokeWidth: 1,
  guideColor: DEFAULT_GUIDE_COLOR,
  guideOffsetX: 0,
  guideOffsetY: 0,
  gridGuideLinePositions: defaultGridGuideLinePositions,
  guideShapePoints: defaultGuideShapePoints,
  overlayOpacity: 0.4,
  cameraZoomPercent: 0,
  cameraTorchEnabled: false,
  cameraFacing: "back",
  cameraRatio: "Original",
  cameraSaveScope: "app",
  cameraShutterSoundMode: "silent",
  defaultRatio: "9:16",
  exportQuality: "high",
  videoQuality: DEFAULT_VIDEO_QUALITY,
  tripClipExportFormat: "mp4",
  imageSaveFormat: "original",
  themeMode: "light",
  fontStyle: "noto_sans_kr",
  fontSize: "medium",
  screenLayout: "compact",
  storageMode: "local_only",
  cloudBackupEnabled: false,
  cloudBackupTargets: defaultCloudBackupTargets,
  imageBackupQuality: DEFAULT_IMAGE_QUALITY
};

const themeModes: ThemeMode[] = ["light", "dark", "system"];
const fontStyles: FontStyle[] = [
  "noto_sans_kr",
  "nanum_gothic",
  "gowun_dodum",
  "gugi",
  "black_han_sans"
];
const legacyFontStyles = ["standard", "compact", "bold"];
const fontSizes: FontSize[] = ["small", "medium", "large"];
const screenLayouts: ScreenLayout[] = ["compact", "balanced", "comfortable"];
const exportQualities: ExportQuality[] = ["standard", "high", "max"];
const videoQualities = VIDEO_QUALITY_OPTIONS.map((option) => option.id);
const tripClipExportFormats: TripClipExportFormat[] = ["mp4", "images"];
const imageSaveFormats: AppImageSaveFormat[] = ["original", "png", "jpeg"];
const storageModes: StorageMode[] = ["local_only", "local_backup", "local_saver"];
const imageBackupQualities = IMAGE_QUALITY_OPTIONS.map((option) => option.value);
const cameraRatios: PhotoRatioLabel[] = ["Original", "1:1", "3:4", "4:5", "9:16", "16:9"];
const cameraSaveScopes: CameraSaveScope[] = ["app", "device", "both"];
const cameraFacings: CameraFacing[] = ["back", "front"];
const cameraShutterSoundModes: CameraShutterSoundMode[] = ["silent", "sound"];
const tripClipRatios: TripClipRatio[] = ["9:16", "4:5", "1:1", "16:9", "3:4"];
const cloudBackupTargetKeys: CloudBackupTarget[] = [
  "photos",
  "imageBundles",
  "videos",
  "music"
];

const clampGuideSize = (value: unknown, guide: GuideType) => {
  const guideSizeBounds = getGuideSizeBounds(guide);
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultAppSettings.guideSize;
  }

  return Math.round(
    Math.max(guideSizeBounds.min, Math.min(guideSizeBounds.max, parsedValue))
  );
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

const normalizeGridGuideLinePosition = (
  value: unknown,
  fallback: number
) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.round(Math.max(2, Math.min(98, parsedValue)) * 10) / 10;
};

const normalizeGridGuideLinePositions = (
  value: unknown
): GridGuideLinePositions => {
  const storedPositions =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<GridGuideLinePositions>)
      : {};
  const verticalStart = normalizeGridGuideLinePosition(
    storedPositions.verticalStart,
    defaultGridGuideLinePositions.verticalStart
  );
  const verticalEnd = normalizeGridGuideLinePosition(
    storedPositions.verticalEnd,
    defaultGridGuideLinePositions.verticalEnd
  );
  const horizontalStart = normalizeGridGuideLinePosition(
    storedPositions.horizontalStart,
    defaultGridGuideLinePositions.horizontalStart
  );
  const horizontalEnd = normalizeGridGuideLinePosition(
    storedPositions.horizontalEnd,
    defaultGridGuideLinePositions.horizontalEnd
  );
  const boundedVerticalStart = Math.min(verticalStart, 94);
  const boundedHorizontalStart = Math.min(horizontalStart, 94);

  return {
    verticalStart: boundedVerticalStart,
    verticalEnd: Math.max(verticalEnd, boundedVerticalStart + 4),
    horizontalStart: boundedHorizontalStart,
    horizontalEnd: Math.max(horizontalEnd, boundedHorizontalStart + 4)
  };
};

const normalizeGuideShapePointValue = (value: unknown, fallback: number) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.round(Math.max(2, Math.min(98, parsedValue)) * 10) / 10;
};

const normalizeGuideShapePoint = (
  value: unknown,
  fallback: GuideShapePoint
): GuideShapePoint => {
  const storedPoint =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<GuideShapePoint>)
      : {};

  return {
    x: normalizeGuideShapePointValue(storedPoint.x, fallback.x),
    y: normalizeGuideShapePointValue(storedPoint.y, fallback.y)
  };
};

const normalizeGuideShapePointList = (
  value: unknown,
  fallback: GuideShapePoint[]
) => {
  const storedPoints = Array.isArray(value) ? value : [];

  return fallback.map((fallbackPoint, index) =>
    normalizeGuideShapePoint(storedPoints[index], fallbackPoint)
  );
};

const normalizeGuideShapePoints = (value: unknown): GuideShapePoints => {
  const storedShapes =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<GuideShapePoints>)
      : {};

  return {
    cross: normalizeGuideShapePointList(
      storedShapes.cross,
      defaultGuideShapePoints.cross
    ),
    triangle: normalizeGuideShapePointList(
      storedShapes.triangle,
      defaultGuideShapePoints.triangle
    ),
    square: normalizeGuideShapePointList(
      storedShapes.square,
      defaultGuideShapePoints.square
    )
  };
};

const normalizeCameraZoomPercent = (value: unknown) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return defaultAppSettings.cameraZoomPercent;
  }

  return Math.round(Math.max(0, Math.min(100, parsedValue)));
};

export const normalizeCloudBackupTargets = (value: unknown): CloudBackupTargets => {
  const storedTargets =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<CloudBackupTargets>)
      : {};

  return cloudBackupTargetKeys.reduce<CloudBackupTargets>(
    (targets, target) => ({
      ...targets,
      [target]:
        typeof storedTargets[target] === "boolean"
          ? storedTargets[target]
          : defaultCloudBackupTargets[target]
    }),
    { ...defaultCloudBackupTargets }
  );
};

export const isCloudBackupTargetEnabled = (
  settings: Pick<AppSettings, "cloudBackupTargets">,
  target: CloudBackupTarget
) => settings.cloudBackupTargets[target] !== false;

const normalizeSettings = (value: Partial<AppSettings> | null): AppSettings => {
  const nextSettings = {
    ...defaultAppSettings,
    ...(value ?? {})
  };
  const hasStoredStorageMode =
    value?.storageMode !== undefined && storageModes.includes(value.storageMode);

  return {
    ...nextSettings,
    guideVisible:
      typeof nextSettings.guideVisible === "boolean"
        ? nextSettings.guideVisible
        : defaultAppSettings.guideVisible,
    guideSize: clampGuideSize(nextSettings.guideSize, nextSettings.defaultGuide),
    guideStrokeWidth: clampGuideStrokeWidth(nextSettings.guideStrokeWidth),
    guideColor:
      typeof nextSettings.guideColor === "string" && nextSettings.guideColor.trim()
        ? nextSettings.guideColor
        : defaultAppSettings.guideColor,
    guideOffsetX: normalizeGuideOffset(nextSettings.guideOffsetX),
    guideOffsetY: normalizeGuideOffset(nextSettings.guideOffsetY),
    gridGuideLinePositions: normalizeGridGuideLinePositions(nextSettings.gridGuideLinePositions),
    guideShapePoints: normalizeGuideShapePoints(nextSettings.guideShapePoints),
    cameraZoomPercent: normalizeCameraZoomPercent(nextSettings.cameraZoomPercent),
    cameraTorchEnabled:
      typeof nextSettings.cameraTorchEnabled === "boolean"
        ? nextSettings.cameraTorchEnabled
        : defaultAppSettings.cameraTorchEnabled,
    cameraFacing: cameraFacings.includes(nextSettings.cameraFacing)
      ? nextSettings.cameraFacing
      : defaultAppSettings.cameraFacing,
    cameraRatio: cameraRatios.includes(nextSettings.cameraRatio)
      ? nextSettings.cameraRatio
      : defaultAppSettings.cameraRatio,
    cameraSaveScope: cameraSaveScopes.includes(nextSettings.cameraSaveScope)
      ? nextSettings.cameraSaveScope
      : defaultAppSettings.cameraSaveScope,
    cameraShutterSoundMode: cameraShutterSoundModes.includes(nextSettings.cameraShutterSoundMode)
      ? nextSettings.cameraShutterSoundMode
      : defaultAppSettings.cameraShutterSoundMode,
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
      : legacyFontStyles.includes(String(nextSettings.fontStyle))
        ? defaultAppSettings.fontStyle
      : defaultAppSettings.fontStyle,
    fontSize: fontSizes.includes(nextSettings.fontSize)
      ? nextSettings.fontSize
      : defaultAppSettings.fontSize,
    screenLayout: screenLayouts.includes(nextSettings.screenLayout)
      ? nextSettings.screenLayout
      : defaultAppSettings.screenLayout,
    storageMode: hasStoredStorageMode
      ? nextSettings.storageMode
      : nextSettings.cloudBackupEnabled ? "local_backup" : "local_only",
    cloudBackupEnabled: hasStoredStorageMode
      ? nextSettings.storageMode !== "local_only"
      :
      typeof nextSettings.cloudBackupEnabled === "boolean"
        ? nextSettings.cloudBackupEnabled
        : storageModes.includes(nextSettings.storageMode)
          ? nextSettings.storageMode !== "local_only"
          : defaultAppSettings.cloudBackupEnabled,
    cloudBackupTargets: normalizeCloudBackupTargets(nextSettings.cloudBackupTargets),
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
    return 1.22;
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

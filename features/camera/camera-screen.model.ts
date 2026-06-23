import { getCameraDevice, type CameraDevice, type CameraPosition, type DeviceFilter, type FlashMode, type MeteringMode, type PhysicalDeviceType } from "react-native-vision-camera";

import { DEFAULT_GUIDE_COLOR, type AppSettings, type CameraFacing, type CameraSaveTarget } from "@/lib/app-settings";
import type { PhotoRatioLabel } from "@/types/photo";

export const GUIDE_SIZE_OPTIONS = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;
export const GUIDE_STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 5] as const;
export const OVERLAY_OPACITY_MIN = 10;
export const OVERLAY_OPACITY_MAX = 85;
export const GUIDE_COLOR_OPTIONS = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

export const CAMERA_TIMER_OPTIONS = [
  { label: "끔", value: 0 },
  { label: "3초", value: 3 },
  { label: "10초", value: 10 }
] as const;
export const CAMERA_QUALITY_OPTIONS = [
  { label: "일반", value: "standard", quality: 0.82 },
  { label: "높음", value: "high", quality: 0.92 },
  { label: "최대", value: "max", quality: 1 }
] as const;
export const CAMERA_RATIO_OPTIONS: { label: string; value: PhotoRatioLabel }[] = [
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "4:3", value: "4:3" },
  { label: "4:5", value: "4:5" },
  { label: "9:16", value: "9:16" },
  { label: "16:9", value: "16:9" }
];
export const CAMERA_SAVE_SCOPE_OPTIONS: { label: string; detail: string; value: CameraSaveTarget }[] = [
  { label: "앱 보관함", detail: "보관함 탭에서 다시 열 수 있도록 앱에 저장", value: "app" },
  { label: "핸드폰 앨범", detail: "기기 갤러리 앱에서도 볼 수 있도록 저장", value: "device" },
  { label: "클라우드", detail: "로그인 및 백업 설정이 가능한 경우 계정에 백업", value: "cloud" }
];
export const CAMERA_FACING_OPTIONS: { label: string; value: CameraFacing }[] = [
  { label: "후면", value: "back" },
  { label: "전면", value: "front" }
];
export const CAMERA_FLASH_OPTIONS: { label: string; value: FlashMode }[] = [
  { label: "끔", value: "off" },
  { label: "자동", value: "auto" },
  { label: "켜짐", value: "on" }
];

export const cameraRatioAspect: Record<PhotoRatioLabel, number | null> = {
  Original: null,
  "1:1": 1,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9
};
export const CAMERA_PREVIEW_TOP_RESERVED = 88;
export const CAMERA_PREVIEW_BOTTOM_RESERVED = 158;
export const CAMERA_PREVIEW_OVERLAY_SETUP_BOTTOM_RESERVED = 238;
export const CAMERA_PREVIEW_CONTROL_GAP = 12;

export const CAMERA_ZOOM_MIN = 0;
export const CAMERA_ZOOM_MAX = 100;
export const CAMERA_ULTRA_WIDE_ZOOM_FACTOR = 0.5;
export const CAMERA_LENS_ULTRA_WIDE: PhysicalDeviceType = "ultra-wide-angle";
export const CAMERA_LENS_WIDE: PhysicalDeviceType = "wide-angle";
export const CAMERA_LENS_TELEPHOTO: PhysicalDeviceType = "telephoto";
export const CAMERA_BACK_PHYSICAL_DEVICES: PhysicalDeviceType[] = [
  CAMERA_LENS_ULTRA_WIDE,
  CAMERA_LENS_WIDE,
  CAMERA_LENS_TELEPHOTO
];
export const CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE = [
  { label: "0.5x", factor: CAMERA_ULTRA_WIDE_ZOOM_FACTOR },
  { label: "1x", factor: 1 },
  { label: "3x", factor: 3 },
  { label: "5x", factor: 5 },
  { label: "10x", factor: 10 }
] as const;
export const CAMERA_BACK_ZOOM_PRESETS_DEFAULT = [
  { label: "1x", factor: 1 },
  { label: "3x", factor: 3 },
  { label: "5x", factor: 5 },
  { label: "10x", factor: 10 }
] as const;
export const CAMERA_FRONT_ZOOM_PRESETS = [
  { label: "1x", factor: 1 },
  { label: "3x", factor: 3 }
] as const;
export const CAMERA_EXPOSURE_BIAS_MIN = -1;
export const CAMERA_EXPOSURE_BIAS_MAX = 1;
export const CAMERA_COLOR_ADJUST_MIN = -100;
export const CAMERA_COLOR_ADJUST_MAX = 100;
export const CAMERA_COLOR_OVERLAY_MAX_OPACITY = 0.24;
export const CAMERA_COLOR_TEMPERATURE_WARM = [255, 178, 88] as const;
export const CAMERA_COLOR_TEMPERATURE_COOL = [84, 158, 255] as const;
export const CAMERA_COLOR_TINT_MAGENTA = [255, 96, 198] as const;
export const CAMERA_COLOR_TINT_GREEN = [80, 216, 132] as const;
export const CAMERA_FLIP_SWIPE_THRESHOLD = 70;
export const CAMERA_FLIP_HORIZONTAL_TOLERANCE = 1.4;
export const CAMERA_FOCUS_METERING_MODES: MeteringMode[] = ["AF", "AE", "AWB"];
export const CAMERA_SESSION_RECOVERY_DELAY_MS = 700;

export type CameraTimerValue = (typeof CAMERA_TIMER_OPTIONS)[number]["value"];
export type CameraQualityValue = (typeof CAMERA_QUALITY_OPTIONS)[number]["value"];
export type CameraControlPanel = "color" | "zoom" | "light";
export type CameraSettingsPatch = Partial<AppSettings>;
export type CameraZoomPreset =
  | (typeof CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE)[number]
  | (typeof CAMERA_BACK_ZOOM_PRESETS_DEFAULT)[number]
  | (typeof CAMERA_FRONT_ZOOM_PRESETS)[number];

export const sleep = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export function clampCameraColorAdjustment(value: number) {
  return Math.round(Math.max(CAMERA_COLOR_ADJUST_MIN, Math.min(CAMERA_COLOR_ADJUST_MAX, value)));
}

export function getCameraColorOverlayColor(
  value: number,
  negativeColor: readonly [number, number, number],
  positiveColor: readonly [number, number, number]
) {
  const colorValue = clampCameraColorAdjustment(value);
  if (colorValue === 0) {
    return "rgba(0, 0, 0, 0)";
  }

  const [red, green, blue] = colorValue > 0 ? positiveColor : negativeColor;
  const opacity = Number(
    ((Math.abs(colorValue) / CAMERA_COLOR_ADJUST_MAX) * CAMERA_COLOR_OVERLAY_MAX_OPACITY).toFixed(3)
  );
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function getCameraNeutralOverlayColor(value: number) {
  const colorValue = clampCameraColorAdjustment(value);
  if (colorValue === 0) {
    return "rgba(0, 0, 0, 0)";
  }

  const color = colorValue > 0 ? 255 : 0;
  const opacity = Number(
    ((Math.abs(colorValue) / CAMERA_COLOR_ADJUST_MAX) * CAMERA_COLOR_OVERLAY_MAX_OPACITY).toFixed(3)
  );
  return `rgba(${color}, ${color}, ${color}, ${opacity})`;
}

export function getCameraSaturationOverlayColor(value: number) {
  const colorValue = clampCameraColorAdjustment(value);
  if (colorValue === 0) {
    return "rgba(0, 0, 0, 0)";
  }

  if (colorValue < 0) {
    const opacity = Number(
      ((Math.abs(colorValue) / CAMERA_COLOR_ADJUST_MAX) * 0.18).toFixed(3)
    );
    return `rgba(128, 128, 128, ${opacity})`;
  }

  const opacity = Number(((colorValue / CAMERA_COLOR_ADJUST_MAX) * 0.12).toFixed(3));
  return `rgba(255, 92, 64, ${opacity})`;
}

export function formatCameraSignedValue(value: number) {
  const roundedValue = Math.round(value);
  return roundedValue > 0 ? `+${roundedValue}` : String(roundedValue);
}

export function formatCameraExposureValue(value: number) {
  const roundedValue = Number(value.toFixed(2));
  return roundedValue > 0 ? `+${roundedValue}` : String(roundedValue);
}

export function hasCameraLens(availableLenses: PhysicalDeviceType[], lens: PhysicalDeviceType) {
  return availableLenses.includes(lens);
}

export function cameraDeviceHasLens(cameraDevice: CameraDevice, lens: PhysicalDeviceType) {
  if (cameraDevice.type === lens) {
    return true;
  }

  return cameraDevice.physicalDevices?.some((physicalDevice) => physicalDevice.type === lens) === true;
}

export function getCameraDeviceFilter(cameraFacing: CameraPosition): DeviceFilter | undefined {
  if (cameraFacing === "front") {
    return undefined;
  }

  return { physicalDevices: CAMERA_BACK_PHYSICAL_DEVICES };
}

export function getPreferredCameraDevice(
  cameraDevices: CameraDevice[],
  cameraFacing: CameraPosition
) {
  if (cameraFacing === "back") {
    const torchDevices = cameraDevices.filter((device) => device.position === "back" && device.hasTorch);
    const wideTorchDevice =
      torchDevices.find((device) => cameraDeviceHasLens(device, CAMERA_LENS_WIDE)) ?? torchDevices[0];

    if (wideTorchDevice) {
      return wideTorchDevice;
    }
  }

  return getCameraDevice(cameraDevices, cameraFacing, getCameraDeviceFilter(cameraFacing));
}

export function getCameraDeviceLensTypes(cameraDevice: CameraDevice | undefined) {
  if (!cameraDevice) {
    return [] as PhysicalDeviceType[];
  }

  const lensTypes = new Set<PhysicalDeviceType>();
  for (const physicalDevice of cameraDevice.physicalDevices ?? []) {
    if (CAMERA_BACK_PHYSICAL_DEVICES.includes(physicalDevice.type as PhysicalDeviceType)) {
      lensTypes.add(physicalDevice.type as PhysicalDeviceType);
    }
  }
  if (CAMERA_BACK_PHYSICAL_DEVICES.includes(cameraDevice.type as PhysicalDeviceType)) {
    lensTypes.add(cameraDevice.type as PhysicalDeviceType);
  }

  return [...lensTypes];
}

export function getCameraZoomPresets(
  cameraFacing: CameraFacing,
  availableLenses: PhysicalDeviceType[],
  cameraDevice: CameraDevice | undefined
) {
  if (cameraFacing === "front") {
    return CAMERA_FRONT_ZOOM_PRESETS;
  }

  if (
    hasCameraLens(availableLenses, CAMERA_LENS_ULTRA_WIDE) &&
    getCameraSupportsUltraWideZoom(cameraDevice)
  ) {
    return CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE;
  }

  return CAMERA_BACK_ZOOM_PRESETS_DEFAULT;
}

export function getCameraZoomBounds(cameraDevice: CameraDevice | undefined) {
  const minZoom = cameraDevice?.minZoom && Number.isFinite(cameraDevice.minZoom)
    ? cameraDevice.minZoom
    : 1;
  const maxZoom = cameraDevice?.maxZoom && Number.isFinite(cameraDevice.maxZoom)
    ? cameraDevice.maxZoom
    : 10;

  return {
    minZoom: Math.max(0.5, minZoom),
    maxZoom: Math.max(Math.max(0.5, minZoom), maxZoom)
  };
}

export function getCameraSupportsUltraWideZoom(cameraDevice: CameraDevice | undefined) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  return minZoom <= CAMERA_ULTRA_WIDE_ZOOM_FACTOR && maxZoom >= CAMERA_ULTRA_WIDE_ZOOM_FACTOR;
}

export function getCameraZoomFactorFromPercent(
  percent: number,
  cameraDevice: CameraDevice | undefined
) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  const ratio = Math.max(0, Math.min(1, percent / 100));
  return minZoom + (maxZoom - minZoom) * ratio;
}

export function getCameraZoomPercentFromFactor(
  factor: number,
  cameraDevice: CameraDevice | undefined
) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  if (maxZoom <= minZoom) {
    return 0;
  }

  return Math.round(((Math.max(minZoom, Math.min(maxZoom, factor)) - minZoom) / (maxZoom - minZoom)) * 100);
}

export function getCameraZoomPresetFactor(
  preset: CameraZoomPreset,
  cameraDevice: CameraDevice | undefined
) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  return Math.max(minZoom, Math.min(maxZoom, preset.factor));
}

export function getCameraFocusMeteringModes(cameraDevice: CameraDevice | undefined) {
  if (!cameraDevice) {
    return CAMERA_FOCUS_METERING_MODES;
  }

  const modes: MeteringMode[] = [];
  if (cameraDevice.supportsFocusMetering) {
    modes.push("AF");
  }
  if (cameraDevice.supportsExposureMetering) {
    modes.push("AE");
  }
  if (cameraDevice.supportsWhiteBalanceMetering) {
    modes.push("AWB");
  }

  return modes.length > 0 ? modes : CAMERA_FOCUS_METERING_MODES;
}

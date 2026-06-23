import { NativeModules, Platform } from "react-native";

import type { CameraColorAdjustment } from "@/types/photo";

type AndroidImageAdjustmentModule = {
  adjustImage(input: {
    uri: string;
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
    tint: number;
    quality?: number;
  }): Promise<{ uri: string; width: number; height: number }>;
};

const nativeModule = NativeModules.AndroidImageAdjustment as
  | AndroidImageAdjustmentModule
  | undefined;

const clampAdjustment = (value: number) =>
  Math.round(Math.max(-100, Math.min(100, Number.isFinite(value) ? value : 0)));

export const normalizeCameraColorAdjustment = (
  adjustment?: CameraColorAdjustment
): CameraColorAdjustment => ({
  brightness: clampAdjustment(adjustment?.brightness ?? 0),
  contrast: clampAdjustment(adjustment?.contrast ?? 0),
  saturation: clampAdjustment(adjustment?.saturation ?? 0),
  temperature: clampAdjustment(adjustment?.temperature ?? 0),
  tint: clampAdjustment(adjustment?.tint ?? 0)
});

export const hasCameraColorAdjustment = (adjustment?: CameraColorAdjustment) => {
  const normalized = normalizeCameraColorAdjustment(adjustment);
  return (
    normalized.brightness !== 0 ||
    normalized.contrast !== 0 ||
    normalized.saturation !== 0 ||
    normalized.temperature !== 0 ||
    normalized.tint !== 0
  );
};

export const applyAndroidImageAdjustment = async ({
  uri,
  adjustment,
  quality = 95
}: {
  uri: string;
  adjustment?: CameraColorAdjustment;
  quality?: number;
}) => {
  const normalized = normalizeCameraColorAdjustment(adjustment);

  if (!hasCameraColorAdjustment(normalized) || Platform.OS !== "android") {
    return { uri };
  }

  if (!nativeModule) {
    throw new Error("Android 이미지 색감 보정 모듈을 사용할 수 없습니다.");
  }

  return nativeModule.adjustImage({
    uri,
    quality,
    brightness: normalized.brightness,
    contrast: normalized.contrast,
    saturation: normalized.saturation,
    temperature: normalized.temperature,
    tint: normalized.tint
  });
};

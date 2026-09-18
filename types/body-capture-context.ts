import type { CameraFacing } from "@/lib/app-settings";
import type { PhotoRatioLabel } from "@/types/photo";

export type BodyCaptureContext = {
  cameraFacing: CameraFacing;
  cameraRatio: PhotoRatioLabel;
  cameraZoomPercent: number;
  cameraExposureBias: number;
  cameraColorTemperature: number;
  cameraColorTint: number;
  cameraBrightness: number;
  cameraContrast: number;
  cameraSaturation: number;
};

export type BodyCaptureContextState = {
  enabled: boolean;
  context: BodyCaptureContext | null;
  updatedAt?: string;
};

export const defaultBodyCaptureContextState: BodyCaptureContextState = {
  enabled: true,
  context: null
};

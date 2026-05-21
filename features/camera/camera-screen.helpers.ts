import { EXPOSURE_CONTROL_GAP, EXPOSURE_SUN_ICON_SIZE } from "@/features/camera/camera-screen.constants";

export function getExposureThumbX(value: number, min: number, max: number, width: number) {
  if (width <= 0 || max === min) {
    return 0;
  }

  const ratio = (value - min) / (max - min);
  return Math.max(0, Math.min(1, ratio)) * width;
}

export function getExposureTrackXFromControlX(controlX: number, trackWidth: number) {
  "worklet";

  if (trackWidth <= 0) {
    return 0;
  }

  const trackStartX = EXPOSURE_SUN_ICON_SIZE + EXPOSURE_CONTROL_GAP;
  return Math.max(0, Math.min(trackWidth, controlX - trackStartX));
}

export function getExposureBiasFromTrackX(
  trackX: number,
  min: number,
  max: number,
  trackWidth: number
) {
  "worklet";

  if (trackWidth <= 0) {
    return min;
  }

  const ratio = Math.max(0, Math.min(1, trackX / trackWidth));
  return min + ratio * (max - min);
}

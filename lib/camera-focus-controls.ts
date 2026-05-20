export type CameraFocusFrame = {
  width: number;
  height: number;
};

export type CameraFocusTap = {
  x: number;
  y: number;
};

export type CameraFocusPoint = {
  x: number;
  y: number;
};

type TapExposureControlPositionInput = {
  tap: CameraFocusTap;
  frame: CameraFocusFrame;
  controlWidth: number;
  controlHeight: number;
  offsetY: number;
  margin: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isValidNumber = (value: number) => Number.isFinite(value);

export function getNormalizedCameraFocusPoint(
  tap: CameraFocusTap,
  frame: CameraFocusFrame
): CameraFocusPoint | null {
  if (
    !isValidNumber(tap.x) ||
    !isValidNumber(tap.y) ||
    !isValidNumber(frame.width) ||
    !isValidNumber(frame.height) ||
    frame.width <= 0 ||
    frame.height <= 0
  ) {
    return null;
  }

  return {
    x: Number(clamp(tap.x / frame.width, 0, 1).toFixed(4)),
    y: Number(clamp(tap.y / frame.height, 0, 1).toFixed(4))
  };
}

export function getTapExposureControlPosition({
  tap,
  frame,
  controlWidth,
  controlHeight,
  offsetY,
  margin
}: TapExposureControlPositionInput) {
  const maxLeft = Math.max(margin, frame.width - controlWidth - margin);
  const maxTop = Math.max(margin, frame.height - controlHeight - margin);

  return {
    left: Math.round(clamp(tap.x - controlWidth / 2, margin, maxLeft)),
    top: Math.round(clamp(tap.y + offsetY, margin, maxTop))
  };
}

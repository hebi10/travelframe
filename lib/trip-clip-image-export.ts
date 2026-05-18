export type TripClipImageAdjustment = {
  translateX: number;
  translateY: number;
  scale: number;
};

export type TripClipImageExportAction = {
  crop: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
};

type TripClipImageExportInput = {
  width?: number | null;
  height?: number | null;
  frameAspectRatio?: number | null;
  adjustment?: TripClipImageAdjustment | null;
  frameWidth?: number | null;
  frameHeight?: number | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const isPositiveFiniteNumber = (value?: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export const getTripClipImageExportActions = ({
  width,
  height,
  frameAspectRatio,
  adjustment,
  frameWidth,
  frameHeight
}: TripClipImageExportInput): TripClipImageExportAction[] => {
  if (
    !isPositiveFiniteNumber(width) ||
    !isPositiveFiniteNumber(height) ||
    !isPositiveFiniteNumber(frameAspectRatio)
  ) {
    return [];
  }

  const sourceRatio = width / height;
  let baseWidth = width;
  let baseHeight = height;

  if (sourceRatio > frameAspectRatio) {
    baseWidth = height * frameAspectRatio;
  } else {
    baseHeight = width / frameAspectRatio;
  }

  const scale = Math.max(1, adjustment?.scale || 1);
  const cropWidth = clamp(baseWidth / scale, 1, width);
  const cropHeight = clamp(baseHeight / scale, 1, height);
  const offsetX = isPositiveFiniteNumber(frameWidth)
    ? ((adjustment?.translateX ?? 0) / frameWidth) * cropWidth
    : 0;
  const offsetY = isPositiveFiniteNumber(frameHeight)
    ? ((adjustment?.translateY ?? 0) / frameHeight) * cropHeight
    : 0;
  const centerX = width / 2 - offsetX;
  const centerY = height / 2 - offsetY;
  const crop = {
    originX: Math.round(clamp(centerX - cropWidth / 2, 0, width - cropWidth)),
    originY: Math.round(clamp(centerY - cropHeight / 2, 0, height - cropHeight)),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };

  if (
    crop.originX === 0 &&
    crop.originY === 0 &&
    crop.width >= Math.round(width) &&
    crop.height >= Math.round(height)
  ) {
    return [];
  }

  return [{ crop }];
};

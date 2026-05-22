import type { GuideType } from "@/constants/camera-guides";
import { EXPOSURE_CONTROL_GAP, EXPOSURE_SUN_ICON_SIZE } from "@/features/camera/camera-screen.constants";
import {
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  getGuideSizeBounds,
  type GridGuideLineKey,
  type GridGuideLinePositions,
  type GuideShapeKey,
  type GuideShapePoints
} from "@/lib/app-settings";

const GRID_LINE_MIN_PERCENT = 2;
const GRID_LINE_MAX_PERCENT = 98;
const GRID_LINE_MIN_GAP_PERCENT = 4;
const GUIDE_SHAPE_POINT_MIN_PERCENT = 2;
const GUIDE_SHAPE_POINT_MAX_PERCENT = 98;

type CameraFrame = { width: number; height: number };
type GuideOffset = { x: number; y: number };

export function getDefaultGridGuideLinePositions(size: number): GridGuideLinePositions {
  const safeGridSize = Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, size));
  const inset = Math.round(((100 - safeGridSize) / 2) * 10) / 10;

  return {
    verticalStart: inset,
    verticalEnd: 100 - inset,
    horizontalStart: inset,
    horizontalEnd: 100 - inset
  };
}

export function clampGridLinePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.round(
    Math.max(GRID_LINE_MIN_PERCENT, Math.min(GRID_LINE_MAX_PERCENT, value)) * 10
  ) / 10;
}

export function clampGridGuideLinePositions(
  positions: GridGuideLinePositions
): GridGuideLinePositions {
  const verticalStart = clampGridLinePercent(positions.verticalStart);
  const verticalEnd = clampGridLinePercent(positions.verticalEnd);
  const horizontalStart = clampGridLinePercent(positions.horizontalStart);
  const horizontalEnd = clampGridLinePercent(positions.horizontalEnd);
  const boundedVerticalStart = Math.min(
    verticalStart,
    GRID_LINE_MAX_PERCENT - GRID_LINE_MIN_GAP_PERCENT
  );
  const boundedHorizontalStart = Math.min(
    horizontalStart,
    GRID_LINE_MAX_PERCENT - GRID_LINE_MIN_GAP_PERCENT
  );

  return {
    verticalStart: boundedVerticalStart,
    verticalEnd: Math.max(verticalEnd, boundedVerticalStart + GRID_LINE_MIN_GAP_PERCENT),
    horizontalStart: boundedHorizontalStart,
    horizontalEnd: Math.max(horizontalEnd, boundedHorizontalStart + GRID_LINE_MIN_GAP_PERCENT)
  };
}

export function getNearestGridGuideLine({
  x,
  y,
  frame,
  positions
}: {
  x: number;
  y: number;
  frame: CameraFrame;
  positions: GridGuideLinePositions;
}) {
  const candidates: { key: GridGuideLineKey; distance: number }[] = [
    { key: "verticalStart", distance: Math.abs(x - (positions.verticalStart / 100) * frame.width) },
    { key: "verticalEnd", distance: Math.abs(x - (positions.verticalEnd / 100) * frame.width) },
    { key: "horizontalStart", distance: Math.abs(y - (positions.horizontalStart / 100) * frame.height) },
    { key: "horizontalEnd", distance: Math.abs(y - (positions.horizontalEnd / 100) * frame.height) }
  ];

  return candidates.reduce((nearest, candidate) =>
    candidate.distance < nearest.distance ? candidate : nearest
  ).key;
}

export function updateGridGuideLineFromPoint({
  line,
  x,
  y,
  frame,
  positions
}: {
  line: GridGuideLineKey;
  x: number;
  y: number;
  frame: CameraFrame;
  positions: GridGuideLinePositions;
}) {
  if (frame.width <= 0 || frame.height <= 0) {
    return positions;
  }

  const nextPercent = line.startsWith("vertical")
    ? (x / frame.width) * 100
    : (y / frame.height) * 100;

  return clampGridGuideLinePositions({
    ...positions,
    [line]: clampGridLinePercent(nextPercent)
  });
}

export function isShapeGuide(guide: GuideType): guide is GuideShapeKey {
  return guide === "cross" || guide === "triangle" || guide === "square";
}

export function clampGuideShapePointPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.round(
    Math.max(
      GUIDE_SHAPE_POINT_MIN_PERCENT,
      Math.min(GUIDE_SHAPE_POINT_MAX_PERCENT, value)
    ) * 10
  ) / 10;
}

export function getGuideShapeFrame({
  guide,
  frame,
  guideSize,
  offset
}: {
  guide: GuideType;
  frame: CameraFrame;
  guideSize: number;
  offset: GuideOffset;
}) {
  const guideSizeBounds = getGuideSizeBounds(guide);
  const safeSize = Math.max(
    guideSizeBounds.min,
    Math.min(guideSizeBounds.max, guideSize)
  );
  const side = frame.width > 0 ? (frame.width * safeSize) / 100 : 0;
  const centerX = frame.width / 2 + offset.x;
  const centerY = frame.height / 2 + offset.y;

  return {
    left: centerX - side / 2,
    top: centerY - side / 2,
    side
  };
}

function getGuideShapePointDistance({
  point,
  x,
  y,
  shapeFrame
}: {
  point: { x: number; y: number };
  x: number;
  y: number;
  shapeFrame: { left: number; top: number; side: number };
}) {
  const pointX = shapeFrame.left + (point.x / 100) * shapeFrame.side;
  const pointY = shapeFrame.top + (point.y / 100) * shapeFrame.side;

  return Math.hypot(x - pointX, y - pointY);
}

export function getNearestGuideShapePoint({
  guide,
  x,
  y,
  frame,
  guideSize,
  offset,
  shapePoints
}: {
  guide: GuideType;
  x: number;
  y: number;
  frame: CameraFrame;
  guideSize: number;
  offset: GuideOffset;
  shapePoints: GuideShapePoints;
}) {
  if (!isShapeGuide(guide)) {
    return null;
  }

  const shapeFrame = getGuideShapeFrame({ guide, frame, guideSize, offset });
  return shapePoints[guide].reduce(
    (nearest, point, index) => {
      const distance = getGuideShapePointDistance({ point, x, y, shapeFrame });
      return distance < nearest.distance ? { index, distance } : nearest;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY }
  ).index;
}

export function updateGuideShapePointFromPoint({
  guide,
  pointIndex,
  x,
  y,
  frame,
  guideSize,
  offset,
  shapePoints
}: {
  guide: GuideType;
  pointIndex: number | null;
  x: number;
  y: number;
  frame: CameraFrame;
  guideSize: number;
  offset: GuideOffset;
  shapePoints: GuideShapePoints;
}) {
  if (!isShapeGuide(guide) || pointIndex === null || frame.width <= 0 || frame.height <= 0) {
    return shapePoints;
  }

  const shapeFrame = getGuideShapeFrame({ guide, frame, guideSize, offset });
  if (shapeFrame.side <= 0) {
    return shapePoints;
  }

  const points = shapePoints[guide];
  if (pointIndex < 0 || pointIndex >= points.length) {
    return shapePoints;
  }

  return {
    ...shapePoints,
    [guide]: points.map((point, index) =>
      index === pointIndex
        ? {
            x: clampGuideShapePointPercent(((x - shapeFrame.left) / shapeFrame.side) * 100),
            y: clampGuideShapePointPercent(((y - shapeFrame.top) / shapeFrame.side) * 100)
          }
        : point
    )
  };
}

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

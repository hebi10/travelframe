export type CameraGuideFrame = {
  width: number;
  height: number;
};

export type CameraGuideOffset = {
  x: number;
  y: number;
};

const GUIDE_POSITION_BOUND_RATIO = 0.42;

const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);
const normalizeZero = (value: number) => (Object.is(value, -0) ? 0 : value);

export function getGuidePositionBounds(frame: CameraGuideFrame) {
  return {
    maxX: Math.max(0, finiteOrZero(frame.width) * GUIDE_POSITION_BOUND_RATIO),
    maxY: Math.max(0, finiteOrZero(frame.height) * GUIDE_POSITION_BOUND_RATIO)
  };
}

export function clampGuidePositionOffset(
  offset: CameraGuideOffset,
  frame: CameraGuideFrame
): CameraGuideOffset {
  const { maxX, maxY } = getGuidePositionBounds(frame);

  return {
    x: normalizeZero(
      Math.round(Math.max(-maxX, Math.min(maxX, finiteOrZero(offset.x))))
    ),
    y: normalizeZero(
      Math.round(Math.max(-maxY, Math.min(maxY, finiteOrZero(offset.y))))
    )
  };
}

export function calculateGuidePositionDragOffset({
  startX,
  startY,
  translationX,
  translationY,
  frame
}: {
  startX: number;
  startY: number;
  translationX: number;
  translationY: number;
  frame: CameraGuideFrame;
}): CameraGuideOffset {
  return clampGuidePositionOffset(
    {
      x: finiteOrZero(startX) + finiteOrZero(translationX),
      y: finiteOrZero(startY) + finiteOrZero(translationY)
    },
    frame
  );
}

export type GuideOffset = {
  x: number;
  y: number;
};

export type GuideOffsetFrame = {
  width?: number | null;
  height?: number | null;
};

const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);

const positiveFiniteOrNull = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

export const normalizeGuideOffsetFrameSize = (value: unknown) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : 0;
};

export const scaleGuideOffsetForFrame = ({
  offset,
  sourceFrame,
  targetFrame
}: {
  offset: GuideOffset;
  sourceFrame?: GuideOffsetFrame | null;
  targetFrame?: GuideOffsetFrame | null;
}): GuideOffset => {
  const sourceWidth = positiveFiniteOrNull(sourceFrame?.width);
  const sourceHeight = positiveFiniteOrNull(sourceFrame?.height);
  const targetWidth = positiveFiniteOrNull(targetFrame?.width);
  const targetHeight = positiveFiniteOrNull(targetFrame?.height);

  return {
    x:
      sourceWidth && targetWidth
        ? Math.round(finiteOrZero(offset.x) * (targetWidth / sourceWidth))
        : finiteOrZero(offset.x),
    y:
      sourceHeight && targetHeight
        ? Math.round(finiteOrZero(offset.y) * (targetHeight / sourceHeight))
        : finiteOrZero(offset.y)
  };
};

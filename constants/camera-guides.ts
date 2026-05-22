export const GUIDE_TYPES = [
  "dot",
  "circle",
  "cross",
  "triangle",
  "square",
  "grid",
  "horizon"
] as const;

export type GuideType = (typeof GUIDE_TYPES)[number];

export const GUIDE_LABELS: Record<GuideType, string> = {
  dot: "중앙점",
  circle: "중앙원",
  cross: "십자선",
  triangle: "삼각형",
  square: "사각형",
  grid: "3분할",
  horizon: "수평선"
};

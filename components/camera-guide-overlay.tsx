import { type DimensionValue, StyleSheet, View } from "react-native";

import type { GuideType } from "@/constants/camera-guides";
import type {
  GridGuideLineKey,
  GridGuideLinePositions,
  GuideShapePoints
} from "@/lib/app-settings";
import { defaultGuideShapePoints, getGuideSizeBounds } from "@/lib/app-settings";

type GuideShapePoint = {
  x: number;
  y: number;
};

const shapeGuidePointIndexes: Record<"cross" | "triangle" | "square", number[]> = {
  cross: [0, 1, 2, 3],
  triangle: [0, 1, 2],
  square: [0, 1, 2, 3]
};

function getShapeGuidePoints(guide: GuideType, shapePoints?: GuideShapePoints) {
  if (guide === "cross" || guide === "triangle" || guide === "square") {
    return shapeGuidePointIndexes[guide].map(
      (index) => shapePoints?.[guide]?.[index] ?? defaultGuideShapePoints[guide][index]
    );
  }

  return null;
}

function getShapeLineStyle(
  start: GuideShapePoint,
  end: GuideShapePoint,
  strokeWidth: number,
  color: string
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return {
    left: `${(start.x + end.x) / 2 - length / 2}%` as const,
    top: `${(start.y + end.y) / 2}%` as const,
    width: `${length}%` as const,
    height: strokeWidth,
    marginTop: -strokeWidth / 2,
    backgroundColor: color,
    transform: [{ rotateZ: `${angle}deg` }]
  };
}

function renderShapeGuideLines(
  points: GuideShapePoint[],
  strokeWidth: number,
  color: string
) {
  return points.map((point, index) => {
    const nextPoint = points[(index + 1) % points.length];

    return (
      <View
        key={`${point.x}-${point.y}-${index}`}
        style={[
          styles.guideShapeLine,
          getShapeLineStyle(point, nextPoint, strokeWidth, color)
        ]}
      />
    );
  });
}

function renderCrossGuideLines(
  points: GuideShapePoint[],
  strokeWidth: number,
  color: string
) {
  return [
    [points[0], points[1]],
    [points[2], points[3]]
  ].map(([start, end], index) => (
    <View
      key={`cross-guide-line-${index}`}
      style={[
        styles.guideShapeLine,
        getShapeLineStyle(start, end, strokeWidth, color)
      ]}
    />
  ));
}

type CameraGuideOverlayProps = {
  guide: GuideType;
  visible: boolean;
  color?: string;
  size?: number;
  strokeWidth?: number;
  aspectRatio?: number;
  offsetX?: number;
  offsetY?: number;
  gridLinePositions?: GridGuideLinePositions;
  selectedGridLine?: GridGuideLineKey | null;
  shapePoints?: GuideShapePoints;
  showShapeControlPoints?: boolean;
  selectedShapePointIndex?: number | null;
};

export function CameraGuideOverlay({
  guide,
  visible,
  color = "rgba(255, 255, 255, 0.72)",
  size = 44,
  strokeWidth = 1,
  aspectRatio,
  offsetX = 0,
  offsetY = 0,
  gridLinePositions,
  selectedGridLine = null,
  shapePoints,
  showShapeControlPoints = false,
  selectedShapePointIndex = null
}: CameraGuideOverlayProps) {
  if (!visible) {
    return null;
  }

  const safeStrokeWidth = Math.max(1, Math.min(5, Math.round(strokeWidth)));
  const safeAspectRatio = Number.isFinite(aspectRatio) && Number(aspectRatio) > 0
    ? Number(aspectRatio)
    : null;
  const constrainedFrameStyle = safeAspectRatio
    ? {
        width: "100%" as DimensionValue,
        maxHeight: "100%" as DimensionValue,
        aspectRatio: safeAspectRatio
      }
    : styles.fillFrame;
  const secondaryGuideLineStyle = {
    backgroundColor: color,
    opacity: 0.45,
    width: safeStrokeWidth
  };
  const secondaryHorizontalGuideLineStyle = {
    backgroundColor: color,
    height: safeStrokeWidth,
    opacity: 0.45
  };
  const safeGridSize = Math.max(24, Math.min(86, size));
  const gridLineInset = `${(100 - safeGridSize) / 2}%` as DimensionValue;
  const gridLineFarInset = `${100 - (100 - safeGridSize) / 2}%` as DimensionValue;
  const verticalStartPosition = (
    gridLinePositions?.verticalStart === undefined
      ? gridLineInset
      : `${gridLinePositions.verticalStart}%`
  ) as DimensionValue;
  const verticalEndPosition = (
    gridLinePositions?.verticalEnd === undefined
      ? gridLineFarInset
      : `${gridLinePositions.verticalEnd}%`
  ) as DimensionValue;
  const horizontalStartPosition = (
    gridLinePositions?.horizontalStart === undefined
      ? gridLineInset
      : `${gridLinePositions.horizontalStart}%`
  ) as DimensionValue;
  const horizontalEndPosition = (
    gridLinePositions?.horizontalEnd === undefined
      ? gridLineFarInset
      : `${gridLinePositions.horizontalEnd}%`
  ) as DimensionValue;

  if (guide === "grid") {
    return (
      <View style={styles.overlayViewport}>
        <View style={[styles.constrainedFrame, constrainedFrameStyle]}>
          <View style={styles.gridOverlay}>
            <View
              style={[
                styles.gridVertical,
                { left: verticalStartPosition },
                secondaryGuideLineStyle,
                selectedGridLine === "verticalStart" && styles.gridLineSelected
              ]}
            />
            <View
              style={[
                styles.gridVertical,
                { left: verticalEndPosition },
                secondaryGuideLineStyle,
                selectedGridLine === "verticalEnd" && styles.gridLineSelected
              ]}
            />
            <View
              style={[
                styles.gridHorizontal,
                { top: horizontalStartPosition },
                secondaryHorizontalGuideLineStyle,
                selectedGridLine === "horizontalStart" && styles.gridLineSelected
              ]}
            />
            <View
              style={[
                styles.gridHorizontal,
                { top: horizontalEndPosition },
                secondaryHorizontalGuideLineStyle,
                selectedGridLine === "horizontalEnd" && styles.gridLineSelected
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  const guideSizeBounds = getGuideSizeBounds(guide);
  const safeSize = Math.max(guideSizeBounds.min, Math.min(guideSizeBounds.max, size));
  const inset = `${(100 - safeSize) / 2}%` as DimensionValue;
  const guideWidth = `${safeSize}%` as DimensionValue;
  const shapeGuidePoints = getShapeGuidePoints(guide, shapePoints);
  const lineLengthStyle = {
    left: inset,
    right: inset
  };
  const guideLineStyle = {
    backgroundColor: color,
    height: safeStrokeWidth
  };
  const offsetStyle = {
    transform: [
      { translateX: Number.isFinite(offsetX) ? offsetX : 0 },
      { translateY: Number.isFinite(offsetY) ? offsetY : 0 }
    ]
  };

  return (
    <View style={styles.overlayViewport}>
      <View style={[styles.constrainedFrame, constrainedFrameStyle, offsetStyle]}>
        <View style={styles.overlay}>
          {guide === "dot" ? (
            <View
              style={[
                styles.centerDot,
                {
                  backgroundColor: color,
                  width: (safeStrokeWidth + 3) * 2,
                  height: (safeStrokeWidth + 3) * 2,
                  marginLeft: -(safeStrokeWidth + 3),
                  marginTop: -(safeStrokeWidth + 3)
                }
              ]}
            />
          ) : null}
          {guide === "circle" ? (
            <View
              style={[
                styles.centerCircle,
                {
                  width: guideWidth,
                  borderWidth: safeStrokeWidth,
                  borderColor: color
                }
              ]}
            />
          ) : null}
          {guide === "cross" ? (
            <View style={[styles.crossFrame, { width: guideWidth }]}>
              {shapeGuidePoints ? renderCrossGuideLines(shapeGuidePoints, safeStrokeWidth, color) : null}
              {showShapeControlPoints && shapeGuidePoints
                ? shapeGuidePoints.map((point, index) => (
                    <View
                      key={`cross-point-${index}`}
                      style={[
                        styles.guideShapePoint,
                        {
                          left: `${point.x}%`,
                          top: `${point.y}%`,
                          borderColor: color,
                          backgroundColor: color
                        },
                        selectedShapePointIndex === index && styles.guideShapePointSelected
                      ]}
                    />
                  ))
                : null}
            </View>
          ) : null}
          {shapeGuidePoints && guide !== "cross" ? (
            <View style={[styles.guideShapeFrame, { width: guideWidth }]}>
              {renderShapeGuideLines(shapeGuidePoints, safeStrokeWidth, color)}
              {showShapeControlPoints
                ? shapeGuidePoints.map((point, index) => (
                    <View
                      key={`shape-point-${index}`}
                      style={[
                        styles.guideShapePoint,
                        {
                          left: `${point.x}%`,
                          top: `${point.y}%`,
                          borderColor: color,
                          backgroundColor: color
                        },
                        selectedShapePointIndex === index && styles.guideShapePointSelected
                      ]}
                    />
                  ))
                : null}
            </View>
          ) : null}
          {guide === "horizon" ? (
            <View style={[styles.horizon, lineLengthStyle, guideLineStyle]} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayViewport: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none"
  },
  constrainedFrame: {
    position: "relative",
    overflow: "hidden"
  },
  fillFrame: {
    width: "100%",
    height: "100%"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none"
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none"
  },
  centerDot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.72)"
  },
  centerCircle: {
    width: "44%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)"
  },
  crossHorizontal: {
    position: "absolute",
    left: "32%",
    right: "32%",
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)"
  },
  crossVertical: {
    position: "absolute",
    top: "38%",
    bottom: "38%",
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)"
  },
  crossFrame: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  crossHorizontalArm: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)"
  },
  crossVerticalArm: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)"
  },
  guideShapeFrame: {
    aspectRatio: 1
  },
  guideShapeLine: {
    position: "absolute"
  },
  guideShapePoint: {
    position: "absolute",
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 999,
    borderWidth: 1
  },
  guideShapePointSelected: {
    transform: [{ scale: 1.28 }]
  },
  gridVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.32)"
  },
  gridHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.32)"
  },
  gridLineSelected: {
    opacity: 0.95
  },
  horizon: {
    position: "absolute",
    left: "16%",
    right: "16%",
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)"
  }
});

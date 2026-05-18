import { type DimensionValue, StyleSheet, View } from "react-native";

import type { GuideType } from "@/constants/camera-guides";

type CameraGuideOverlayProps = {
  guide: GuideType;
  visible: boolean;
  color?: string;
  size?: number;
  aspectRatio?: number;
};

export function CameraGuideOverlay({
  guide,
  visible,
  color = "rgba(255, 255, 255, 0.72)",
  size = 44,
  aspectRatio = 1
}: CameraGuideOverlayProps) {
  if (!visible) {
    return null;
  }

  const safeSize = Math.max(24, Math.min(86, size));
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const inset = `${(100 - safeSize) / 2}%` as DimensionValue;
  const guideWidth = `${safeSize}%` as DimensionValue;
  const guideHeight = `${safeSize}%` as DimensionValue;
  const lineLengthStyle = {
    left: inset,
    right: inset
  };
  const verticalLineLengthStyle = {
    top: inset,
    bottom: inset
  };
  const guideLineStyle = {
    backgroundColor: color
  };
  const secondaryGuideLineStyle = {
    backgroundColor: color,
    opacity: 0.45
  };
  const gridFrameStyle =
    safeAspectRatio >= 1
      ? {
          width: guideWidth,
          aspectRatio: safeAspectRatio
        }
      : {
          height: guideHeight,
          aspectRatio: safeAspectRatio
        };

  return (
    <View style={styles.overlay}>
      {guide === "dot" ? (
        <View style={[styles.centerDot, { backgroundColor: color }]} />
      ) : null}
      {guide === "circle" ? (
        <View
          style={[
            styles.centerCircle,
            {
              width: guideWidth,
              borderColor: color
            }
          ]}
        />
      ) : null}
      {guide === "cross" ? (
        <>
          <View style={[styles.crossHorizontal, lineLengthStyle, guideLineStyle]} />
          <View
            style={[
              styles.crossVertical,
              verticalLineLengthStyle,
              guideLineStyle
            ]}
          />
        </>
      ) : null}
      {guide === "grid" ? (
        <View style={[styles.gridFrame, gridFrameStyle]}>
          <View style={[styles.gridVertical, styles.gridVerticalOne, secondaryGuideLineStyle]} />
          <View style={[styles.gridVertical, styles.gridVerticalTwo, secondaryGuideLineStyle]} />
          <View
            style={[
              styles.gridHorizontal,
              styles.gridHorizontalOne,
              secondaryGuideLineStyle
            ]}
          />
          <View
            style={[
              styles.gridHorizontal,
              styles.gridHorizontalTwo,
              secondaryGuideLineStyle
            ]}
          />
        </View>
      ) : null}
      {guide === "horizon" ? (
        <View style={[styles.horizon, lineLengthStyle, guideLineStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
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
  gridFrame: {
    aspectRatio: 1,
    position: "relative"
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
  gridVerticalOne: {
    left: "33.333%"
  },
  gridVerticalTwo: {
    left: "66.666%"
  },
  gridHorizontalOne: {
    top: "33.333%"
  },
  gridHorizontalTwo: {
    top: "66.666%"
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

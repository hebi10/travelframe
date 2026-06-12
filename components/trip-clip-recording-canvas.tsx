import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { colors } from "@/constants/app-theme";
import type { GuideType } from "@/constants/camera-guides";
import type { TripClipTemplate, TripClipTransition } from "@/constants/trip-clip";
import type { GridGuideLinePositions, GuideShapePoints } from "@/lib/app-settings";
import {
  getTripClipPhotoAdjustment,
  type TripClipPhotoAdjustment,
  type TripClipPhotoAdjustmentMap
} from "@/lib/trip-clip-photo-adjustment";
import type { RecordingFrame } from "@/lib/trip-clip-playback";
import type { PhotoItem } from "@/types/photo";

const getPreviewUri = (photo: PhotoItem) => photo.previewUri ?? photo.uri;

const getRecordingPhotoAdjustmentStyle = (adjustment: TripClipPhotoAdjustment) => ({
  transform: [
    { translateX: adjustment.translateX },
    { translateY: adjustment.translateY },
    { scale: adjustment.scale }
  ]
});

const getOriginalImageFrameStyle = (
  photo: PhotoItem | null,
  frameAspectRatio: number,
  contentFit: "contain" | "cover"
) => {
  const imageAspectRatio =
    photo?.width && photo?.height ? photo.width / photo.height : frameAspectRatio;

  if (!Number.isFinite(imageAspectRatio) || imageAspectRatio <= 0) {
    return {
      width: "100%" as const,
      height: "100%" as const
    };
  }

  const shouldFitByWidth =
    contentFit === "contain"
      ? imageAspectRatio >= frameAspectRatio
      : imageAspectRatio <= frameAspectRatio;

  return shouldFitByWidth
    ? {
        width: "100%" as const,
        aspectRatio: imageAspectRatio
      }
    : {
        height: "100%" as const,
        aspectRatio: imageAspectRatio
      };
};

export function TripClipRecordingCanvas({
  frame,
  template,
  transition,
  showWatermark,
  frameAspectRatio,
  guideVisible,
  guide,
  guideSize,
  guideStrokeWidth,
  guideColor,
  guideLineOpacity = 1,
  guideOffsetX,
  guideOffsetY,
  guideOffsetFrameWidth,
  guideOffsetFrameHeight,
  gridGuideLinePositions,
  guideShapePoints,
  photoAdjustments
}: {
  frame: RecordingFrame;
  template: TripClipTemplate;
  transition: TripClipTransition;
  showWatermark: boolean;
  frameAspectRatio: number;
  guideVisible: boolean;
  guide: GuideType;
  guideSize: number;
  guideStrokeWidth: number;
  guideColor: string;
  guideLineOpacity?: number;
  guideOffsetX: number;
  guideOffsetY: number;
  guideOffsetFrameWidth: number;
  guideOffsetFrameHeight: number;
  gridGuideLinePositions: GridGuideLinePositions;
  guideShapePoints: GuideShapePoints;
  photoAdjustments: TripClipPhotoAdjustmentMap;
}) {
  const isFilm = template === "film-log";
  const isCenter = template === "center-cut";
  const contentFit = isFilm || isCenter ? "contain" : "cover";
  const progress = frame.transitionProgress;
  const currentAdjustmentStyle = getRecordingPhotoAdjustmentStyle(
    getTripClipPhotoAdjustment(photoAdjustments, frame.currentPhoto?.id)
  );
  const nextAdjustmentStyle = getRecordingPhotoAdjustmentStyle(
    getTripClipPhotoAdjustment(photoAdjustments, frame.nextPhoto?.id)
  );
  const currentLayerStyle =
    transition === "fade" && frame.nextPhoto ? { opacity: 1 - progress } : { opacity: 1 };
  const nextLayerStyle =
    transition === "slide"
      ? { opacity: progress > 0 ? 1 : 0, transform: [{ translateX: (1 - progress) * 44 }] }
      : transition === "zoom"
        ? { opacity: progress > 0 ? 1 : 0, transform: [{ scale: 1.08 - progress * 0.08 }] }
        : { opacity: transition === "fade" ? progress : progress > 0 ? 1 : 0 };

  return (
    <View style={[styles.recordingCanvasInner, isFilm && styles.recordingCanvasFilm]}>
      {frame.currentPhoto ? (
        <View style={[styles.recordingLayer, currentLayerStyle]}>
          <View style={[styles.recordingImageMotionLayer, currentAdjustmentStyle]}>
            <Image
              source={{ uri: getPreviewUri(frame.currentPhoto) }}
              style={[
                styles.recordingImage,
                getOriginalImageFrameStyle(frame.currentPhoto, frameAspectRatio, contentFit),
                isFilm && styles.recordingImageFilm
              ]}
              contentFit="fill"
              cachePolicy="memory-disk"
            />
          </View>
        </View>
      ) : null}
      {frame.nextPhoto ? (
        <View style={[styles.recordingLayer, styles.recordingNextLayer, nextLayerStyle]}>
          <View style={[styles.recordingImageMotionLayer, nextAdjustmentStyle]}>
            <Image
              source={{ uri: getPreviewUri(frame.nextPhoto) }}
              style={[
                styles.recordingImage,
                getOriginalImageFrameStyle(frame.nextPhoto, frameAspectRatio, contentFit),
                isFilm && styles.recordingImageFilm
              ]}
              contentFit="fill"
              cachePolicy="memory-disk"
            />
          </View>
        </View>
      ) : null}
      {isFilm ? (
        <View style={styles.recordingFilmMeta}>
          <Text selectable={false} style={styles.recordingFilmText}>
            트래블프레임
          </Text>
          <Text selectable={false} style={styles.recordingFilmText}>
            구도 편집
          </Text>
        </View>
      ) : null}
      {isCenter ? <View style={styles.recordingCenterGuide} /> : null}
      <CameraGuideOverlay
        guide={guide}
        visible={guideVisible}
        size={guideSize}
        strokeWidth={guideStrokeWidth}
        color={guideColor}
        opacity={guideLineOpacity}
        offsetX={guideOffsetX}
        offsetY={guideOffsetY}
        offsetFrameWidth={guideOffsetFrameWidth}
        offsetFrameHeight={guideOffsetFrameHeight}
        gridLinePositions={gridGuideLinePositions}
        shapePoints={guideShapePoints}
      />
      {showWatermark ? (
        <View style={styles.recordingWatermark}>
          <Text selectable={false} style={styles.recordingWatermarkText}>
            트래블프레임
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  recordingCanvasInner: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.ink
  },
  recordingCanvasFilm: {
    padding: 22
  },
  recordingLayer: {
    ...StyleSheet.absoluteFillObject
  },
  recordingNextLayer: {
    zIndex: 2
  },
  recordingImage: {},
  recordingImageMotionLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  recordingImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  recordingFilmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  recordingFilmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  recordingCenterGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  },
  recordingWatermark: {
    position: "absolute",
    right: 18,
    bottom: 18,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0, 0, 0, 0.52)"
  },
  recordingWatermarkText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  }
});

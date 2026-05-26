import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

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
import type { PhotoItem } from "@/types/photo";

type LayerKey = "a" | "b";

type TripClipPreviewPlayerProps = {
  photo: PhotoItem;
  template: TripClipTemplate;
  transition: TripClipTransition;
  transitionDuration: number;
  frameAspectRatio: number;
  adjustEnabled: boolean;
  guideVisible: boolean;
  guide: GuideType;
  guideSize: number;
  guideStrokeWidth: number;
  guideColor: string;
  guideOffsetX?: number;
  guideOffsetY?: number;
  gridGuideLinePositions: GridGuideLinePositions;
  guideShapePoints: GuideShapePoints;
  photoAdjustments: TripClipPhotoAdjustmentMap;
  onPhotoAdjustmentChange: (
    photoId: string,
    adjustment: TripClipPhotoAdjustment
  ) => void;
};

const getPreviewUri = (photo: PhotoItem) => photo.previewUri ?? photo.uri;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric"
  }).format(new Date(value));

const getAdjustmentStyle = (adjustment: TripClipPhotoAdjustment) => ({
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

export function TripClipPreviewPlayer({
  photo,
  template,
  transition,
  transitionDuration,
  frameAspectRatio,
  adjustEnabled,
  guideVisible,
  guide,
  guideSize,
  guideStrokeWidth,
  guideColor,
  guideOffsetX = 0,
  guideOffsetY = 0,
  gridGuideLinePositions,
  guideShapePoints,
  photoAdjustments,
  onPhotoAdjustmentChange
}: TripClipPreviewPlayerProps) {
  const isFilm = template === "film-log";
  const isCenter = template === "center-cut";
  const [activeLayer, setActiveLayer] = useState<LayerKey>("a");
  const [incomingLayer, setIncomingLayer] = useState<LayerKey | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, PhotoItem | null>>({
    a: photo,
    b: null
  });
  const activeLayerRef = useRef<LayerKey>("a");
  const currentPhotoIdRef = useRef(photo.id);
  const runIdRef = useRef(0);
  const transitionProgress = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const currentAdjustment = getTripClipPhotoAdjustment(photoAdjustments, photo.id);

  const contentFit = isCenter || isFilm ? "contain" : "cover";

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  const finishTransition = useCallback((nextLayer: LayerKey, nextPhotoId: string, runId: number) => {
    if (runIdRef.current !== runId) {
      return;
    }

    activeLayerRef.current = nextLayer;
    currentPhotoIdRef.current = nextPhotoId;
    setActiveLayer(nextLayer);
    setIncomingLayer(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const prepareTransition = async () => {
      if (currentPhotoIdRef.current === photo.id) {
        return;
      }

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const nextLayer: LayerKey = activeLayerRef.current === "a" ? "b" : "a";
      const nextUri = getPreviewUri(photo);

      try {
        await Image.prefetch(nextUri, "memory-disk");
        await Image.loadAsync({ uri: nextUri });
      } catch {
        // Continue with the cached/local source even if explicit preload fails.
      }

      if (cancelled || runIdRef.current !== runId) {
        return;
      }

      cancelAnimation(transitionProgress);
      transitionProgress.value = transition === "none" ? 1 : 0;
      setLayers((current) => ({
        ...current,
        [nextLayer]: photo
      }));

      if (transition === "none") {
        finishTransition(nextLayer, photo.id, runId);
        return;
      }

      setIncomingLayer(nextLayer);
      requestAnimationFrame(() => {
        if (cancelled || runIdRef.current !== runId) {
          return;
        }

        transitionProgress.value = withTiming(
          1,
          {
            duration: transition === "fade" ? transitionDuration * 1000 : 520,
            easing: Easing.out(Easing.cubic)
          },
          (finished) => {
            if (finished) {
              runOnJS(finishTransition)(nextLayer, photo.id, runId);
            }
          }
        );
      });
    };

    prepareTransition();

    return () => {
      cancelled = true;
    };
  }, [finishTransition, photo, transition, transitionDuration, transitionProgress]);

  useEffect(() => {
    translateX.value = currentAdjustment.translateX;
    translateY.value = currentAdjustment.translateY;
    scale.value = currentAdjustment.scale;
  }, [
    currentAdjustment.scale,
    currentAdjustment.translateX,
    currentAdjustment.translateY,
    photo.id,
    scale,
    translateX,
    translateY
  ]);

  const commitAdjustment = useCallback(
    (adjustment: TripClipPhotoAdjustment) => {
      onPhotoAdjustmentChange(photo.id, adjustment);
    },
    [onPhotoAdjustmentChange, photo.id]
  );

  const commitCurrentAdjustment = () => {
    "worklet";
    runOnJS(commitAdjustment)({
      translateX: Number(translateX.value.toFixed(2)),
      translateY: Number(translateY.value.toFixed(2)),
      scale: Number(scale.value.toFixed(3))
    });
  };

  const pan = Gesture.Pan()
    .enabled(adjustEnabled)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(commitCurrentAdjustment);

  const pinch = Gesture.Pinch()
    .enabled(adjustEnabled)
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.6, Math.min(4, startScale.value * event.scale));
    })
    .onEnd(commitCurrentAdjustment);

  const gesture = Gesture.Simultaneous(pan, pinch);
  const adjustStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  const layerAStyle = useAnimatedStyle(() => {
    const isIncoming = incomingLayer === "a";
    const isActive = activeLayer === "a";
    const progress = transitionProgress.value;
    const visible = incomingLayer ? isIncoming || isActive : isActive;
    const opacity = !visible
      ? 0
      : isIncoming && transition === "fade"
        ? progress
        : 1;
    const translate = isIncoming && transition === "slide" ? (1 - progress) * 34 : 0;
    const imageScale = isIncoming && transition === "zoom" ? 1.08 - progress * 0.08 : 1;

    return {
      opacity,
      zIndex: isIncoming ? 2 : isActive ? 1 : 0,
      transform: [{ translateX: translate }, { scale: imageScale }]
    };
  });

  const layerBStyle = useAnimatedStyle(() => {
    const isIncoming = incomingLayer === "b";
    const isActive = activeLayer === "b";
    const progress = transitionProgress.value;
    const visible = incomingLayer ? isIncoming || isActive : isActive;
    const opacity = !visible
      ? 0
      : isIncoming && transition === "fade"
        ? progress
        : 1;
    const translate = isIncoming && transition === "slide" ? (1 - progress) * 34 : 0;
    const imageScale = isIncoming && transition === "zoom" ? 1.08 - progress * 0.08 : 1;

    return {
      opacity,
      zIndex: isIncoming ? 2 : isActive ? 1 : 0,
      transform: [{ translateX: translate }, { scale: imageScale }]
    };
  });

  return (
    <View style={[styles.previewInner, isFilm && styles.previewInnerFilm]}>
      <GestureDetector gesture={gesture}>
        <Reanimated.View style={styles.previewGestureLayer}>
          <PreviewLayer
            photo={layers.a}
            animatedStyle={layerAStyle}
            adjustmentStyle={
              layers.a?.id === photo.id
                ? adjustStyle
                : getAdjustmentStyle(getTripClipPhotoAdjustment(photoAdjustments, layers.a?.id))
            }
            contentFit={contentFit}
            frameAspectRatio={frameAspectRatio}
            isFilm={isFilm}
          />
          <PreviewLayer
            photo={layers.b}
            animatedStyle={layerBStyle}
            adjustmentStyle={
              layers.b?.id === photo.id
                ? adjustStyle
                : getAdjustmentStyle(getTripClipPhotoAdjustment(photoAdjustments, layers.b?.id))
            }
            contentFit={contentFit}
            frameAspectRatio={frameAspectRatio}
            isFilm={isFilm}
          />
        </Reanimated.View>
      </GestureDetector>
      {isFilm ? (
        <View style={styles.filmMeta}>
          <Text selectable style={styles.filmText}>
            {formatDate(photo.createdAt)}
          </Text>
          <Text selectable style={styles.filmText}>
            트래블프레임
          </Text>
        </View>
      ) : null}
      {template === "center-cut" ? <View style={styles.centerGuide} /> : null}
      <CameraGuideOverlay
        guide={guide}
        visible={guideVisible}
        size={guideSize}
        strokeWidth={guideStrokeWidth}
        color={guideColor}
        offsetX={guideOffsetX}
        offsetY={guideOffsetY}
        gridLinePositions={gridGuideLinePositions}
        shapePoints={guideShapePoints}
      />
    </View>
  );
}

function PreviewLayer({
  photo,
  animatedStyle,
  adjustmentStyle,
  contentFit,
  frameAspectRatio,
  isFilm
}: {
  photo: PhotoItem | null;
  animatedStyle: object;
  adjustmentStyle: object;
  contentFit: "contain" | "cover";
  frameAspectRatio: number;
  isFilm: boolean;
}) {
  const imageFrameStyle = getOriginalImageFrameStyle(photo, frameAspectRatio, contentFit);

  return (
    <Reanimated.View style={[styles.previewLayer, animatedStyle]}>
      <Reanimated.View style={[styles.previewImageMotionLayer, adjustmentStyle]}>
        {photo ? (
          <Image
            source={{ uri: getPreviewUri(photo) }}
            style={[styles.previewImage, imageFrameStyle, isFilm && styles.previewImageFilm]}
            contentFit="fill"
            cachePolicy="memory-disk"
          />
        ) : null}
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  previewInner: {
    flex: 1,
    backgroundColor: colors.ink,
    position: "relative"
  },
  previewInnerFilm: {
    padding: 22
  },
  previewGestureLayer: {
    flex: 1
  },
  previewLayer: {
    ...StyleSheet.absoluteFillObject
  },
  previewImageMotionLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  previewImage: {},
  previewImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  filmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  filmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  centerGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  }
});


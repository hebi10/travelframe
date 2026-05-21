import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { colors } from "@/constants/app-theme";
import {
  EXPOSURE_CONTROL_GAP,
  EXPOSURE_SUN_ICON_SIZE,
  EXPOSURE_TRACK_WIDTH
} from "@/features/camera/camera-screen.constants";
import {
  getExposureBiasFromTrackX,
  getExposureThumbX,
  getExposureTrackXFromControlX
} from "@/features/camera/camera-screen.helpers";
import { styles } from "@/features/camera/camera-screen.styles";
import { GUIDE_SIZE_MAX, GUIDE_SIZE_MIN } from "@/lib/app-settings";

export type GuideSizeSliderProps = {
  value: number;
  compact?: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
};

export function GuideSizeSlider({
  value,
  compact = false,
  onChange,
  onCommit
}: GuideSizeSliderProps) {
  return (
    <SmoothValueSlider
      value={value}
      min={GUIDE_SIZE_MIN}
      max={GUIDE_SIZE_MAX}
      compact={compact}
      label="미세 조정"
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}

export type SmoothValueSliderProps = {
  value: number;
  min: number;
  max: number;
  label: string;
  compact?: boolean;
  onChange?: (value: number) => void;
  onCommit: (value: number) => void;
};

export type ExposureBiasControlProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
};

export function ExposureBiasControl({
  value,
  min,
  max,
  onChange,
  onCommit,
  onInteractionStart,
  onInteractionEnd
}: ExposureBiasControlProps) {
  const [trackWidth, setTrackWidth] = useState(EXPOSURE_TRACK_WIDTH);
  const [isExposureThumbReady, setIsExposureThumbReady] = useState(true);
  const thumbX = useSharedValue(getExposureThumbX(value, min, max, EXPOSURE_TRACK_WIDTH));
  const dragStartThumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const thumbTranslateX = useDerivedValue(() => thumbX.value - 9);

  const syncExposureThumbPosition = useCallback(
    (width: number) => {
      if (width <= 0) {
        return false;
      }

      const nextX = getExposureThumbX(value, min, max, width);
      if (!isDragging.value) {
        thumbX.value = nextX;
      }
      return true;
    },
    [isDragging, max, min, thumbX, value]
  );

  useEffect(() => {
    if (trackWidth <= 0) {
      return;
    }

    if (syncExposureThumbPosition(trackWidth)) {
      setIsExposureThumbReady(true);
    }
  }, [syncExposureThumbPosition, trackWidth]);

  const sliderGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(trackWidth > 0)
        .hitSlop({ top: 10, bottom: 10, left: 10, right: 10 })
        .onBegin((event) => {
          isDragging.value = true;
          runOnJS(onInteractionStart)();
          dragStartThumbX.value = getExposureTrackXFromControlX(event.x, trackWidth);
          thumbX.value = dragStartThumbX.value;
          runOnJS(onChange)(
            getExposureBiasFromTrackX(dragStartThumbX.value, min, max, trackWidth)
          );
        })
        .onUpdate((event) => {
          const nextX = Math.max(
            0,
            Math.min(trackWidth, dragStartThumbX.value + event.translationX)
          );
          thumbX.value = nextX;
          runOnJS(onChange)(getExposureBiasFromTrackX(nextX, min, max, trackWidth));
        })
        .onFinalize(() => {
          isDragging.value = false;
          runOnJS(onCommit)(
            getExposureBiasFromTrackX(thumbX.value, min, max, trackWidth)
          );
          runOnJS(onInteractionEnd)();
        }),
    [
      dragStartThumbX,
      isDragging,
      max,
      min,
      onChange,
      onCommit,
      onInteractionEnd,
      onInteractionStart,
      thumbX,
      trackWidth
    ]
  );

  const sliderTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(trackWidth > 0)
        .maxDuration(220)
        .hitSlop({ top: 10, bottom: 10, left: 10, right: 10 })
        .onEnd((event) => {
          const nextX = getExposureTrackXFromControlX(event.x, trackWidth);
          thumbX.value = nextX;
          const nextValue = getExposureBiasFromTrackX(nextX, min, max, trackWidth);
          runOnJS(onInteractionStart)();
          runOnJS(onChange)(nextValue);
          runOnJS(onCommit)(nextValue);
          runOnJS(onInteractionEnd)();
        }),
    [
      max,
      min,
      onChange,
      onCommit,
      onInteractionEnd,
      onInteractionStart,
      thumbX,
      trackWidth
    ]
  );

  const exposureGesture = useMemo(
    () => Gesture.Exclusive(sliderGesture, sliderTapGesture),
    [sliderGesture, sliderTapGesture]
  );

  return (
    <GestureDetector gesture={exposureGesture}>
      <Animated.View collapsable={false} style={styles.exposureControl}>
        <Feather name="sun" size={EXPOSURE_SUN_ICON_SIZE} color={colors.inverse} />
        <Animated.View
          collapsable={false}
          style={styles.exposureTrack}
          onLayout={(event) => {
            const nextTrackWidth = event.nativeEvent.layout.width;
            const isReady = syncExposureThumbPosition(nextTrackWidth);
            setIsExposureThumbReady(isReady);
            setTrackWidth(nextTrackWidth);
          }}
        >
          <View style={styles.exposureTrackLine} />
          <View style={styles.exposureCenterMark} />
          <Animated.View
            style={[
              styles.exposureThumb,
              !isExposureThumbReady && styles.exposureThumbHidden,
              { transform: [{ translateX: thumbTranslateX }] }
            ]}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SmoothValueSlider({
  value,
  min,
  max,
  label,
  compact = false,
  onChange,
  onCommit
}: SmoothValueSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbX = useSharedValue(0);
  const dragStartThumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const thumbTranslateX = useDerivedValue(() => thumbX.value - 9);
  const previewValue = onChange ?? onCommit;

  useEffect(() => {
    if (trackWidth <= 0) {
      return;
    }

    const ratio = (value - min) / (max - min);
    const nextX = Math.max(0, Math.min(1, ratio)) * trackWidth;
    if (!isDragging.value) {
      thumbX.value = nextX;
    }
  }, [isDragging, max, min, trackWidth, thumbX, value]);

  const sliderGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(trackWidth > 0)
        .hitSlop({ top: 10, bottom: 10, left: 10, right: 10 })
        .onBegin((event) => {
          isDragging.value = true;
          dragStartThumbX.value = Math.max(0, Math.min(trackWidth, event.x));
          thumbX.value = dragStartThumbX.value;
          const nextRatio =
            trackWidth > 0
              ? Math.max(0, Math.min(1, dragStartThumbX.value / trackWidth))
              : 0;
          runOnJS(previewValue)(min + nextRatio * (max - min));
        })
        .onUpdate((event) => {
          const nextX = Math.max(
            0,
            Math.min(trackWidth, dragStartThumbX.value + event.translationX)
          );
          thumbX.value = nextX;
          const nextRatio =
            trackWidth > 0 ? Math.max(0, Math.min(1, nextX / trackWidth)) : 0;
          runOnJS(previewValue)(min + nextRatio * (max - min));
        })
        .onFinalize(() => {
          const nextRatio =
            trackWidth > 0 ? Math.max(0, Math.min(1, thumbX.value / trackWidth)) : 0;
          isDragging.value = false;
          runOnJS(onCommit)(min + nextRatio * (max - min));
        }),
    [dragStartThumbX, isDragging, max, min, onCommit, previewValue, thumbX, trackWidth]
  );

  if (compact) {
    return (
      <View style={[styles.sizeSliderArea, styles.compactSliderArea]}>
        <View style={styles.compactSliderRow}>
          <Text selectable={false} style={styles.compactSliderLabel}>
            {label}
          </Text>
          <GestureDetector gesture={sliderGesture}>
            <Animated.View
              collapsable={false}
              style={[styles.sizeTrack, styles.compactSizeTrack]}
              onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            >
              <View style={styles.sizeTrackFillBase} />
              <Animated.View style={[styles.sizeTrackFill, { width: thumbX }]} />
              <Animated.View
                style={[
                  styles.sizeThumb,
                  { transform: [{ translateX: thumbTranslateX }] }
                ]}
              />
            </Animated.View>
          </GestureDetector>
          <Text selectable={false} style={styles.compactSliderValue}>
            {Math.round(value)}%
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sizeSliderArea}>
      <View style={styles.sizeSliderMeta}>
        <Text selectable={false} style={styles.sizeSliderMetaText}>
          {label}
        </Text>
        <Text selectable={false} style={styles.sizeSliderMetaText}>
          {Math.round(value)}%
        </Text>
      </View>
      <GestureDetector gesture={sliderGesture}>
        <Animated.View
          collapsable={false}
          style={styles.sizeTrack}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        >
          <View style={styles.sizeTrackFillBase} />
          <Animated.View style={[styles.sizeTrackFill, { width: thumbX }]} />
          <Animated.View
            style={[
              styles.sizeThumb,
              { transform: [{ translateX: thumbTranslateX }] }
            ]}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

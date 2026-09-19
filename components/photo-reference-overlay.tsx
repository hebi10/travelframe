import { Image } from "expo-image";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore
} from "react";
import { StyleSheet } from "react-native";
import {
  Gesture,
  GestureDetector
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";

import {
  getBodyFrameCameraSessionSnapshot,
  subscribeBodyFrameCameraSession
} from "@/lib/body-frame-camera-session";

type PhotoReferenceOverlayProps = {
  visible?: boolean;
  uri: string | null;
  opacity: number;
  locked: boolean;
  resetKey: number;
};

export type PhotoReferenceOverlayHandle = {
  reset: () => void;
  nudge: (x: number, y: number) => void;
  scaleBy: (delta: number) => void;
};

export const PhotoReferenceOverlay = forwardRef<
  PhotoReferenceOverlayHandle,
  PhotoReferenceOverlayProps
>(function PhotoReferenceOverlay({
  visible = true,
  uri,
  opacity,
  locked,
  resetKey
}: PhotoReferenceOverlayProps, ref) {
  const session = useSyncExternalStore(
    subscribeBodyFrameCameraSession,
    getBodyFrameCameraSessionSnapshot,
    getBodyFrameCameraSessionSnapshot
  );
  const manualProjectRevisionRef = useRef(session.projectRevision);
  const manualSignalRef = useRef<{ uri: string | null; resetKey: number }>({
    uri: null,
    resetKey: -1
  });
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  useEffect(() => {
    const manualSignalChanged =
      manualSignalRef.current.uri !== uri ||
      manualSignalRef.current.resetKey !== resetKey;

    if (uri && manualSignalChanged) {
      manualProjectRevisionRef.current = session.projectRevision;
    }

    manualSignalRef.current = { uri, resetKey };
  }, [resetKey, session.projectRevision, uri]);

  const effectiveUri =
    uri && manualProjectRevisionRef.current === session.projectRevision
      ? uri
      : session.automaticReferenceUri;

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    rotation.value = 0;
  }, [
    resetKey,
    session.projectRevision,
    rotation,
    scale,
    translateX,
    translateY
  ]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      rotation.value = 0;
    },
    nudge: (x: number, y: number) => {
      translateX.value += x;
      translateY.value += y;
    },
    scaleBy: (delta: number) => {
      scale.value = Math.max(0.35, Math.min(4, scale.value + delta));
    }
  }));

  const pan = Gesture.Pan()
    .enabled(!locked)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });

  const pinch = Gesture.Pinch()
    .enabled(!locked)
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.35, Math.min(4, startScale.value * event.scale));
    });

  const rotate = Gesture.Rotation()
    .enabled(!locked)
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = startRotation.value + event.rotation;
    });

  const composedGesture = Gesture.Simultaneous(pan, pinch, rotate);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` }
    ]
  }));

  if (!visible || !effectiveUri) {
    return null;
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.layer, animatedStyle]}>
        <Image source={{ uri: effectiveUri }} style={styles.image} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  },
  image: {
    width: "100%",
    height: "100%"
  }
});

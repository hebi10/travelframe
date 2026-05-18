import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";

import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { colors } from "@/constants/app-theme";
import type { GuideType } from "@/constants/camera-guides";
import {
  isRecordingViewAvailable,
  OptionalRecordingView,
  useOptionalViewRecorder
} from "@/lib/view-recorder";
import type { PhotoEditTransform, PhotoRatioLabel } from "@/types/photo";

type EditablePhotoCanvasProps = {
  uri: string | null;
  ratio: PhotoRatioLabel;
  originalAspectRatio?: number;
  initialTransform?: PhotoEditTransform | null;
  initialTransformKey?: number;
  guide: GuideType;
  guideVisible: boolean;
  guideSize: number;
  guideColor: string;
};

export type EditablePhotoCanvasHandle = {
  reset: () => void;
  rotateRight: () => void;
  fillFrame: () => void;
  captureEditedImage: () => Promise<{ uri: string; width: number; height: number }>;
  getTransform: () => PhotoEditTransform;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

const ratioValue: Record<PhotoRatioLabel, number | null> = {
  Original: null,
  "1:1": 1,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9
};

const SNAPSHOT_MAX_EDGE = 1800;

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const toNativeFilePath = (uri: string) => {
  if (uri.startsWith("file:///")) {
    return uri.replace("file://", "");
  }

  if (uri.startsWith("file:/")) {
    return uri.replace("file:", "");
  }

  return uri;
};

const toFileUri = (pathOrUri: string) => {
  if (pathOrUri.startsWith("file://")) {
    return pathOrUri;
  }

  return `file://${pathOrUri}`;
};

const getSnapshotSize = ({
  ratio,
  originalAspectRatio
}: {
  ratio: PhotoRatioLabel;
  originalAspectRatio?: number;
}) => {
  const aspectRatio = ratio === "Original"
    ? originalAspectRatio ?? 4 / 5
    : ratioValue[ratio] ?? 4 / 5;

  if (aspectRatio >= 1) {
    return {
      width: SNAPSHOT_MAX_EDGE,
      height: Math.max(1, Math.round(SNAPSHOT_MAX_EDGE / aspectRatio))
    };
  }

  return {
    width: Math.max(1, Math.round(SNAPSHOT_MAX_EDGE * aspectRatio)),
    height: SNAPSHOT_MAX_EDGE
  };
};

const getRatioAspect = (ratio: PhotoRatioLabel, originalAspectRatio?: number) =>
  ratio === "Original" ? originalAspectRatio ?? 4 / 5 : ratioValue[ratio] ?? 4 / 5;

const getContainedFrameSize = ({
  containerWidth,
  containerHeight,
  aspectRatio
}: {
  containerWidth: number;
  containerHeight: number;
  aspectRatio: number;
}) => {
  const maxWidth = Math.max(1, containerWidth - 28);
  const maxHeight = Math.max(1, containerHeight - 28);
  const containerAspectRatio = maxWidth / maxHeight;

  if (containerAspectRatio > aspectRatio) {
    return {
      width: Math.round(maxHeight * aspectRatio),
      height: Math.round(maxHeight)
    };
  }

  return {
    width: Math.round(maxWidth),
    height: Math.round(maxWidth / aspectRatio)
  };
};

export const EditablePhotoCanvas = forwardRef<
  EditablePhotoCanvasHandle,
  EditablePhotoCanvasProps
>(function EditablePhotoCanvas({
  uri,
  ratio,
  originalAspectRatio,
  initialTransform,
  initialTransformKey = 0,
  guide,
  guideVisible,
  guideSize,
  guideColor
}, ref) {
  const recorder = useOptionalViewRecorder();
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  const [recordingViewAvailable] = useState(isRecordingViewAvailable);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  const reset = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    rotation.value = 0;
  }, [rotation, scale, translateX, translateY]);

  const getCoverScale = useCallback(() => {
    if (!frameSize.width || !frameSize.height || !originalAspectRatio) {
      return 1;
    }

    const frameAspectRatio = frameSize.width / frameSize.height;
    const normalizedRotation = Math.abs(rotation.value % Math.PI);
    const isQuarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.01;
    const imageAspectRatio = isQuarterTurn
      ? 1 / originalAspectRatio
      : originalAspectRatio;

    if (imageAspectRatio > frameAspectRatio) {
      return imageAspectRatio / frameAspectRatio;
    }

    return frameAspectRatio / imageAspectRatio;
  }, [frameSize.height, frameSize.width, originalAspectRatio, rotation]);

  const fillFrame = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = Math.max(1, getCoverScale());
  }, [getCoverScale, scale, translateX, translateY]);

  const applyTransform = useCallback(
    (transform: PhotoEditTransform) => {
      translateX.value = transform.translateX;
      translateY.value = transform.translateY;
      scale.value = transform.scale;
      rotation.value = transform.rotation;
    },
    [rotation, scale, translateX, translateY]
  );

  useEffect(() => {
    reset();
  }, [ratio, reset, uri]);

  useEffect(() => {
    if (initialTransform && uri) {
      applyTransform(initialTransform);
    }
  }, [applyTransform, initialTransform, initialTransformKey, uri]);

  useImperativeHandle(ref, () => ({
    reset,
    rotateRight: () => {
      rotation.value += Math.PI / 2;
    },
    fillFrame,
    captureEditedImage: async () => {
      if (!recordingViewAvailable) {
        throw new Error(
          "편집 이미지 저장 기능이 현재 앱에 연결되지 않았습니다. 최신 Android 개발 빌드를 설치한 뒤 다시 시도해 주세요."
        );
      }

      if (!FileSystem.cacheDirectory) {
        throw new Error("편집 이미지를 만들 임시 저장소를 찾지 못했습니다.");
      }

      const snapshotSize = getSnapshotSize({
        ratio,
        originalAspectRatio
      });
      const outputUri = `${FileSystem.cacheDirectory}edited-photo-${Date.now()}.jpg`;
      const output = toNativeFilePath(outputUri);

      setIsCapturingSnapshot(true);
      await waitForPaint();

      try {
        const path = await recorder.snapshot({
          output,
          format: "jpg",
          quality: 1,
          width: snapshotSize.width,
          height: snapshotSize.height
        });
        const uri = toFileUri(path);
        const fileInfo = await FileSystem.getInfoAsync(uri);

        if (!fileInfo.exists) {
          throw new Error("편집 이미지 생성은 완료됐지만 저장할 파일을 찾지 못했습니다.");
        }

        return {
          uri,
          width: snapshotSize.width,
          height: snapshotSize.height
        };
      } finally {
        setIsCapturingSnapshot(false);
      }
    },
    getTransform: () => ({
      ratioLabel: ratio,
      translateX: Number(translateX.value.toFixed(2)),
      translateY: Number(translateY.value.toFixed(2)),
      scale: Number(scale.value.toFixed(3)),
      rotation: Number(rotation.value.toFixed(4)),
      frameWidth: frameSize.width,
      frameHeight: frameSize.height
    })
  }));

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.35, Math.min(5, startScale.value * event.scale));
    });

  const rotate = Gesture.Rotation()
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = startRotation.value + event.rotation;
    });

  const composedGesture = Gesture.Simultaneous(pan, pinch, rotate);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` }
    ]
  }));

  const frameAspectRatio = getRatioAspect(ratio, originalAspectRatio);
  const frameContent = (
    <>
        {uri ? (
          <GestureDetector gesture={composedGesture}>
            <AnimatedImage
              source={{ uri }}
              style={[styles.image, imageStyle]}
              contentFit="contain"
            />
          </GestureDetector>
        ) : (
          <View style={styles.emptyFrame} />
        )}

        {!isCapturingSnapshot ? (
          <CameraGuideOverlay
            guide={guide}
            visible={guideVisible}
            size={guideSize}
            color={guideColor}
            aspectRatio={frameAspectRatio}
          />
        ) : null}
    </>
  );
  const containedFrameSize =
    stageSize.width && stageSize.height
      ? getContainedFrameSize({
          containerWidth: stageSize.width,
          containerHeight: stageSize.height,
          aspectRatio: frameAspectRatio
        })
      : null;
  const frameStyle = [
    styles.frame,
    isCapturingSnapshot && styles.frameCapturing,
    containedFrameSize ?? {
      width: "100%" as const,
      aspectRatio: frameAspectRatio
    }
  ];
  const handleStageLayout = (event: {
    nativeEvent: { layout: { width: number; height: number } };
  }) => {
    const { width, height } = event.nativeEvent.layout;
    setStageSize({
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2))
    });
  };
  const handleFrameLayout = (event: {
    nativeEvent: { layout: { width: number; height: number } };
  }) => {
    const { width, height } = event.nativeEvent.layout;
    setFrameSize({
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2))
    });
  };

  return (
    <View style={styles.stage} onLayout={handleStageLayout}>
      <OptionalRecordingView
        available={recordingViewAvailable}
        sessionId={recorder.sessionId}
        style={frameStyle}
        onLayout={handleFrameLayout}
      >
        {frameContent}
      </OptionalRecordingView>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    backgroundColor: colors.ink
  },
  frame: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: colors.text
  },
  frameCapturing: {
    borderWidth: 0
  },
  image: {
    width: "100%",
    height: "100%"
  },
  emptyFrame: {
    flex: 1,
    backgroundColor: colors.text
  }
});

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
  guideStrokeWidth: number;
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
const PREVIEW_FRAME_FILL_RATIO = 0.9;

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
  aspectRatio,
  fillRatio = 1
}: {
  containerWidth: number;
  containerHeight: number;
  aspectRatio: number;
  fillRatio?: number;
}) => {
  const maxWidth = Math.max(1, Math.round((containerWidth - 28) * fillRatio));
  const maxHeight = Math.max(1, Math.round((containerHeight - 28) * fillRatio));
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

const getCoverImageSize = ({
  frameWidth,
  frameHeight,
  imageAspectRatio
}: {
  frameWidth: number;
  frameHeight: number;
  imageAspectRatio?: number;
}) => {
  if (!frameWidth || !frameHeight || !imageAspectRatio) {
    return {
      width: Math.max(1, frameWidth),
      height: Math.max(1, frameHeight)
    };
  }

  const frameAspectRatio = frameWidth / frameHeight;

  if (imageAspectRatio > frameAspectRatio) {
    return {
      width: Math.round(frameHeight * imageAspectRatio),
      height: frameHeight
    };
  }

  return {
    width: frameWidth,
    height: Math.round(frameWidth / imageAspectRatio)
  };
};

const getPreviewSurfaceSize = ({
  frameWidth,
  frameHeight,
  imageWidth,
  imageHeight
}: {
  frameWidth: number;
  frameHeight: number;
  imageWidth: number;
  imageHeight: number;
}) => ({
  width: Math.max(frameWidth, imageWidth),
  height: Math.max(frameHeight, imageHeight)
});

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
  guideStrokeWidth,
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

  const fillFrame = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
  }, [scale, translateX, translateY]);

  const applyTransform = useCallback(
    (transform: PhotoEditTransform) => {
      translateX.value = transform.translateX;
      translateY.value = transform.translateY;
      scale.value = Math.max(1, transform.scale);
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
      scale.value = Math.max(1, Math.min(5, startScale.value * event.scale));
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
  const captureFrameSize =
    stageSize.width && stageSize.height
      ? getContainedFrameSize({
          containerWidth: stageSize.width,
          containerHeight: stageSize.height,
          aspectRatio: frameAspectRatio
        })
      : null;
  const previewFrameSize =
    stageSize.width && stageSize.height
      ? getContainedFrameSize({
          containerWidth: stageSize.width,
          containerHeight: stageSize.height,
          aspectRatio: frameAspectRatio,
          fillRatio: PREVIEW_FRAME_FILL_RATIO
        })
      : null;
  const containedFrameSize = isCapturingSnapshot ? captureFrameSize : previewFrameSize;
  const activeFrameSize = containedFrameSize ?? frameSize;
  const frameStyle = [
    styles.frame,
    isCapturingSnapshot && styles.frameCapturing,
    containedFrameSize ?? {
      width: "100%" as const,
      aspectRatio: frameAspectRatio
    }
  ];
  const imageDisplaySize = getCoverImageSize({
    frameWidth: activeFrameSize.width,
    frameHeight: activeFrameSize.height,
    imageAspectRatio: originalAspectRatio
  });
  const imageLayoutStyle =
    activeFrameSize.width && activeFrameSize.height
      ? {
          width: imageDisplaySize.width,
          height: imageDisplaySize.height,
          left: Math.round((activeFrameSize.width - imageDisplaySize.width) / 2),
          top: Math.round((activeFrameSize.height - imageDisplaySize.height) / 2)
        }
      : {
          width: "100%" as const,
          height: "100%" as const,
          left: 0,
          top: 0
        };
  const previewSurfaceSize =
    containedFrameSize && activeFrameSize.width && activeFrameSize.height
      ? getPreviewSurfaceSize({
          frameWidth: activeFrameSize.width,
          frameHeight: activeFrameSize.height,
          imageWidth: imageDisplaySize.width,
          imageHeight: imageDisplaySize.height
        })
      : null;
  const frameOffset = previewSurfaceSize
    ? {
        left: Math.round((previewSurfaceSize.width - activeFrameSize.width) / 2),
        top: Math.round((previewSurfaceSize.height - activeFrameSize.height) / 2)
      }
    : { left: 0, top: 0 };
  const editableFrameStyle = [
    frameStyle,
    styles.framePreview,
    previewSurfaceSize
      ? {
          position: "absolute" as const,
          left: frameOffset.left,
          top: frameOffset.top
        }
      : null
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

  if (!isCapturingSnapshot) {
    return (
      <View style={styles.stage} onLayout={handleStageLayout}>
        <GestureDetector gesture={composedGesture}>
          <View
            style={[
              styles.previewSurface,
              previewSurfaceSize ?? containedFrameSize ?? {
                width: "100%",
                aspectRatio: frameAspectRatio
              }
            ]}
          >
            <View style={editableFrameStyle} onLayout={handleFrameLayout}>
              {uri ? (
                <AnimatedImage
                  source={{ uri }}
                  style={[styles.image, imageLayoutStyle, imageStyle]}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.emptyFrame} />
              )}

              <CameraGuideOverlay
                guide={guide}
                visible={guideVisible}
                size={guideSize}
                strokeWidth={guideStrokeWidth}
                color={guideColor}
                aspectRatio={frameAspectRatio}
              />
            </View>

            {previewSurfaceSize ? (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.cropMask,
                    {
                      left: 0,
                      top: 0,
                      width: previewSurfaceSize.width,
                      height: frameOffset.top
                    }
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.cropMask,
                    {
                      left: 0,
                      top: frameOffset.top + activeFrameSize.height,
                      width: previewSurfaceSize.width,
                      height: Math.max(
                        0,
                        previewSurfaceSize.height - frameOffset.top - activeFrameSize.height
                      )
                    }
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.cropMask,
                    {
                      left: 0,
                      top: frameOffset.top,
                      width: frameOffset.left,
                      height: activeFrameSize.height
                    }
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.cropMask,
                    {
                      left: frameOffset.left + activeFrameSize.width,
                      top: frameOffset.top,
                      width: Math.max(
                        0,
                        previewSurfaceSize.width - frameOffset.left - activeFrameSize.width
                      ),
                      height: activeFrameSize.height
                    }
                  ]}
                />
              </>
            ) : null}

            {previewSurfaceSize ? (
              <View
                pointerEvents="none"
                style={[
                  styles.cropBorder,
                  {
                    width: activeFrameSize.width,
                    height: activeFrameSize.height,
                    left: frameOffset.left,
                    top: frameOffset.top
                  }
                ]}
              />
            ) : null}
          </View>
        </GestureDetector>
      </View>
    );
  }

  return (
    <View style={styles.stage} onLayout={handleStageLayout}>
      <OptionalRecordingView
        available={recordingViewAvailable}
        sessionId={recorder.sessionId}
        style={frameStyle}
        onLayout={handleFrameLayout}
      >
        {uri ? (
          <AnimatedImage
            source={{ uri }}
            style={[styles.image, imageLayoutStyle, imageStyle]}
            contentFit="cover"
          />
        ) : (
          <View style={styles.emptyFrame} />
        )}
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
  previewSurface: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505"
  },
  frame: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: colors.text
  },
  framePreview: {
    overflow: "visible",
    borderWidth: 0,
    backgroundColor: "transparent"
  },
  frameCapturing: {
    borderWidth: 0
  },
  image: {
    position: "absolute"
  },
  cropMask: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.62)"
  },
  cropBorder: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.96)",
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6
  },
  emptyFrame: {
    flex: 1,
    backgroundColor: colors.text
  }
});

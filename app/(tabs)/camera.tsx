import {
  CameraView,
  type CameraType,
  type FlashMode,
  useCameraPermissions
} from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from "react-native-gesture-handler";
import {
  ActivityIndicator,
  Image as NativeImage,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  AppState
} from "react-native";
import Animated, {
  runOnJS,
  useDerivedValue,
  useSharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { ChevronIcon } from "@/components/chevron-icon";
import {
  PhotoReferenceOverlay,
  type PhotoReferenceOverlayHandle
} from "@/components/photo-reference-overlay";
import { colors, controls, typography } from "@/constants/app-theme";
import {
  GUIDE_LABELS,
  GUIDE_TYPES,
  type GuideType
} from "@/constants/camera-guides";
import { useAuth } from "@/lib/auth-context";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import { backupPhotoIfEnabled } from "@/lib/cloud-backup";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  getAppSettings,
  updateAppSettings,
  type CameraSaveScope
} from "@/lib/app-settings";
import {
  deleteLocalFile,
  getRecentPhoto,
  saveCapturedPhoto,
  saveCapturedPhotoToDevice
} from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { PhotoItem, PhotoRatioLabel } from "@/types/photo";

const GUIDE_SIZE_OPTIONS = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;
const GUIDE_STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 5] as const;
const OVERLAY_OPACITY_MIN = 10;
const OVERLAY_OPACITY_MAX = 85;

const GUIDE_COLOR_OPTIONS = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

const CAMERA_NAV_ITEMS = [
  { label: "홈", detail: "시작 화면", href: "/home" },
  { label: "마이페이지", detail: "계정과 구독 관리", href: "/account" },
  { label: "편집", detail: "사진 관리", href: "/studio" },
  { label: "앱 설정", detail: "기본값 관리", href: "/settings" }
] as const;

const CAMERA_TIMER_OPTIONS = [
  { label: "끔", value: 0 },
  { label: "3초", value: 3 },
  { label: "10초", value: 10 }
] as const;

const CAMERA_QUALITY_OPTIONS = [
  { label: "일반", value: "standard", quality: 0.82 },
  { label: "높음", value: "high", quality: 0.92 },
  { label: "최대", value: "max", quality: 1 }
] as const;

const CAMERA_RATIO_OPTIONS: { label: string; value: PhotoRatioLabel }[] = [
  { label: "원본", value: "Original" },
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "4:5", value: "4:5" },
  { label: "9:16", value: "9:16" },
  { label: "16:9", value: "16:9" }
];

const CAMERA_SAVE_SCOPE_OPTIONS: { label: string; detail: string; value: CameraSaveScope }[] = [
  { label: "앱", detail: "앱 사진 목록에만 저장", value: "app" },
  { label: "핸드폰", detail: "핸드폰 앨범에만 저장", value: "device" },
  { label: "앱, 핸드폰", detail: "앱과 앨범에 함께 저장", value: "both" }
];

const cameraRatioAspect: Record<PhotoRatioLabel, number | null> = {
  Original: null,
  "1:1": 1,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9
};

const CAMERA_FACING_OPTIONS: { label: string; value: CameraType }[] = [
  { label: "후면", value: "back" },
  { label: "전면", value: "front" }
];

const CAMERA_FLASH_OPTIONS: { label: string; value: FlashMode }[] = [
  { label: "끔", value: "off" },
  { label: "자동", value: "auto" },
  { label: "켜짐", value: "on" }
];

const CAMERA_ZOOM_MIN = 0;
const CAMERA_ZOOM_MAX = 100;
const CAMERA_FLIP_SWIPE_THRESHOLD = 70;
const CAMERA_FLIP_HORIZONTAL_TOLERANCE = 1.4;

type CameraTimerValue = (typeof CAMERA_TIMER_OPTIONS)[number]["value"];
type CameraQualityValue = (typeof CAMERA_QUALITY_OPTIONS)[number]["value"];

const sleep = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export default function CameraScreen() {
  const { user, subscription } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const referenceOverlayRef = useRef<PhotoReferenceOverlayHandle>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const hasRequestedPermissionOnFocus = useRef(false);
  const [guideVisible, setGuideVisible] = useState(true);
  const [guide, setGuide] = useState<GuideType>("circle");
  const [guideSize, setGuideSize] = useState(44);
  const [guideSizeInput, setGuideSizeInput] = useState("44");
  const [guideStrokeWidth, setGuideStrokeWidth] = useState(1);
  const [guideColor, setGuideColor] = useState<string>(GUIDE_COLOR_OPTIONS[0].value);
  const [guideOffsetX, setGuideOffsetX] = useState(0);
  const [guideOffsetY, setGuideOffsetY] = useState(0);
  const [isGuidePositionAdjusting, setIsGuidePositionAdjusting] = useState(false);
  const [guideChoiceOpen, setGuideChoiceOpen] = useState(false);
  const [guideSettingsOpen, setGuideSettingsOpen] = useState(false);
  const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [shutterTimer, setShutterTimer] = useState<CameraTimerValue>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [photoQuality, setPhotoQuality] = useState<CameraQualityValue>("high");
  const [cameraRatio, setCameraRatio] = useState<PhotoRatioLabel>("Original");
  const [cameraSaveScope, setCameraSaveScope] = useState<CameraSaveScope>("app");
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(0);
  const [shutterSoundEnabled, setShutterSoundEnabled] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [referenceUri, setReferenceUri] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.42);
  const defaultOverlayOpacity = useRef(0.4);
  const [overlaySetupActive, setOverlaySetupActive] = useState(false);
  const [overlayLocked, setOverlayLocked] = useState(false);
  const [overlayResetKey, setOverlayResetKey] = useState(0);
  const [recentPhoto, setRecentPhoto] = useState<PhotoItem | null>(null);
  const [cameraFrame, setCameraFrame] = useState({ width: 0, height: 0 });
  const guideOffsetXValue = useSharedValue(0);
  const guideOffsetYValue = useSharedValue(0);
  const guideDragStartX = useSharedValue(0);
  const guideDragStartY = useSharedValue(0);
  const cameraPinchStartZoomPercent = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 10, 24);
  const bottomModalPadding = Math.max(insets.bottom + 18, 28);
  const modalSafeStyle = useMemo(
    () => ({
      paddingTop: Math.max(insets.top + 14, 14),
      paddingBottom: Math.max(insets.bottom + 14, 14)
    }),
    [insets.bottom, insets.top]
  );
  const isCameraModalOpen = guideChoiceOpen || guideSettingsOpen || cameraSettingsOpen || navigationOpen;

  const returnFromPermissionScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/home");
  }, []);

  const openPermissionSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const requestCameraPermissionOnFocus = async () => {
        if (hasRequestedPermissionOnFocus.current) {
          return;
        }

        const nextPermission = permission ?? (await getPermission());
        if (
          !nextPermission ||
          (!nextPermission.granted && nextPermission.canAskAgain)
        ) {
          hasRequestedPermissionOnFocus.current = true;
          await requestPermission();
        }
      };

      void requestCameraPermissionOnFocus();

      return () => {
        hasRequestedPermissionOnFocus.current = false;
      };
    }, [getPermission, permission, requestPermission])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void getPermission();
      }
    });

    return () => subscription.remove();
  }, [getPermission]);

  const applyGuideSize = useCallback((value: number) => {
    const nextSize = Math.round(
      Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, value))
    );
    setGuideSize(nextSize);
    setGuideSizeInput(String(nextSize));
    setGuideVisible(true);
    void updateAppSettings({
      guideSize: nextSize,
      guideVisible: true
    });
  }, []);

  const previewGuideSize = useCallback((value: number) => {
    const nextSize = Math.round(
      Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, value))
    );
    setGuideSize(nextSize);
    setGuideSizeInput(String(nextSize));
    setGuideVisible(true);
  }, []);

  const updateGuideType = (nextGuide: GuideType) => {
    setGuide(nextGuide);
    setGuideVisible(true);
    void updateAppSettings({
      defaultGuide: nextGuide,
      guideVisible: true
    });
  };

  const updateGuideVisibility = (nextVisible: boolean) => {
    setGuideVisible(nextVisible);
    void updateAppSettings({ guideVisible: nextVisible });
  };

  const updateGuideStrokeWidth = (nextStrokeWidth: number) => {
    const clampedStrokeWidth = Math.round(
      Math.max(
        GUIDE_STROKE_WIDTH_MIN,
        Math.min(GUIDE_STROKE_WIDTH_MAX, nextStrokeWidth)
      )
    );
    setGuideStrokeWidth(clampedStrokeWidth);
    setGuideVisible(true);
    void updateAppSettings({
      guideStrokeWidth: clampedStrokeWidth,
      guideVisible: true
    });
  };

  const updateGuideColor = (nextColor: string) => {
    setGuideColor(nextColor);
    setGuideVisible(true);
    void updateAppSettings({
      guideColor: nextColor,
      guideVisible: true
    });
  };

  const commitGuideSizeInput = () => {
    const parsedSize = Number(guideSizeInput);
    if (!Number.isFinite(parsedSize)) {
      setGuideSizeInput(String(guideSize));
      return;
    }

    applyGuideSize(parsedSize);
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSettings = async () => {
        const [settings, latestPhoto] = await Promise.all([
          getAppSettings(),
          getRecentPhoto()
        ]);
        if (!isActive) {
          return;
        }

        defaultOverlayOpacity.current = settings.overlayOpacity;
        setGuide(settings.defaultGuide);
        setGuideVisible(settings.guideVisible);
        setGuideSize(settings.guideSize);
        setGuideSizeInput(String(settings.guideSize));
        setGuideStrokeWidth(settings.guideStrokeWidth);
        setGuideColor(settings.guideColor);
        setGuideOffsetX(settings.guideOffsetX);
        setGuideOffsetY(settings.guideOffsetY);
        guideOffsetXValue.value = settings.guideOffsetX;
        guideOffsetYValue.value = settings.guideOffsetY;
        setOverlayOpacity(settings.overlayOpacity);
        setCameraRatio(settings.cameraRatio);
        setCameraSaveScope(settings.cameraSaveScope);
        setRecentPhoto(latestPhoto);
      };

      loadSettings();

      return () => {
        isActive = false;
      };
    }, [guideOffsetXValue, guideOffsetYValue])
  );

  const triggerFeedback = useCallback(async () => {
    if (!hapticEnabled) {
      return;
    }

    try {
      await Haptics.selectionAsync();
    } catch {
      // 웹과 일부 시뮬레이터에서는 햅틱이 지원되지 않을 수 있습니다.
    }
  }, [hapticEnabled]);

  const capturePhoto = async () => {
    if (!cameraRef.current || !isCameraReady) {
      return;
    }

    try {
      setIsCapturing(true);
      setErrorMessage(null);
      await triggerFeedback();
      const quality =
        CAMERA_QUALITY_OPTIONS.find((option) => option.value === photoQuality)
          ?.quality ?? 0.92;
      const photo = await cameraRef.current.takePictureAsync({
        quality,
        exif: false,
        shutterSound: shutterSoundEnabled
      });
      const captureInput = {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        ratioLabel: cameraRatio
      };
      let savedPhoto: PhotoItem | null = null;

      if (cameraSaveScope !== "device") {
        savedPhoto = await saveCapturedPhoto(captureInput);
      }

      if (cameraSaveScope !== "app") {
        await saveCapturedPhotoToDevice(captureInput);
      }
      if (__DEV__) {
        console.log("[camera] captured", {
          facing: cameraFacing,
          cameraSaveScope,
          sourceUri: photo.uri,
          width: photo.width,
          height: photo.height,
          savedUri: savedPhoto?.uri,
          previewUri: savedPhoto?.previewUri
        });
      }
      if (savedPhoto) {
        setRecentPhoto(savedPhoto);

        try {
        await backupPhotoIfEnabled({
          user,
          subscription,
          photo: savedPhoto
        });
        } catch (backupError) {
        console.error("촬영 사진 자동 백업에 실패했습니다.", backupError);
        await recordBackupFailure({
          id: savedPhoto.id,
          kind: "photo",
          label: "촬영 사진",
          message: getUserFacingErrorMessage(
            backupError,
            "클라우드 백업을 완료하지 못했습니다."
          )
        });
        }
      }

      try {
        await deleteLocalFile(photo.uri);
      } catch (cleanupError) {
        console.error("임시 촬영 파일을 정리하지 못했습니다.", cleanupError);
      }
    } catch (error) {
      setErrorMessage(getUserFacingErrorMessage(error, "사진을 촬영하지 못했습니다."));
    } finally {
      setIsCapturing(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    if (shutterTimer <= 0) {
      await capturePhoto();
      return;
    }

    try {
      setIsCapturing(true);
      setErrorMessage(null);
      for (let remaining = shutterTimer; remaining > 0; remaining -= 1) {
        setCountdown(remaining);
        await triggerFeedback();
        await sleep(1000);
      }
    } finally {
      setCountdown(null);
      setIsCapturing(false);
    }

    await capturePhoto();
  };

  const pickReferencePhoto = async () => {
    try {
      setErrorMessage(null);
      await triggerFeedback();
      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync(false);

      if (!mediaPermission.granted) {
        setErrorMessage("이전 사진 오버레이를 사용하려면 앨범 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setReferenceUri(result.assets[0].uri);
        setOverlayOpacity(defaultOverlayOpacity.current);
        setOverlaySetupActive(true);
        setOverlayLocked(false);
        setOverlayResetKey((value) => value + 1);
      }
    } catch (error) {
      setErrorMessage(getUserFacingErrorMessage(error, "사진을 불러오지 못했습니다."));
    }
  };

  const applyOverlayOpacityPercent = useCallback((value: number) => {
    const nextOpacity = Math.round(
      Math.max(OVERLAY_OPACITY_MIN, Math.min(OVERLAY_OPACITY_MAX, value))
    );
    setOverlayOpacity(Number((nextOpacity / 100).toFixed(2)));
  }, []);

  const applyZoomPercent = useCallback((value: number) => {
    const nextZoom = Math.round(
      Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, value))
    );
    setZoomPercent(nextZoom);
  }, []);

  const changeCameraFacing = useCallback((value: CameraType) => {
    setCameraFacing(value);
    if (value === "front") {
      setTorchEnabled(false);
    }
  }, []);

  const updateCameraRatio = (nextRatio: PhotoRatioLabel) => {
    setCameraRatio(nextRatio);
    void updateAppSettings({ cameraRatio: nextRatio });
    void triggerFeedback();
  };

  const updateCameraSaveScope = (nextScope: CameraSaveScope) => {
    setCameraSaveScope(nextScope);
    void updateAppSettings({ cameraSaveScope: nextScope });
    void triggerFeedback();
  };

  const toggleCameraFacingBySwipe = useCallback(() => {
    changeCameraFacing(cameraFacing === "back" ? "front" : "back");
    void triggerFeedback();
  }, [cameraFacing, changeCameraFacing, triggerFeedback]);

  const resetOverlay = () => {
    setOverlayOpacity(defaultOverlayOpacity.current);
    referenceOverlayRef.current?.reset();
    setOverlayLocked(false);
    setOverlaySetupActive(true);
    setOverlayResetKey((value) => value + 1);
  };

  const confirmOverlaySetup = () => {
    setOverlayLocked(true);
    setOverlaySetupActive(false);
  };

  const removeReferenceOverlay = () => {
    setReferenceUri(null);
    setOverlayLocked(false);
    setOverlaySetupActive(false);
    setOverlayOpacity(defaultOverlayOpacity.current);
    setOverlayResetKey((value) => value + 1);
  };

  const reopenOverlaySetup = () => {
    if (!referenceUri) {
      pickReferencePhoto();
      return;
    }

    setOverlayLocked(false);
    setOverlaySetupActive(true);
  };

  const openNavigationMenu = () => {
    setCameraMenuOpen(false);
    setNavigationOpen(true);
  };

  const openCameraSettingsMenu = () => {
    setCameraMenuOpen(false);
    setCameraSettingsOpen(true);
  };

  const openGuideChoiceMenu = () => {
    setCameraMenuOpen(false);
    setGuideChoiceOpen(true);
  };

  const openLineGuideSettings = () => {
    setGuideChoiceOpen(false);
    setGuideSettingsOpen(true);
  };

  const openPhotoGuideSettings = () => {
    setGuideChoiceOpen(false);
    reopenOverlaySetup();
  };

  const getClampedGuideOffset = useCallback(
    (nextX: number, nextY: number) => {
      const maxX = Math.max(0, cameraFrame.width * 0.42);
      const maxY = Math.max(0, cameraFrame.height * 0.42);

      return {
        x: Math.round(Math.max(-maxX, Math.min(maxX, nextX))),
        y: Math.round(Math.max(-maxY, Math.min(maxY, nextY)))
      };
    },
    [cameraFrame.height, cameraFrame.width]
  );

  const syncGuideOffsetFromGesture = useCallback(
    (nextX: number, nextY: number) => {
      const clampedOffset = getClampedGuideOffset(nextX, nextY);
      setGuideOffsetX(clampedOffset.x);
      setGuideOffsetY(clampedOffset.y);
    },
    [getClampedGuideOffset]
  );

  const startGuidePositionAdjustment = () => {
    setGuideSettingsOpen(false);
    setCameraMenuOpen(false);
    setGuideVisible(true);
    guideOffsetXValue.value = guideOffsetX;
    guideOffsetYValue.value = guideOffsetY;
    setIsGuidePositionAdjusting(true);
  };

  const finishGuidePositionAdjustment = () => {
    const clampedOffset = getClampedGuideOffset(
      guideOffsetXValue.value,
      guideOffsetYValue.value
    );
    guideOffsetXValue.value = clampedOffset.x;
    guideOffsetYValue.value = clampedOffset.y;
    setGuideOffsetX(clampedOffset.x);
    setGuideOffsetY(clampedOffset.y);
    setIsGuidePositionAdjusting(false);
    setGuideSettingsOpen(true);
    void updateAppSettings({
      guideOffsetX: clampedOffset.x,
      guideOffsetY: clampedOffset.y,
      guideVisible: true
    });
  };

  const resetGuidePositionToCenter = () => {
    guideOffsetXValue.value = 0;
    guideOffsetYValue.value = 0;
    setGuideOffsetX(0);
    setGuideOffsetY(0);
  };

  const navigateFromCamera = (href: (typeof CAMERA_NAV_ITEMS)[number]["href"]) => {
    setNavigationOpen(false);
    router.push(href);
  };

  const openPersonalGallery = () => {
    router.push("/studio");
  };

  const cameraSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(
          !isCameraModalOpen &&
            !cameraMenuOpen &&
            !overlaySetupActive &&
            !isGuidePositionAdjusting &&
            !isCapturing
        )
        .activeOffsetY([-CAMERA_FLIP_SWIPE_THRESHOLD, CAMERA_FLIP_SWIPE_THRESHOLD])
        .failOffsetX([-CAMERA_FLIP_SWIPE_THRESHOLD, CAMERA_FLIP_SWIPE_THRESHOLD])
        .onEnd((event) => {
          const verticalDistance = Math.abs(event.translationY);
          const horizontalDistance = Math.abs(event.translationX);

          if (
            verticalDistance > CAMERA_FLIP_SWIPE_THRESHOLD &&
            verticalDistance > horizontalDistance * CAMERA_FLIP_HORIZONTAL_TOLERANCE
          ) {
            runOnJS(toggleCameraFacingBySwipe)();
          }
        }),
    [
      cameraMenuOpen,
      isCameraModalOpen,
      isGuidePositionAdjusting,
      isCapturing,
      overlaySetupActive,
      toggleCameraFacingBySwipe
    ]
  );

  const cameraPinchZoomGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(
          !referenceUri &&
            !isCameraModalOpen &&
            !cameraMenuOpen &&
            !overlaySetupActive &&
            !isGuidePositionAdjusting &&
            !isCapturing
        )
        .onBegin(() => {
          cameraPinchStartZoomPercent.value = zoomPercent;
        })
        .onUpdate((event) => {
          const nextZoomPercent = Math.max(
            CAMERA_ZOOM_MIN,
            Math.min(
              CAMERA_ZOOM_MAX,
              cameraPinchStartZoomPercent.value + (event.scale - 1) * 45
            )
          );
          runOnJS(applyZoomPercent)(nextZoomPercent);
        }),
    [
      applyZoomPercent,
      cameraMenuOpen,
      cameraPinchStartZoomPercent,
      isCameraModalOpen,
      isCapturing,
      isGuidePositionAdjusting,
      overlaySetupActive,
      referenceUri,
      zoomPercent
    ]
  );

  const cameraPreviewGesture = useMemo(
    () => Gesture.Simultaneous(cameraSwipeGesture, cameraPinchZoomGesture),
    [cameraPinchZoomGesture, cameraSwipeGesture]
  );

  const guidePositionGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isGuidePositionAdjusting)
        .onBegin(() => {
          guideDragStartX.value = guideOffsetXValue.value;
          guideDragStartY.value = guideOffsetYValue.value;
        })
        .onUpdate((event) => {
          const maxX = Math.max(0, cameraFrame.width * 0.42);
          const maxY = Math.max(0, cameraFrame.height * 0.42);
          guideOffsetXValue.value = Math.max(
            -maxX,
            Math.min(maxX, guideDragStartX.value + event.translationX)
          );
          guideOffsetYValue.value = Math.max(
            -maxY,
            Math.min(maxY, guideDragStartY.value + event.translationY)
          );
          runOnJS(syncGuideOffsetFromGesture)(
            guideOffsetXValue.value,
            guideOffsetYValue.value
          );
        }),
    [
      cameraFrame.height,
      cameraFrame.width,
      guideDragStartX,
      guideDragStartY,
      guideOffsetXValue,
      guideOffsetYValue,
      isGuidePositionAdjusting,
      syncGuideOffsetFromGesture
    ]
  );

  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator color={colors.text} />
        <Text selectable style={styles.permissionText}>
          카메라 권한을 확인하는 중입니다.
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text selectable style={styles.permissionTitle}>
          카메라 접근 권한이 필요합니다.
        </Text>
        <Text selectable style={styles.permissionText}>
          실시간 카메라 화면을 보여주고 구도 가이드 촬영을 하려면
          카메라 권한이 필요합니다.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={
            permission.canAskAgain ? requestPermission : openPermissionSettings
          }
        >
          <Text selectable={false} style={styles.permissionButtonText}>
            {permission.canAskAgain ? "카메라 권한 허용" : "앱 설정에서 권한 허용"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.permissionButton, styles.permissionSecondaryButton]}
          onPress={returnFromPermissionScreen}
        >
          <Text selectable={false} style={styles.permissionSecondaryButtonText}>
            뒤로가기
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={styles.screen}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setCameraFrame({ width, height });
      }}
    >
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraFacing}
        flash={flashMode}
        enableTorch={torchEnabled}
        zoom={zoomPercent / 100}
        mode="picture"
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={(event) =>
          setErrorMessage(
            getUserFacingErrorMessage(event.message, "카메라를 시작하지 못했습니다.")
          )
        }
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.guidePositionLayer,
          {
            transform: [
              { translateX: guideOffsetXValue },
              { translateY: guideOffsetYValue }
            ]
          }
        ]}
      >
        <CameraGuideOverlay
          guide={guide}
          visible={guideVisible}
          size={guideSize}
          strokeWidth={guideStrokeWidth}
          color={guideColor}
          aspectRatio={cameraRatioAspect[cameraRatio] ?? 1}
        />
      </Animated.View>
      <PhotoReferenceOverlay
        ref={referenceOverlayRef}
        uri={referenceUri}
        opacity={overlayOpacity}
        locked={overlayLocked}
        resetKey={overlayResetKey}
      />

      {isGuidePositionAdjusting ? (
        <GestureDetector gesture={guidePositionGesture}>
          <View
            collapsable={false}
            pointerEvents="box-only"
            style={styles.guidePositionDragLayer}
          />
        </GestureDetector>
      ) : (
        <GestureDetector gesture={cameraPreviewGesture}>
          <View
            collapsable={false}
            pointerEvents={isCameraModalOpen || overlaySetupActive ? "none" : "box-only"}
            style={styles.cameraSwipeLayer}
          />
        </GestureDetector>
      )}

      {countdown ? (
        <View style={styles.countdownOverlay}>
          <Text selectable={false} style={styles.countdownText}>
            {countdown}
          </Text>
        </View>
      ) : null}

      {!isGuidePositionAdjusting ? (
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text selectable={false} style={styles.brand}>
          트래블프레임
        </Text>
        <View style={styles.cameraMenuWrap}>
          <Pressable
            style={[styles.iconMenuButton, cameraMenuOpen && styles.iconMenuButtonActive]}
            onPress={() => setCameraMenuOpen((value) => !value)}
          >
            <View style={styles.iconMenuLine} />
            <View style={styles.iconMenuLine} />
            <View style={styles.iconMenuLine} />
          </Pressable>
          {cameraMenuOpen ? (
            <View style={styles.cameraDropdown}>
              <Pressable
                style={styles.cameraDropdownItem}
                onPress={openCameraSettingsMenu}
              >
                <Text selectable={false} style={styles.cameraDropdownText}>
                  카메라 설정
                </Text>
              </Pressable>
              <Pressable style={styles.cameraDropdownItem} onPress={openNavigationMenu}>
                <Text selectable={false} style={styles.cameraDropdownText}>
                  페이지 이동
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
      ) : null}

      <Modal
        visible={guideChoiceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGuideChoiceOpen(false)}
      >
        <View style={[styles.navModalBackdrop, modalSafeStyle]}>
          <View style={[styles.navModal, { paddingBottom: bottomModalPadding }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text selectable={false} style={styles.modalEyebrow}>
                  GUIDE
                </Text>
                <Text selectable={false} style={styles.modalTitle}>
                  가이드 띄우기
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setGuideChoiceOpen(false)}
              >
                <Text selectable={false} style={styles.modalCloseText}>
                  닫기
                </Text>
              </Pressable>
            </View>
            <View style={styles.navList}>
              <Pressable style={styles.navItem} onPress={openLineGuideSettings}>
                <View style={styles.navItemCopy}>
                  <Text selectable={false} style={styles.navItemTitle}>
                    라인 가이드
                  </Text>
                  <Text selectable={false} style={styles.navItemDetail}>
                    중앙점, 원, 십자선, 격자, 수평선 가이드를 설정합니다.
                  </Text>
                </View>
                <View style={styles.navItemArrow}>
                  <ChevronIcon color={colors.text} size={10} />
                </View>
              </Pressable>
              <Pressable style={styles.navItem} onPress={openPhotoGuideSettings}>
                <View style={styles.navItemCopy}>
                  <Text selectable={false} style={styles.navItemTitle}>
                    사진 가이드
                  </Text>
                  <Text selectable={false} style={styles.navItemDetail}>
                    이전 사진을 카메라 위에 띄워 같은 구도로 맞춥니다.
                  </Text>
                </View>
                <View style={styles.navItemArrow}>
                  <ChevronIcon color={colors.text} size={10} />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cameraSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCameraSettingsOpen(false)}
      >
        <View style={[styles.navModalBackdrop, modalSafeStyle]}>
          <View style={[styles.navModal, { paddingBottom: bottomModalPadding }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text selectable={false} style={styles.modalEyebrow}>
                  CAMERA
                </Text>
                <Text selectable={false} style={styles.modalTitle}>
                  카메라 설정
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setCameraSettingsOpen(false)}
              >
                <Text selectable={false} style={styles.modalCloseText}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <View style={styles.cameraSettingsScrollShell}>
              <View pointerEvents="none" style={styles.cameraSettingsScrollHint}>
                <Text selectable={false} style={styles.cameraSettingsScrollHintText}>
                  아래로 스크롤
                </Text>
                <Text selectable={false} style={styles.cameraSettingsScrollHintIcon}>
                  ↓
                </Text>
              </View>

              <ScrollView
                style={styles.cameraSettingsScroll}
                contentContainerStyle={styles.cameraSettingsContent}
                showsVerticalScrollIndicator
                persistentScrollbar
              >
                <View style={styles.cameraSettingBlock}>
                  <Text selectable={false} style={styles.modalSectionTitle}>
                    카메라 방향
                  </Text>
                  <View style={styles.optionRow}>
                    {CAMERA_FACING_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionButton,
                          cameraFacing === option.value && styles.optionButtonActive
                        ]}
                        onPress={() => changeCameraFacing(option.value)}
                      >
                        <Text
                          selectable={false}
                          style={[
                            styles.optionButtonText,
                            cameraFacing === option.value && styles.optionButtonTextActive
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.cameraSettingBlock}>
                <Text selectable={false} style={styles.modalSectionTitle}>
                  촬영 타이머
                </Text>
                <View style={styles.optionRow}>
                  {CAMERA_TIMER_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.optionButton,
                        shutterTimer === option.value && styles.optionButtonActive
                      ]}
                      onPress={() => setShutterTimer(option.value)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.optionButtonText,
                          shutterTimer === option.value && styles.optionButtonTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                </View>

                <View style={styles.cameraSettingBlock}>
                <Text selectable={false} style={styles.modalSectionTitle}>
                  조명
                </Text>
                <View style={styles.optionRow}>
                  {CAMERA_FLASH_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.optionButton,
                        flashMode === option.value && styles.optionButtonActive
                      ]}
                      onPress={() => setFlashMode(option.value)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.optionButtonText,
                          flashMode === option.value && styles.optionButtonTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  disabled={cameraFacing === "front"}
                  style={[
                    styles.settingToggleRow,
                    cameraFacing === "front" && styles.settingToggleRowDisabled
                  ]}
                  onPress={() => setTorchEnabled((value) => !value)}
                >
                  <View style={styles.settingToggleCopy}>
                    <Text selectable={false} style={styles.settingToggleTitle}>
                      손전등
                    </Text>
                    <Text selectable={false} style={styles.settingToggleDetail}>
                      어두운 곳에서 계속 켜지는 보조 조명입니다.
                    </Text>
                  </View>
                  <Text selectable={false} style={styles.settingToggleValue}>
                    {torchEnabled && cameraFacing === "back" ? "켜짐" : "꺼짐"}
                  </Text>
                </Pressable>
                </View>

                <View style={styles.cameraSettingBlock}>
                <Text selectable={false} style={styles.modalSectionTitle}>
                  촬영 품질
                </Text>
                <View style={styles.optionRow}>
                  {CAMERA_QUALITY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.optionButton,
                        photoQuality === option.value && styles.optionButtonActive
                      ]}
                      onPress={() => setPhotoQuality(option.value)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.optionButtonText,
                          photoQuality === option.value && styles.optionButtonTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                </View>

                <View style={styles.cameraSettingBlock}>
                <Text selectable={false} style={styles.modalSectionTitle}>
                  카메라 비율
                </Text>
                <View style={styles.optionRow}>
                  {CAMERA_RATIO_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.optionButton,
                        cameraRatio === option.value && styles.optionButtonActive
                      ]}
                      onPress={() => updateCameraRatio(option.value)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.optionButtonText,
                          cameraRatio === option.value && styles.optionButtonTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text selectable={false} style={styles.modalSectionDetail}>
                  촬영 원본은 유지하고, 사진 사용 시 선택한 비율로 저장합니다.
                </Text>
                </View>

                <View style={styles.cameraSettingBlock}>
                  <Text selectable={false} style={styles.modalSectionTitle}>
                    저장 범위
                  </Text>
                  <View style={styles.optionGrid}>
                    {CAMERA_SAVE_SCOPE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionButton,
                          cameraSaveScope === option.value && styles.optionButtonActive
                        ]}
                        onPress={() => updateCameraSaveScope(option.value)}
                      >
                        <Text
                          selectable={false}
                          style={[
                            styles.optionButtonText,
                            cameraSaveScope === option.value && styles.optionButtonTextActive
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text selectable={false} style={styles.modalSectionDetail}>
                    {CAMERA_SAVE_SCOPE_OPTIONS.find((option) => option.value === cameraSaveScope)?.detail}
                  </Text>
                </View>

                <View style={styles.cameraSettingBlock}>
                <Text selectable={false} style={styles.modalSectionTitle}>
                  촬영 보조
                </Text>
                <Pressable
                  style={styles.settingToggleRow}
                  onPress={() => updateGuideVisibility(!guideVisible)}
                >
                  <View style={styles.settingToggleCopy}>
                    <Text selectable={false} style={styles.settingToggleTitle}>
                      가이드 표시
                    </Text>
                    <Text selectable={false} style={styles.settingToggleDetail}>
                      현재 선택한 구도 가이드를 카메라 위에 표시합니다.
                    </Text>
                  </View>
                  <Text selectable={false} style={styles.settingToggleValue}>
                    {guideVisible ? "켜짐" : "꺼짐"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.settingToggleRow}
                  onPress={() => setHapticEnabled((value) => !value)}
                >
                  <View style={styles.settingToggleCopy}>
                    <Text selectable={false} style={styles.settingToggleTitle}>
                      햅틱 피드백
                    </Text>
                    <Text selectable={false} style={styles.settingToggleDetail}>
                      촬영과 주요 조작 시 짧은 진동 피드백을 사용합니다.
                    </Text>
                  </View>
                  <Text selectable={false} style={styles.settingToggleValue}>
                    {hapticEnabled ? "켜짐" : "꺼짐"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.settingToggleRow}
                  onPress={() => setShutterSoundEnabled((value) => !value)}
                >
                  <View style={styles.settingToggleCopy}>
                    <Text selectable={false} style={styles.settingToggleTitle}>
                      셔터음
                    </Text>
                    <Text selectable={false} style={styles.settingToggleDetail}>
                      사진 촬영 시 기본 셔터음을 재생합니다.
                    </Text>
                  </View>
                  <Text selectable={false} style={styles.settingToggleValue}>
                    {shutterSoundEnabled ? "켜짐" : "꺼짐"}
                  </Text>
                </Pressable>
                </View>
              </ScrollView>

              <View pointerEvents="none" style={styles.cameraSettingsBottomHint}>
                <View style={styles.cameraSettingsGrabber} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={navigationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNavigationOpen(false)}
      >
        <View style={[styles.navModalBackdrop, modalSafeStyle]}>
          <View style={[styles.navModal, { paddingBottom: bottomModalPadding }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text selectable={false} style={styles.modalEyebrow}>
                  MOVE
                </Text>
                <Text selectable={false} style={styles.modalTitle}>
                  페이지 이동
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setNavigationOpen(false)}
              >
                <Text selectable={false} style={styles.modalCloseText}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <View style={styles.navList}>
              {CAMERA_NAV_ITEMS.map((item) => (
                <Pressable
                  key={item.href}
                  style={styles.navItem}
                  onPress={() => navigateFromCamera(item.href)}
                >
                  <View style={styles.navItemCopy}>
                    <Text selectable={false} style={styles.navItemTitle}>
                      {item.label}
                    </Text>
                    <Text selectable={false} style={styles.navItemDetail}>
                      {item.detail}
                    </Text>
                  </View>
                  <View style={styles.navItemArrow}>
                    <ChevronIcon color={colors.text} size={10} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={guideSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGuideSettingsOpen(false)}
      >
        <GestureHandlerRootView style={styles.modalGestureRoot}>
          <View style={[styles.modalBackdrop, modalSafeStyle]}>
            <View
              style={[
                styles.guideModal,
                { paddingBottom: bottomModalPadding }
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleGroup}>
                  <Text selectable={false} style={styles.modalEyebrow}>
                    GUIDE
                  </Text>
                  <Text selectable={false} style={styles.modalTitle}>
                    가이드 설정
                  </Text>
                </View>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setGuideSettingsOpen(false)}
                >
                  <Text selectable={false} style={styles.modalCloseText}>
                    닫기
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.guideSettingsScroll}
                contentContainerStyle={styles.guideSettingsContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalSection}>
                  <Text selectable={false} style={styles.modalSectionTitle}>
                    가이드라인
                  </Text>
                  <View style={styles.optionGrid}>
                    {GUIDE_TYPES.map((type) => (
                      <Pressable
                        key={type}
                        style={[
                          styles.optionButton,
                          guide === type && styles.optionButtonActive
                        ]}
                        onPress={() => {
                          updateGuideType(type);
                        }}
                      >
                        <Text
                          selectable={false}
                          style={[
                            styles.optionButtonText,
                            guide === type && styles.optionButtonTextActive
                          ]}
                        >
                          {GUIDE_LABELS[type]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text selectable={false} style={styles.modalSectionTitle}>
                    크기
                  </Text>
                  <View style={styles.optionRow}>
                    {GUIDE_SIZE_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionButton,
                          guideSize === option.value && styles.optionButtonActive
                        ]}
                        onPress={() => applyGuideSize(option.value)}
                      >
                        <Text
                          selectable={false}
                          style={[
                            styles.optionButtonText,
                            guideSize === option.value && styles.optionButtonTextActive
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.sizeFineControl}>
                    <GuideSizeSlider
                      value={guideSize}
                      onChange={previewGuideSize}
                      onCommit={applyGuideSize}
                    />
                    <TextInput
                      value={guideSizeInput}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                      style={styles.sizeInput}
                      onChangeText={(value) =>
                        setGuideSizeInput(value.replace(/[^0-9]/g, ""))
                      }
                      onBlur={commitGuideSizeInput}
                      onSubmitEditing={commitGuideSizeInput}
                    />
                  </View>
                </View>

                <View style={[styles.modalSection, styles.modalSectionSpaced]}>
                  <Text selectable={false} style={styles.modalSectionTitle}>
                    선 두께
                  </Text>
                  <View style={styles.optionRow}>
                    {GUIDE_STROKE_WIDTH_OPTIONS.map((strokeWidth) => {
                      const isActive = guideStrokeWidth === strokeWidth;

                      return (
                        <Pressable
                          key={strokeWidth}
                          style={[
                            styles.optionButton,
                            isActive && styles.optionButtonActive
                          ]}
                          onPress={() => updateGuideStrokeWidth(strokeWidth)}
                        >
                          <Text
                            selectable={false}
                            style={[
                              styles.optionButtonText,
                              isActive && styles.optionButtonTextActive
                            ]}
                          >
                            {strokeWidth}px
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.modalSection, styles.modalSectionSpaced]}>
                  <Text selectable={false} style={styles.modalSectionTitle}>
                    색상
                  </Text>
                  <View style={styles.colorRow}>
                    {GUIDE_COLOR_OPTIONS.map((option) => (
                      <Pressable
                        key={option.label}
                        style={[
                          styles.colorOption,
                          guideColor === option.value && styles.colorOptionActive
                        ]}
                        onPress={() => updateGuideColor(option.value)}
                      >
                        <View
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: option.value }
                          ]}
                        />
                        <Text selectable={false} style={styles.colorLabel}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Pressable
                  style={styles.guidePositionButton}
                  onPress={startGuidePositionAdjustment}
                >
                  <Text selectable={false} style={styles.guidePositionButtonText}>
                    드래그 이동하기
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.visibilityButton, guideVisible && styles.visibilityButtonActive]}
                  onPress={() => updateGuideVisibility(!guideVisible)}
                >
                  <Text
                    selectable={false}
                    style={[
                      styles.visibilityButtonText,
                      guideVisible && styles.visibilityButtonTextActive
                    ]}
                  >
                    가이드 {guideVisible ? "숨기기" : "보이기"}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {!isCameraModalOpen && !isGuidePositionAdjusting ? (
      <View style={[styles.controls, { paddingBottom: bottomSafePadding }]}>
        {errorMessage ? (
          <Text selectable style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        {overlaySetupActive && referenceUri ? (
          <View style={styles.captureRow}>
            <View style={styles.overlaySetupPanel}>
              <View style={styles.overlaySetupHeader}>
                <View>
                  <Text selectable={false} style={styles.overlaySetupTitle}>
                    이전 사진 맞추기
                  </Text>
                  <Text selectable={false} style={styles.overlaySetupHint}>
                    드래그와 손가락 확대/축소로 직접 맞출 수 있습니다.
                  </Text>
                </View>
                <Text selectable={false} style={styles.overlaySetupValue}>
                  {Math.round(overlayOpacity * 100)}%
                </Text>
              </View>
              <View style={styles.overlayOpacityControl}>
                <SmoothValueSlider
                  value={Math.round(overlayOpacity * 100)}
                  min={OVERLAY_OPACITY_MIN}
                  max={OVERLAY_OPACITY_MAX}
                  label="투명도"
                  onChange={applyOverlayOpacityPercent}
                  onCommit={applyOverlayOpacityPercent}
                />
              </View>
              <View style={styles.overlaySetupActions}>
                <Pressable
                  style={styles.overlayCompactButton}
                  onPress={() => referenceOverlayRef.current?.scaleBy(-0.1)}
                >
                  <Text selectable={false} style={styles.overlayCompactText}>
                    작게
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.overlayCompactButton}
                  onPress={() => referenceOverlayRef.current?.scaleBy(0.1)}
                >
                  <Text selectable={false} style={styles.overlayCompactText}>
                    크게
                  </Text>
                </Pressable>
                <Pressable style={styles.overlayCompactButton} onPress={resetOverlay}>
                  <Text selectable={false} style={styles.overlayCompactText}>
                    초기화
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.overlayCompactButton, styles.overlayRemoveButton]}
                  onPress={removeReferenceOverlay}
                >
                  <Text
                    selectable={false}
                    style={[styles.overlayCompactText, styles.overlayRemoveText]}
                  >
                    제거
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.overlayConfirmButton}
                  onPress={confirmOverlaySetup}
                >
                  <Text selectable={false} style={styles.overlayConfirmText}>
                    확인
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <>
            {referenceUri ? (
              <View style={styles.captureOpacityControl}>
                <SmoothValueSlider
                  value={Math.round(overlayOpacity * 100)}
                  min={OVERLAY_OPACITY_MIN}
                  max={OVERLAY_OPACITY_MAX}
                  label="투명도"
                  compact
                  onChange={applyOverlayOpacityPercent}
                  onCommit={applyOverlayOpacityPercent}
                />
              </View>
            ) : null}
            <View style={styles.captureZoomControl}>
              <SmoothValueSlider
                value={zoomPercent}
                min={CAMERA_ZOOM_MIN}
                max={CAMERA_ZOOM_MAX}
                label="줌"
                compact
                onChange={applyZoomPercent}
                onCommit={applyZoomPercent}
              />
            </View>
            <View style={styles.captureRow}>
              <Pressable
                style={styles.guideSettingsButton}
                onPress={openGuideChoiceMenu}
              >
                <View style={styles.guideSettingsIcon}>
                  <View
                    style={[
                      styles.guideSettingsSwatch,
                      { backgroundColor: guideColor }
                    ]}
                  />
                </View>
                <View style={styles.guideSettingsCopy}>
                  <Text selectable={false} style={styles.guideOnlyLabel}>
                    가이드
                  </Text>
                </View>
              </Pressable>
              <Pressable
                disabled={!isCameraReady || isCapturing}
                style={[
                  styles.shutterOuter,
                  (!isCameraReady || isCapturing) && styles.shutterDisabled
                ]}
                onPress={takePhoto}
              >
                <View style={styles.shutterInner} />
              </Pressable>
              {referenceUri ? (
                <View style={styles.opacityQuickControl}>
                  <SmoothValueSlider
                    value={Math.round(overlayOpacity * 100)}
                    min={OVERLAY_OPACITY_MIN}
                    max={OVERLAY_OPACITY_MAX}
                    label="투명도"
                    compact
                    onChange={applyOverlayOpacityPercent}
                    onCommit={applyOverlayOpacityPercent}
                  />
                </View>
              ) : (
                <View style={styles.captureSideSpacer} />
              )}
              <Pressable
                style={styles.galleryButton}
                onPress={openPersonalGallery}
                accessibilityRole="button"
                accessibilityLabel="개인 갤러리 열기"
              >
                {recentPhoto ? (
                  <NativeImage
                    source={{ uri: recentPhoto.uri }}
                    style={styles.galleryThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.galleryEmptyThumb}>
                    <View style={styles.galleryEmptyLine} />
                    <View style={styles.galleryEmptyDot} />
                  </View>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
      ) : null}
      {isGuidePositionAdjusting ? (
        <View
          style={[
            styles.guidePositionActionGroup,
            { right: 16, bottom: bottomSafePadding }
          ]}
        >
          <Pressable
            style={styles.guidePositionSecondaryButton}
            onPress={resetGuidePositionToCenter}
          >
            <Text selectable={false} style={styles.guidePositionSecondaryText}>
              중앙
            </Text>
          </Pressable>
          <Pressable
            style={styles.guidePositionDoneButton}
            onPress={finishGuidePositionAdjustment}
          >
            <Text selectable={false} style={styles.guidePositionDoneText}>
              완료
            </Text>
          </Pressable>
        </View>
      ) : null}
      <AppGuideOverlay tabKey="camera" transparentBackdrop />
    </View>
  );
}

type GuideSizeSliderProps = {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
};

function GuideSizeSlider({ value, onChange, onCommit }: GuideSizeSliderProps) {
  return (
    <SmoothValueSlider
      value={value}
      min={GUIDE_SIZE_MIN}
      max={GUIDE_SIZE_MAX}
      label="미세 조정"
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}

type SmoothValueSliderProps = {
  value: number;
  min: number;
  max: number;
  label: string;
  compact?: boolean;
  onChange?: (value: number) => void;
  onCommit: (value: number) => void;
};

function SmoothValueSlider({
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  guidePositionLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3
  },
  guidePositionDragLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 16,
    backgroundColor: "transparent"
  },
  cameraSwipeLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 92,
    bottom: 188,
    zIndex: 4,
    backgroundColor: "transparent"
  },
  topBar: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  brand: {
    color: colors.inverse,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  cameraMenuWrap: {
    position: "relative",
    alignItems: "flex-end"
  },
  iconMenuButton: {
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
    backgroundColor: "rgba(0, 0, 0, 0.28)"
  },
  iconMenuButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: "rgba(255, 255, 255, 0.16)"
  },
  iconMenuLine: {
    width: 15,
    height: 2,
    backgroundColor: colors.inverse
  },
  cameraDropdown: {
    position: "absolute",
    top: 44,
    right: 0,
    width: 132,
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    backgroundColor: "rgba(0, 0, 0, 0.58)"
  },
  cameraDropdownItem: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)"
  },
  cameraDropdownText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  countdownOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    pointerEvents: "none"
  },
  countdownText: {
    color: colors.inverse,
    fontSize: 72,
    fontWeight: "800",
    lineHeight: 82,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(0, 0, 0, 0.52)"
  },
  overlayPanel: {
    width: "100%",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "rgba(0, 0, 0, 0.36)"
  },
  overlayPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  overlayTitle: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlayValue: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  overlayActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  overlayButton: {
    minHeight: controls.compactHeight,
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.42)"
  },
  overlayButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: "transparent"
  },
  overlayButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlayButtonTextActive: {
    color: colors.inverse
  },
  overlaySetupPanel: {
    width: "100%",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  overlaySetupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  overlaySetupTitle: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlaySetupHint: {
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0
  },
  overlaySetupValue: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  overlaySetupActions: {
    flexDirection: "row",
    gap: 8
  },
  overlayOpacityControl: {
    paddingTop: 2
  },
  overlayCompactButton: {
    minHeight: controls.compactHeight,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.42)"
  },
  overlayRemoveButton: {
    borderColor: "rgba(255, 90, 95, 0.8)"
  },
  overlayCompactText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  overlayRemoveText: {
    color: "#FFB3B6"
  },
  overlayConfirmButton: {
    minHeight: controls.compactHeight,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "transparent"
  },
  overlayConfirmText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 14,
    backgroundColor: "transparent"
  },
  modalGestureRoot: {
    flex: 1
  },
  navModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 14,
    backgroundColor: "transparent"
  },
  guideModal: {
    gap: 16,
    flexGrow: 0,
    maxHeight: "88%",
    padding: 18,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: colors.darkLine,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden"
  },
  navModal: {
    gap: 18,
    flexGrow: 0,
    maxHeight: "88%",
    padding: 18,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: colors.darkLine,
    backgroundColor: colors.background
  },
  cameraSettingsScrollShell: {
    position: "relative",
    gap: 10
  },
  cameraSettingsScrollHint: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  cameraSettingsScrollHintText: {
    color: colors.muted,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  cameraSettingsScrollHintIcon: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
    letterSpacing: 0
  },
  cameraSettingsScroll: {
    flexGrow: 0,
    maxHeight: 560
  },
  cameraSettingsContent: {
    gap: 18,
    paddingBottom: 28
  },
  cameraSettingsBottomHint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
    backgroundColor: "rgba(255, 255, 255, 0.82)"
  },
  cameraSettingsGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.darkLine
  },
  guideSettingsScroll: {
    flexGrow: 0
  },
  guideSettingsContent: {
    gap: 22,
    paddingBottom: 2
  },
  cameraSettingBlock: {
    gap: 10
  },
  settingToggleRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  settingToggleRowDisabled: {
    opacity: 0.45
  },
  settingToggleCopy: {
    flex: 1,
    gap: 4
  },
  settingToggleTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  settingToggleDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  settingToggleValue: {
    minWidth: 42,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  modalTitleGroup: {
    gap: 4
  },
  modalEyebrow: {
    color: colors.faint,
    fontSize: typography.eyebrow,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: 0
  },
  modalCloseButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  modalCloseText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  modalSection: {
    gap: 10
  },
  modalSectionSpaced: {
    paddingTop: 8
  },
  modalSectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  modalSectionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionRow: {
    flexDirection: "row",
    gap: 8
  },
  optionButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  optionButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  optionButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionButtonTextActive: {
    color: colors.inverse
  },
  sizeFineControl: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 2
  },
  sizeSliderArea: {
    flex: 1,
    gap: 9
  },
  compactSliderArea: {
    width: "100%",
    flex: 0
  },
  compactSliderRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  compactSliderLabel: {
    minWidth: 24,
    color: "rgba(255, 255, 255, 0.64)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  compactSliderValue: {
    minWidth: 30,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  sizeSliderMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  sizeSliderMetaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  sizeTrack: {
    height: 28,
    justifyContent: "center"
  },
  compactSizeTrack: {
    flex: 1
  },
  sizeTrackFill: {
    position: "absolute",
    left: 0,
    height: 2,
    backgroundColor: colors.text
  },
  sizeTrackFillBase: {
    height: 2,
    backgroundColor: colors.line
  },
  sizeThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  sizeInput: {
    width: 58,
    minHeight: controls.height,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    textAlign: "center"
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 4
  },
  colorOption: {
    minHeight: 44,
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.line
  },
  colorOptionActive: {
    borderColor: colors.text
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.darkLine
  },
  colorLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  visibilityButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  visibilityButtonActive: {
    backgroundColor: colors.text
  },
  visibilityButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  visibilityButtonTextActive: {
    color: colors.inverse
  },
  guidePositionButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guidePositionButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guidePositionActionGroup: {
    position: "absolute",
    zIndex: 30,
    flexDirection: "row",
    gap: 8
  },
  guidePositionSecondaryButton: {
    minWidth: 76,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  guidePositionSecondaryText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guidePositionDoneButton: {
    minWidth: 88,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.inverse,
    backgroundColor: "rgba(0, 0, 0, 0.58)"
  },
  guidePositionDoneText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  navList: {
    gap: 8
  },
  navItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  navItemCopy: {
    flex: 1,
    gap: 3
  },
  navItemTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  navItemDetail: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0
  },
  navItemArrow: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  captureZoomControl: {
    width: "80%",
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 0
  },
  captureOpacityControl: {
    width: "80%",
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 0
  },
  captureRow: {
    width: "100%",
    minHeight: 66,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  guideSettingsButton: {
    position: "absolute",
    left: 0,
    minWidth: 124,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.38)",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  guideSettingsIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.42)"
  },
  guideSettingsSwatch: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.32)"
  },
  guideSettingsCopy: {
    gap: 3
  },
  guideSettingsLabel: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideOnlyLabel: {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  captureSideSpacer: {
    position: "absolute",
    right: 0,
    width: 92,
    height: controls.height
  },
  opacityQuickControl: {
    position: "absolute",
    right: 0,
    minWidth: 128,
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 2,
    display: "none"
  },
  galleryButton: {
    position: "absolute",
    right: 0,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  galleryThumb: {
    width: "100%",
    height: "100%"
  },
  galleryEmptyThumb: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  galleryEmptyLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.inverse
  },
  galleryEmptyDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: colors.inverse
  },
  opacityStepButton: {
    width: 34,
    height: controls.height,
    alignItems: "center",
    justifyContent: "center"
  },
  opacityStepText: {
    color: colors.inverse,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  opacityValue: {
    minWidth: 42,
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  shutterOuter: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.inverse
  },
  shutterDisabled: {
    opacity: 0.45
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.inverse
  },
  errorText: {
    color: colors.inverse,
    fontSize: typography.small,
    lineHeight: 17,
    textAlign: "center",
    letterSpacing: 0
  },
  permissionScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: colors.background
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center",
    letterSpacing: 0
  },
  permissionText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0
  },
  permissionButton: {
    minHeight: controls.height,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.text
  },
  permissionSecondaryButton: {
    backgroundColor: colors.background,
    borderWidth: controls.borderWidth,
    borderColor: colors.line
  },
  permissionButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  permissionSecondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  }
});


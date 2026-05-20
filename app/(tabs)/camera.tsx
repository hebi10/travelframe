import {
  CameraView,
  type CameraFocusPoint,
  type CameraType,
  type FlashMode,
  useCameraPermissions
} from "expo-camera";
import { Feather } from "@expo/vector-icons";
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
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
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
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import {
  calculateGuidePositionDragOffset,
  clampGuidePositionOffset
} from "@/lib/camera-guide-position";
import {
  getTapExposureControlPosition,
  getNormalizedCameraFocusPoint
} from "@/lib/camera-focus-controls";
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
const CAMERA_ZOOM_PRESETS = [
  { label: "1x", value: 0 },
  { label: "3x", value: 25 },
  { label: "5x", value: 50 },
  { label: "8x", value: 75 },
  { label: "10x", value: 100 }
] as const;
const CAMERA_CONTROL_TABS = [
  { id: "photo", label: "\uC0AC\uC9C4" },
  { id: "zoom", label: "\uD655\uB300" },
  { id: "guide", label: "\uAC00\uC774\uB4DC" },
  { id: "light", label: "\uB77C\uC774\uD2B8" }
] as const;
const CAMERA_CONTROL_TAB_WIDTH = 78;
const CAMERA_CONTROL_TAB_GAP = 6;
const CAMERA_CONTROL_HORIZONTAL_PADDING = 0;
const CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING = 16;
const CAMERA_EXPOSURE_BIAS_MIN = -1;
const CAMERA_EXPOSURE_BIAS_MAX = 1;
const CAMERA_FLIP_SWIPE_THRESHOLD = 70;
const CAMERA_FLIP_HORIZONTAL_TOLERANCE = 1.4;
const CAMERA_FOCUS_CONTROLS_DISMISS_MS = 2500;
const CAMERA_FOCUS_CONTROLS_FADE_MS = 300;
const CAMERA_FOCUS_INDICATOR_SIZE = 62;
const CAMERA_FOCUS_INDICATOR_RADIUS = CAMERA_FOCUS_INDICATOR_SIZE / 2;
const CAMERA_FOCUS_LOCK_BUTTON_SIZE = 22;
const EXPOSURE_CONTROL_WIDTH = 106;
const EXPOSURE_CONTROL_HEIGHT = 34;
const EXPOSURE_CONTROL_OFFSET_Y = 34;
const EXPOSURE_CONTROL_MARGIN = 16;
const EXPOSURE_SUN_ICON_SIZE = 15;
const EXPOSURE_CONTROL_GAP = 7;
const EXPOSURE_TRACK_WIDTH = EXPOSURE_CONTROL_WIDTH - EXPOSURE_SUN_ICON_SIZE - EXPOSURE_CONTROL_GAP;

type CameraTimerValue = (typeof CAMERA_TIMER_OPTIONS)[number]["value"];
type CameraQualityValue = (typeof CAMERA_QUALITY_OPTIONS)[number]["value"];
type CameraControlTab = (typeof CAMERA_CONTROL_TABS)[number]["id"];

const sleep = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

function getCameraControlTabOffset(index: number) {
  "worklet";

  return -index * (CAMERA_CONTROL_TAB_WIDTH + CAMERA_CONTROL_TAB_GAP);
}

function getNearestCameraControlTabIndex(offsetX: number) {
  "worklet";

  const tabStride = CAMERA_CONTROL_TAB_WIDTH + CAMERA_CONTROL_TAB_GAP;
  const nearestIndex = Math.round(-offsetX / tabStride);

  return Math.max(0, Math.min(CAMERA_CONTROL_TABS.length - 1, nearestIndex));
}

export default function CameraScreen() {
  const { user, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn: Boolean(user), subscription }),
    [subscription, user]
  );
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
  const [activeCameraControlTab, setActiveCameraControlTab] =
    useState<CameraControlTab>("photo");
  const [cameraControlPanelWidth, setCameraControlPanelWidth] = useState(0);
  const [shutterTimer, setShutterTimer] = useState<CameraTimerValue>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [photoQuality, setPhotoQuality] = useState<CameraQualityValue>("high");
  const [cameraRatio, setCameraRatio] = useState<PhotoRatioLabel>("Original");
  const [cameraSaveScope, setCameraSaveScope] = useState<CameraSaveScope>("app");
  const [cameraControlTabViewportWidth, setCameraControlTabViewportWidth] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(0);
  const [cameraFocusPoint, setCameraFocusPoint] = useState<CameraFocusPoint | null>(null);
  const [cameraFocusTap, setCameraFocusTap] = useState<{ x: number; y: number } | null>(null);
  const [focusIndicatorVisible, setFocusIndicatorVisible] = useState(false);
  const [cameraFocusLocked, setCameraFocusLocked] = useState(false);
  const [cameraExposureBias, setCameraExposureBias] = useState(0);
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
  const cameraControlSlideX = useSharedValue(0);
  const cameraControlTabSlideX = useSharedValue(0);
  const cameraControlTabStartX = useSharedValue(0);
  const focusControlsOpacity = useSharedValue(0);
  const focusIndicatorScale = useSharedValue(1);
  const cameraFocusLockedRef = useRef(false);
  const cameraExposureBiasRef = useRef(0);
  const focusIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const activeCameraControlTabIndex = CAMERA_CONTROL_TABS.findIndex(
    (tab) => tab.id === activeCameraControlTab
  );
  const cameraControlTabCenterPadding = Math.max(
    0,
    cameraControlTabViewportWidth / 2 - CAMERA_CONTROL_TAB_WIDTH / 2
  );
  const focusIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusControlsOpacity.value,
    transform: [{ scale: focusIndicatorScale.value }]
  }));
  const focusControlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusControlsOpacity.value
  }));
  const cameraControlPagerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cameraControlSlideX.value }]
  }));
  const cameraControlTabTrackAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cameraControlTabSlideX.value }]
  }));

  useEffect(() => {
    if (cameraControlPanelWidth <= 0) {
      return;
    }

    cameraControlSlideX.value = withTiming(
      -activeCameraControlTabIndex * cameraControlPanelWidth,
      { duration: 180 }
    );
  }, [
    activeCameraControlTabIndex,
    cameraControlPanelWidth,
    cameraControlSlideX
  ]);

  useEffect(() => {
    if (cameraControlTabViewportWidth <= 0) {
      return;
    }

    cameraControlTabSlideX.value = withTiming(
      getCameraControlTabOffset(activeCameraControlTabIndex),
      { duration: 180 }
    );
  }, [
    activeCameraControlTabIndex,
    cameraControlTabSlideX,
    cameraControlTabViewportWidth
  ]);

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

  useEffect(
    () => () => {
      if (focusIndicatorTimeout.current) {
        clearTimeout(focusIndicatorTimeout.current);
      }
    },
    []
  );

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
        setZoomPercent(settings.cameraZoomPercent);
        setTorchEnabled(settings.cameraTorchEnabled && settings.cameraFacing === "back");
        setCameraFacing(settings.cameraFacing);
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
        ratioLabel: cameraRatio,
        localImageLimit: planEntitlements.localImageLimit
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

  const setZoomPreset = useCallback(
    (value: number) => {
      const nextZoom = Math.round(
        Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, value))
      );
      setZoomPercent(nextZoom);
      void updateAppSettings({ cameraZoomPercent: nextZoom });
      void triggerFeedback();
    },
    [triggerFeedback]
  );

  const setLightEnabled = useCallback(
    (enabled: boolean) => {
      const nextEnabled = enabled;
      setTorchEnabled(nextEnabled);
      void updateAppSettings({ cameraTorchEnabled: nextEnabled });
      void triggerFeedback();
    },
    [triggerFeedback]
  );

  const applyCameraExposureBias = useCallback((value: number) => {
    const nextBias = Math.max(
      CAMERA_EXPOSURE_BIAS_MIN,
      Math.min(CAMERA_EXPOSURE_BIAS_MAX, value)
    );
    const nextRoundedBias = Number(nextBias.toFixed(2));
    if (cameraExposureBiasRef.current === nextRoundedBias) {
      return;
    }

    cameraExposureBiasRef.current = nextRoundedBias;
    setCameraExposureBias(nextRoundedBias);
  }, []);

  const showFocusControls = useCallback(() => {
    setFocusIndicatorVisible(true);
    focusControlsOpacity.value = 0;
    focusIndicatorScale.value = 1.5;
    focusControlsOpacity.value = withTiming(1, {
      duration: CAMERA_FOCUS_CONTROLS_FADE_MS
    });
    focusIndicatorScale.value = withTiming(1, {
      duration: CAMERA_FOCUS_CONTROLS_FADE_MS
    });
  }, [focusControlsOpacity, focusIndicatorScale]);

  const cancelFocusControlsDismiss = useCallback(() => {
    if (focusIndicatorTimeout.current) {
      clearTimeout(focusIndicatorTimeout.current);
      focusIndicatorTimeout.current = null;
    }
    setFocusIndicatorVisible(true);
    focusControlsOpacity.value = withTiming(1, {
      duration: CAMERA_FOCUS_CONTROLS_FADE_MS
    });
    focusIndicatorScale.value = withTiming(1, {
      duration: CAMERA_FOCUS_CONTROLS_FADE_MS
    });
  }, [focusControlsOpacity, focusIndicatorScale]);

  const scheduleFocusControlsDismiss = useCallback(() => {
    if (cameraFocusLockedRef.current) {
      return;
    }

    if (focusIndicatorTimeout.current) {
      clearTimeout(focusIndicatorTimeout.current);
    }

    focusIndicatorTimeout.current = setTimeout(() => {
      focusIndicatorTimeout.current = null;
      focusIndicatorScale.value = withTiming(1, {
        duration: CAMERA_FOCUS_CONTROLS_FADE_MS
      });
      focusControlsOpacity.value = withTiming(
        0,
        { duration: CAMERA_FOCUS_CONTROLS_FADE_MS },
        (finished) => {
          if (finished) {
            runOnJS(setFocusIndicatorVisible)(false);
          }
        }
      );
    }, CAMERA_FOCUS_CONTROLS_DISMISS_MS);
  }, [focusControlsOpacity, focusIndicatorScale]);

  const handleCameraTap = useCallback(
    (x: number, y: number) => {
      if (cameraFocusLockedRef.current) {
        return;
      }

      const tap = { x, y };
      const nextFocusPoint = getNormalizedCameraFocusPoint(tap, cameraFrame);

      if (!nextFocusPoint) {
        return;
      }

      cameraFocusLockedRef.current = false;
      setCameraFocusLocked(false);
      setCameraFocusPoint(nextFocusPoint);
      setCameraFocusTap(tap);
      showFocusControls();
      void triggerFeedback();
      scheduleFocusControlsDismiss();
    },
    [cameraFrame, scheduleFocusControlsDismiss, showFocusControls, triggerFeedback]
  );

  const toggleCameraFocusLock = useCallback(() => {
    if (!cameraFocusTap) {
      return;
    }

    const nextLocked = !cameraFocusLockedRef.current;
    cameraFocusLockedRef.current = nextLocked;
    setCameraFocusLocked(nextLocked);
    setFocusIndicatorVisible(true);

    if (nextLocked) {
      cancelFocusControlsDismiss();
    } else {
      scheduleFocusControlsDismiss();
    }

    void triggerFeedback();
  }, [cameraFocusTap, cancelFocusControlsDismiss, scheduleFocusControlsDismiss, triggerFeedback]);

  const changeCameraFacing = useCallback((value: CameraType) => {
    setCameraFacing(value);
    if (value === "front") {
      setTorchEnabled(false);
      void updateAppSettings({
        cameraFacing: value,
        cameraTorchEnabled: false
      });
      return;
    }

    void updateAppSettings({ cameraFacing: value });
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

  const toggleCameraFacing = useCallback(() => {
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
      return clampGuidePositionOffset({ x: nextX, y: nextY }, cameraFrame);
    },
    [cameraFrame]
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

  const selectCameraControlTab = useCallback(
    (nextTab: CameraControlTab) => {
      setActiveCameraControlTab(nextTab);
      void triggerFeedback();
    },
    [triggerFeedback]
  );

  const selectCameraControlTabByIndex = useCallback(
    (nextIndex: number) => {
      const nextTab = CAMERA_CONTROL_TABS[nextIndex]?.id;
      if (nextTab) {
        selectCameraControlTab(nextTab);
      }
    },
    [selectCameraControlTab]
  );

  const cameraControlTabPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          cameraControlTabStartX.value = cameraControlTabSlideX.value;
        })
        .onUpdate((event) => {
          if (cameraControlTabViewportWidth <= 0) {
            return;
          }

          const minOffset = getCameraControlTabOffset(CAMERA_CONTROL_TABS.length - 1);
          const nextOffset = cameraControlTabStartX.value + event.translationX;
          cameraControlTabSlideX.value = Math.max(
            minOffset,
            Math.min(0, nextOffset)
          );
        })
        .onEnd((event) => {
          if (cameraControlTabViewportWidth <= 0) {
            return;
          }

          const minOffset = getCameraControlTabOffset(CAMERA_CONTROL_TABS.length - 1);
          const dragEndOffset = Math.max(
            minOffset,
            Math.min(0, cameraControlTabStartX.value + event.translationX)
          );
          const nextIndex = getNearestCameraControlTabIndex(dragEndOffset);
          cameraControlTabSlideX.value = withTiming(
            getCameraControlTabOffset(nextIndex),
            { duration: 160 }
          );

          if (nextIndex !== activeCameraControlTabIndex) {
            runOnJS(selectCameraControlTabByIndex)(nextIndex);
          }
        }),
    [
      activeCameraControlTabIndex,
      cameraControlTabSlideX,
      cameraControlTabStartX,
      cameraControlTabViewportWidth,
      selectCameraControlTabByIndex
    ]
  );

  const cameraControlTabTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(220)
        .onEnd((event) => {
          if (cameraControlTabViewportWidth <= 0) {
            return;
          }

          const tabStride = CAMERA_CONTROL_TAB_WIDTH + CAMERA_CONTROL_TAB_GAP;
          const centerPadding =
            cameraControlTabViewportWidth / 2 - CAMERA_CONTROL_TAB_WIDTH / 2;
          const tappedIndex = Math.round(
            (event.x - centerPadding - cameraControlTabSlideX.value) / tabStride
          );
          const nextIndex = Math.max(
            0,
            Math.min(CAMERA_CONTROL_TABS.length - 1, tappedIndex)
          );
          runOnJS(selectCameraControlTabByIndex)(nextIndex);
        }),
    [
      cameraControlTabSlideX,
      cameraControlTabViewportWidth,
      selectCameraControlTabByIndex
    ]
  );

  const cameraControlTabGesture = useMemo(
    () => Gesture.Exclusive(cameraControlTabPanGesture, cameraControlTabTapGesture),
    [cameraControlTabPanGesture, cameraControlTabTapGesture]
  );

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

  const cameraTapFocusGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(
          !isCameraModalOpen &&
            !cameraMenuOpen &&
            !overlaySetupActive &&
            !isGuidePositionAdjusting &&
            !isCapturing
        )
        .maxDuration(250)
        .onEnd((event) => {
          runOnJS(handleCameraTap)(event.x, event.y);
        }),
    [
      cameraMenuOpen,
      handleCameraTap,
      isCameraModalOpen,
      isCapturing,
      isGuidePositionAdjusting,
      overlaySetupActive
    ]
  );

  const cameraPreviewGesture = useMemo(
    () => Gesture.Simultaneous(cameraSwipeGesture, cameraPinchZoomGesture, cameraTapFocusGesture),
    [cameraPinchZoomGesture, cameraSwipeGesture, cameraTapFocusGesture]
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
          const nextOffset = calculateGuidePositionDragOffset({
            startX: guideDragStartX.value,
            startY: guideDragStartY.value,
            translationX: event.translationX,
            translationY: event.translationY,
            frame: cameraFrame
          });
          guideOffsetXValue.value = nextOffset.x;
          guideOffsetYValue.value = nextOffset.y;
          runOnJS(syncGuideOffsetFromGesture)(
            guideOffsetXValue.value,
            guideOffsetYValue.value
          );
        }),
    [
      cameraFrame,
      guideDragStartX,
      guideDragStartY,
      guideOffsetXValue,
      guideOffsetYValue,
      isGuidePositionAdjusting,
      syncGuideOffsetFromGesture
    ]
  );

  const exposureControlPosition = useMemo(
    () =>
      cameraFocusTap
        ? getTapExposureControlPosition({
            tap: cameraFocusTap,
            frame: cameraFrame,
            controlWidth: EXPOSURE_CONTROL_WIDTH,
            controlHeight: EXPOSURE_CONTROL_HEIGHT,
            offsetY: EXPOSURE_CONTROL_OFFSET_Y,
            margin: EXPOSURE_CONTROL_MARGIN
          })
        : null,
    [cameraFocusTap, cameraFrame]
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
        focusPoint={cameraFocusPoint}
        focusLocked={cameraFocusLocked}
        exposureBias={cameraExposureBias}
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

      {cameraFocusTap && focusIndicatorVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.focusIndicator,
            focusIndicatorAnimatedStyle,
            {
              left: cameraFocusTap.x - CAMERA_FOCUS_INDICATOR_RADIUS,
              top: cameraFocusTap.y - CAMERA_FOCUS_INDICATOR_RADIUS
            }
          ]}
        />
      ) : null}

      {cameraFocusTap && focusIndicatorVisible ? (
        <Animated.View
          style={[
            styles.focusLockButtonWrap,
            focusControlsAnimatedStyle,
            {
              left: cameraFocusTap.x + CAMERA_FOCUS_INDICATOR_RADIUS - CAMERA_FOCUS_LOCK_BUTTON_SIZE,
              top: cameraFocusTap.y - CAMERA_FOCUS_INDICATOR_RADIUS - 2
            }
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cameraFocusLocked ? "초점 고정 해제" : "초점 고정"}
            onPress={toggleCameraFocusLock}
            style={({ pressed }) => [
              styles.focusLockButton,
              cameraFocusLocked && styles.focusLockButtonActive,
              pressed && styles.focusLockButtonPressed
            ]}
          >
            <Feather
              name={cameraFocusLocked ? "lock" : "unlock"}
              size={12}
              color={colors.inverse}
            />
          </Pressable>
        </Animated.View>
      ) : null}

      {cameraFocusTap && focusIndicatorVisible && exposureControlPosition && !isCameraModalOpen && !isGuidePositionAdjusting ? (
        <Animated.View
          style={[
            styles.exposureTapControl,
            focusControlsAnimatedStyle,
            {
              left: exposureControlPosition.left,
              top: exposureControlPosition.top
            }
          ]}
        >
          <ExposureBiasControl
            value={cameraExposureBias}
            min={CAMERA_EXPOSURE_BIAS_MIN}
            max={CAMERA_EXPOSURE_BIAS_MAX}
            onChange={applyCameraExposureBias}
            onCommit={applyCameraExposureBias}
            onInteractionStart={cancelFocusControlsDismiss}
            onInteractionEnd={scheduleFocusControlsDismiss}
          />
        </Animated.View>
      ) : null}

      {countdown ? (
        <View style={styles.countdownOverlay}>
          <Text selectable={false} style={styles.countdownText}>
            {countdown}
          </Text>
        </View>
      ) : null}

      {!isGuidePositionAdjusting ? (
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.homeIconButton}
          onPress={() => router.push("/home")}
          accessibilityRole="button"
          accessibilityLabel="홈으로 이동"
        >
          <Feather name="home" size={22} color={colors.inverse} />
        </Pressable>
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
                  스크롤
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
      <View style={styles.controls}>
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
          <View collapsable={false} style={styles.cameraControlDeck}>
              {activeCameraControlTab !== "photo" ? (
                <View
                  pointerEvents="box-none"
                  style={[
                    styles.cameraFloatingPanelWrap,
                    styles.cameraFloatingPanelRaised,
                    { bottom: bottomSafePadding + 96 }
                  ]}
                >
                  <View
                    style={styles.cameraControlPanelViewport}
                    onLayout={(event) =>
                      setCameraControlPanelWidth(event.nativeEvent.layout.width)
                    }
                  >
                    <Animated.View
                      style={[
                        styles.cameraControlPager,
                        cameraControlPagerAnimatedStyle
                      ]}
                    >
                      {CAMERA_CONTROL_TABS.map((tab) => (
                        <View
                          key={tab.id}
                          style={[
                            styles.cameraControlPage,
                            { width: cameraControlPanelWidth || 1 }
                          ]}
                        >
                          {tab.id === "zoom" ? (
                            <View style={styles.quickButtonRow}>
                              {CAMERA_ZOOM_PRESETS.map((preset) => {
                                const isActive = zoomPercent === preset.value;

                                return (
                                  <Pressable
                                    key={preset.label}
                                    style={[
                                      styles.quickPillButton,
                                      isActive && styles.quickPillButtonActive
                                    ]}
                                    onPress={() => setZoomPreset(preset.value)}
                                  >
                                    <Text
                                      selectable={false}
                                      style={[
                                        styles.quickPillText,
                                        isActive && styles.quickPillTextActive
                                      ]}
                                    >
                                      {preset.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : null}
                          {tab.id === "guide" ? (
                            <View style={styles.quickButtonRow}>
                              <Pressable
                                style={[
                                  styles.quickPillButton,
                                  guideVisible && !referenceUri && styles.quickPillButtonActive
                                ]}
                                onPress={openLineGuideSettings}
                              >
                                <Text
                                  selectable={false}
                                  style={[
                                    styles.quickPillText,
                                    guideVisible && !referenceUri && styles.quickPillTextActive
                                  ]}
                                >
                                  {"\uB77C\uC778"}
                                </Text>
                              </Pressable>
                              <Pressable
                                style={[
                                  styles.quickPillButton,
                                  referenceUri && styles.quickPillButtonActive
                                ]}
                                onPress={openPhotoGuideSettings}
                              >
                                <Text
                                  selectable={false}
                                  style={[
                                    styles.quickPillText,
                                    referenceUri && styles.quickPillTextActive
                                  ]}
                                >
                                  {"\uC774\uBBF8\uC9C0"}
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                          {tab.id === "light" ? (
                            <View style={styles.quickButtonRow}>
                              <Pressable
                                style={[
                                  styles.quickPillButton,
                                  torchEnabled && styles.quickPillButtonActive
                                ]}
                                onPress={() => setLightEnabled(true)}
                              >
                                <Text
                                  selectable={false}
                                  style={[
                                    styles.quickPillText,
                                    torchEnabled && styles.quickPillTextActive
                                  ]}
                                >
                                  on
                                </Text>
                              </Pressable>
                              <Pressable
                                style={[
                                  styles.quickPillButton,
                                  !torchEnabled && styles.quickPillButtonActive
                                ]}
                                onPress={() => setLightEnabled(false)}
                              >
                                <Text
                                  selectable={false}
                                  style={[
                                    styles.quickPillText,
                                    !torchEnabled && styles.quickPillTextActive
                                  ]}
                                >
                                  off
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </Animated.View>
                  </View>
                </View>
              ) : null}

              <View style={[styles.cameraControlBottomTray, { paddingBottom: bottomSafePadding }]}>
                <View style={styles.cameraControlTabRow}>
                  <GestureDetector gesture={cameraControlTabGesture}>
                    <Animated.View
                      collapsable={false}
                      style={styles.cameraControlTabViewport}
                      onLayout={(event) =>
                        setCameraControlTabViewportWidth(event.nativeEvent.layout.width)
                      }
                    >
                      <Animated.View
                        style={[
                          styles.cameraControlTabTrack,
                          cameraControlTabTrackAnimatedStyle
                        ]}
                      >
                        <View
                          style={[
                            styles.cameraControlTabCenterSpacer,
                            { width: cameraControlTabCenterPadding }
                          ]}
                        />
                        {CAMERA_CONTROL_TABS.map((tab) => {
                          const isActive = activeCameraControlTab === tab.id;

                          return (
                            <View
                              key={tab.id}
                              style={[
                                styles.cameraControlTab,
                                isActive && styles.cameraControlTabActive
                              ]}
                            >
                              <Text
                                selectable={false}
                                style={[
                                  styles.cameraControlTabText,
                                  isActive && styles.cameraControlTabTextActive
                                ]}
                              >
                                {tab.label}
                              </Text>
                            </View>
                          );
                        })}
                        <View
                          style={[
                            styles.cameraControlTabCenterSpacer,
                            { width: cameraControlTabCenterPadding }
                          ]}
                        />
                      </Animated.View>
                    </Animated.View>
                  </GestureDetector>
                </View>

                <View style={styles.captureRow}>
                  <Pressable
                    style={styles.galleryButton}
                    onPress={openPersonalGallery}
                    accessibilityRole="button"
                    accessibilityLabel="\uAC1C\uC778 \uAC24\uB7EC\uB9AC \uC5F4\uAE30"
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
                  <Pressable
                    style={[
                      styles.cameraFlipButton,
                      cameraFacing === "front" && styles.cameraFlipButtonActive
                    ]}
                    onPress={toggleCameraFacing}
                    accessibilityRole="button"
                    accessibilityLabel={
                      cameraFacing === "front"
                        ? "\uD6C4\uBA74 \uCE74\uBA54\uB77C\uB85C \uC804\uD658"
                        : "\uC804\uBA74 \uCE74\uBA54\uB77C\uB85C \uC804\uD658"
                    }
                  >
                    <Feather name="refresh-cw" size={26} color={colors.inverse} />
                  </Pressable>
                </View>
              </View>
            </View>
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

type ExposureBiasControlProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
};

function getExposureThumbX(value: number, min: number, max: number, width: number) {
  if (width <= 0 || max === min) {
    return 0;
  }

  const ratio = (value - min) / (max - min);
  return Math.max(0, Math.min(1, ratio)) * width;
}

function getExposureTrackXFromControlX(controlX: number, trackWidth: number) {
  "worklet";

  if (trackWidth <= 0) {
    return 0;
  }

  const trackStartX = EXPOSURE_SUN_ICON_SIZE + EXPOSURE_CONTROL_GAP;
  return Math.max(0, Math.min(trackWidth, controlX - trackStartX));
}

function getExposureBiasFromTrackX(
  trackX: number,
  min: number,
  max: number,
  trackWidth: number
) {
  "worklet";

  if (trackWidth <= 0) {
    return min;
  }

  const ratio = Math.max(0, Math.min(1, trackX / trackWidth));
  return min + ratio * (max - min);
}

function ExposureBiasControl({
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
    top: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: "transparent"
  },
  focusIndicator: {
    position: "absolute",
    width: CAMERA_FOCUS_INDICATOR_SIZE,
    height: CAMERA_FOCUS_INDICATOR_SIZE,
    borderRadius: CAMERA_FOCUS_INDICATOR_RADIUS,
    borderWidth: 2,
    borderColor: colors.inverse,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    zIndex: 12
  },
  focusLockButtonWrap: {
    position: "absolute",
    width: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    height: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    zIndex: 19
  },
  focusLockButton: {
    width: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    height: CAMERA_FOCUS_LOCK_BUTTON_SIZE,
    borderRadius: CAMERA_FOCUS_LOCK_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
    backgroundColor: "rgba(0, 0, 0, 0.5)"
  },
  focusLockButtonActive: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "#E53935"
  },
  focusLockButtonPressed: {
    opacity: 0.78
  },
  exposureTapControl: {
    position: "absolute",
    width: EXPOSURE_CONTROL_WIDTH,
    height: EXPOSURE_CONTROL_HEIGHT,
    zIndex: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  exposureControl: {
    width: "100%",
    height: EXPOSURE_CONTROL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: EXPOSURE_CONTROL_GAP,
    justifyContent: "center"
  },
  exposureTrack: {
    width: EXPOSURE_TRACK_WIDTH,
    justifyContent: "center"
  },
  exposureTrackLine: {
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.45)"
  },
  exposureCenterMark: {
    position: "absolute",
    left: "50%",
    width: 2,
    height: 14,
    backgroundColor: "rgba(255, 255, 255, 0.7)"
  },
  exposureThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.inverse,
    backgroundColor: colors.background
  },
  exposureThumbHidden: {
    opacity: 0
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
    display: "none",
    color: colors.inverse,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  homeIconButton: {
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
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
    gap: 12,
    paddingHorizontal: CAMERA_CONTROL_HORIZONTAL_PADDING,
    paddingTop: 10,
    backgroundColor: "transparent"
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
    backgroundColor: colors.background,
    overflow: "hidden"
  },
  cameraSettingsScrollShell: {
    position: "relative",
    flexShrink: 1,
    minHeight: 0,
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
    flexShrink: 1,
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
  cameraControlDeck: {
    width: "100%",
    gap: 0
  },
  cameraFloatingPanelWrap: {
    width: "100%",
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  cameraFloatingPanelRaised: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 22
  },
  cameraControlPanelViewport: {
    width: "100%",
    minHeight: 42,
    overflow: "hidden"
  },
  cameraControlPager: {
    flexDirection: "row",
    alignItems: "center"
  },
  cameraControlPage: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  quickButtonRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  quickPillButton: {
    minWidth: 48,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.36)",
    backgroundColor: "rgba(0, 0, 0, 0.28)"
  },
  quickPillButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  quickPillText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  quickPillTextActive: {
    color: colors.text
  },
  cameraControlBottomTray: {
    width: "100%",
    gap: 30,
    paddingTop: 10,
    paddingHorizontal: CAMERA_CONTROL_TRAY_HORIZONTAL_PADDING,
    backgroundColor: "rgba(0, 0, 0, 0.52)"
  },
  cameraControlTabRow: {
    width: "100%",
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center"
  },
  cameraControlTabViewport: {
    flex: 1,
    minHeight: 38,
    overflow: "hidden"
  },
  cameraControlTabTrack: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: CAMERA_CONTROL_TAB_GAP
  },
  cameraControlTabCenterSpacer: {
    height: 1
  },
  cameraControlTab: {
    width: CAMERA_CONTROL_TAB_WIDTH,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    backgroundColor: "rgba(0, 0, 0, 0.18)"
  },
  cameraControlTabActive: {
    borderColor: colors.inverse,
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  },
  cameraControlTabText: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  },
  cameraControlTabTextActive: {
    color: colors.inverse
  },
  captureRow: {
    width: "100%",
    minHeight: 66,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  galleryButton: {
    position: "absolute",
    left: 0,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  cameraFlipButton: {
    position: "absolute",
    right: 0,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  cameraFlipButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: "rgba(255, 255, 255, 0.16)"
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


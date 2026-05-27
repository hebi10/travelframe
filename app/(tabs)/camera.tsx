import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Image as NativeImage,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraDevice,
  type CameraPosition,
  type CameraRef,
  type DeviceFilter,
  type FlashMode,
  type MeteringMode,
  type PhysicalDeviceType
} from "react-native-vision-camera";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { ChevronIcon } from "@/components/chevron-icon";
import {
  PhotoReferenceOverlay,
  type PhotoReferenceOverlayHandle
} from "@/components/photo-reference-overlay";
import { colors } from "@/constants/app-theme";
import { GUIDE_LABELS, GUIDE_TYPES, type GuideType } from "@/constants/camera-guides";
import {
  CameraSettingToggleRow,
  CameraShutterSoundChoice,
  ExposureBiasControl,
  GuideSizeSlider,
  SmoothValueSlider
} from "@/features/camera/camera-screen.components";
import {
  CAMERA_CONTROL_TAB_GAP,
  CAMERA_CONTROL_TAB_WIDTH,
  CAMERA_FOCUS_CONTROLS_DISMISS_MS,
  CAMERA_FOCUS_CONTROLS_FADE_MS,
  CAMERA_FOCUS_INDICATOR_RADIUS,
  CAMERA_FOCUS_LOCK_BUTTON_SIZE,
  EXPOSURE_CONTROL_HEIGHT,
  EXPOSURE_CONTROL_MARGIN,
  EXPOSURE_CONTROL_OFFSET_Y,
  EXPOSURE_CONTROL_WIDTH
} from "@/features/camera/camera-screen.constants";
import {
  clampGridGuideLinePositions,
  getDefaultGridGuideLinePositions,
  getNearestGridGuideLine,
  getNearestGuideShapePoint,
  isShapeGuide,
  updateGridGuideLineFromPoint,
  updateGuideShapePointFromPoint
} from "@/features/camera/camera-screen.helpers";
import { styles } from "@/features/camera/camera-screen.styles";
import { useAuth } from "@/lib/auth-context";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import {
  calculateGuidePositionDragOffset,
  clampGuidePositionOffset
} from "@/lib/camera-guide-position";
import {
  getNormalizedCameraFocusPoint,
  getTapExposureControlPosition
} from "@/lib/camera-focus-controls";
import { backupPhotoIfEnabled } from "@/lib/cloud-backup";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  defaultGridGuideLinePositions,
  defaultGuideShapePoints,
  getAppSettings,
  getGuideSizeBounds,
  updateAppSettings,
  type CameraFacing,
  type CameraShutterSoundMode,
  type CameraSaveScope,
  type GridGuideLineKey,
  type GridGuideLinePositions,
  type GuideShapePoints
} from "@/lib/app-settings";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
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
const CAMERA_FACING_OPTIONS: { label: string; value: CameraFacing }[] = [
  { label: "후면", value: "back" },
  { label: "전면", value: "front" }
];
const CAMERA_FLASH_OPTIONS: { label: string; value: FlashMode }[] = [
  { label: "끔", value: "off" },
  { label: "자동", value: "auto" },
  { label: "켜짐", value: "on" }
];

const cameraRatioAspect: Record<PhotoRatioLabel, number | null> = {
  Original: null,
  "1:1": 1,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9
};

const CAMERA_ZOOM_MIN = 0;
const CAMERA_ZOOM_MAX = 100;
const CAMERA_LENS_ULTRA_WIDE: PhysicalDeviceType = "ultra-wide-angle";
const CAMERA_LENS_WIDE: PhysicalDeviceType = "wide-angle";
const CAMERA_LENS_TELEPHOTO: PhysicalDeviceType = "telephoto";
const CAMERA_BACK_PHYSICAL_DEVICES: PhysicalDeviceType[] = [
  CAMERA_LENS_ULTRA_WIDE,
  CAMERA_LENS_WIDE,
  CAMERA_LENS_TELEPHOTO
];
const CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE = [
  { label: "0.5x", factor: 0.5 },
  { label: "1x", factor: 1 },
  { label: "3x", factor: 3 },
  { label: "5x", factor: 5 },
  { label: "10x", factor: 10 }
] as const;
const CAMERA_BACK_ZOOM_PRESETS_DEFAULT = [
  { label: "1x", factor: 1 },
  { label: "3x", factor: 3 },
  { label: "5x", factor: 5 },
  { label: "10x", factor: 10 }
] as const;
const CAMERA_FRONT_ZOOM_PRESETS = [
  { label: "1x", factor: 1 },
  { label: "3x", factor: 3 }
] as const;
const CAMERA_CONTROL_TABS = [
  { id: "photo", label: "사진" },
  { id: "zoom", label: "확대" },
  { id: "guide", label: "가이드" },
  { id: "light", label: "라이트" }
] as const;
const CAMERA_EXPOSURE_BIAS_MIN = -1;
const CAMERA_EXPOSURE_BIAS_MAX = 1;
const CAMERA_FLIP_SWIPE_THRESHOLD = 70;
const CAMERA_FLIP_HORIZONTAL_TOLERANCE = 1.4;
const CAMERA_FOCUS_METERING_MODES: MeteringMode[] = ["AF", "AE", "AWB"];
const CAMERA_SESSION_RECOVERY_DELAY_MS = 700;

type CameraTimerValue = (typeof CAMERA_TIMER_OPTIONS)[number]["value"];
type CameraQualityValue = (typeof CAMERA_QUALITY_OPTIONS)[number]["value"];
type CameraControlTab = (typeof CAMERA_CONTROL_TABS)[number]["id"];
type CameraZoomPreset =
  | (typeof CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE)[number]
  | (typeof CAMERA_BACK_ZOOM_PRESETS_DEFAULT)[number]
  | (typeof CAMERA_FRONT_ZOOM_PRESETS)[number];

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

function getCameraControlTabCenterPadding(viewportWidth: number, measuredCenterX = 0) {
  "worklet";

  const targetCenterX = measuredCenterX > 0 ? measuredCenterX : viewportWidth / 2;
  return Math.max(0, targetCenterX - CAMERA_CONTROL_TAB_WIDTH / 2 - CAMERA_CONTROL_TAB_GAP);
}

function hasCameraLens(availableLenses: PhysicalDeviceType[], lens: PhysicalDeviceType) {
  return availableLenses.includes(lens);
}

function getCameraDeviceFilter(cameraFacing: CameraPosition): DeviceFilter | undefined {
  if (cameraFacing === "front") {
    return undefined;
  }

  return { physicalDevices: CAMERA_BACK_PHYSICAL_DEVICES };
}

function getCameraDeviceLensTypes(cameraDevice: CameraDevice | undefined) {
  if (!cameraDevice) {
    return [] as PhysicalDeviceType[];
  }

  const lensTypes = new Set<PhysicalDeviceType>();
  for (const physicalDevice of cameraDevice.physicalDevices ?? []) {
    if (CAMERA_BACK_PHYSICAL_DEVICES.includes(physicalDevice.type as PhysicalDeviceType)) {
      lensTypes.add(physicalDevice.type as PhysicalDeviceType);
    }
  }
  if (CAMERA_BACK_PHYSICAL_DEVICES.includes(cameraDevice.type as PhysicalDeviceType)) {
    lensTypes.add(cameraDevice.type as PhysicalDeviceType);
  }

  return [...lensTypes];
}

function getCameraZoomPresets(
  cameraFacing: CameraFacing,
  availableLenses: PhysicalDeviceType[]
) {
  if (cameraFacing === "front") {
    return CAMERA_FRONT_ZOOM_PRESETS;
  }

  if (hasCameraLens(availableLenses, CAMERA_LENS_ULTRA_WIDE)) {
    return CAMERA_BACK_ZOOM_PRESETS_WITH_ULTRA_WIDE;
  }

  return CAMERA_BACK_ZOOM_PRESETS_DEFAULT;
}

function getCameraZoomBounds(cameraDevice: CameraDevice | undefined) {
  const minZoom = cameraDevice?.minZoom && Number.isFinite(cameraDevice.minZoom)
    ? cameraDevice.minZoom
    : 1;
  const maxZoom = cameraDevice?.maxZoom && Number.isFinite(cameraDevice.maxZoom)
    ? cameraDevice.maxZoom
    : 10;

  return {
    minZoom: Math.max(0.5, minZoom),
    maxZoom: Math.max(Math.max(0.5, minZoom), maxZoom)
  };
}

function getCameraZoomFactorFromPercent(
  percent: number,
  cameraDevice: CameraDevice | undefined
) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  const ratio = Math.max(0, Math.min(1, percent / 100));
  return minZoom + (maxZoom - minZoom) * ratio;
}

function getCameraZoomPercentFromFactor(
  factor: number,
  cameraDevice: CameraDevice | undefined
) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  if (maxZoom <= minZoom) {
    return 0;
  }

  return Math.round(((Math.max(minZoom, Math.min(maxZoom, factor)) - minZoom) / (maxZoom - minZoom)) * 100);
}

function getCameraZoomPresetFactor(
  preset: CameraZoomPreset,
  cameraDevice: CameraDevice | undefined
) {
  const { minZoom, maxZoom } = getCameraZoomBounds(cameraDevice);
  return Math.max(minZoom, Math.min(maxZoom, preset.factor));
}

function getCameraFocusMeteringModes(cameraDevice: CameraDevice | undefined) {
  if (!cameraDevice) {
    return CAMERA_FOCUS_METERING_MODES;
  }

  const modes: MeteringMode[] = [];
  if (cameraDevice.supportsFocusMetering) {
    modes.push("AF");
  }
  if (cameraDevice.supportsExposureMetering) {
    modes.push("AE");
  }
  if (cameraDevice.supportsWhiteBalanceMetering) {
    modes.push("AWB");
  }

  return modes.length > 0 ? modes : CAMERA_FOCUS_METERING_MODES;
}

export default function CameraScreen() {
  const { user, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn: Boolean(user), subscription }),
    [subscription, user]
  );
  const cameraRef = useRef<CameraRef>(null);
  const referenceOverlayRef = useRef<PhotoReferenceOverlayHandle>(null);
  const {
    hasPermission: hasCameraPermission,
    canRequestPermission: canRequestCameraPermission,
    requestPermission: requestCameraPermission
  } = useCameraPermission();
  const [guideVisible, setGuideVisible] = useState(true);
  const [guide, setGuide] = useState<GuideType>("circle");
  const [guideSize, setGuideSize] = useState(44);
  const [guideSizeInput, setGuideSizeInput] = useState("44");
  const [guideStrokeWidth, setGuideStrokeWidth] = useState(1);
  const [guideColor, setGuideColor] = useState<string>(GUIDE_COLOR_OPTIONS[0].value);
  const [guideOffsetX, setGuideOffsetX] = useState(0);
  const [guideOffsetY, setGuideOffsetY] = useState(0);
  const [gridGuideLinePositions, setGridGuideLinePositions] =
    useState<GridGuideLinePositions>(defaultGridGuideLinePositions);
  const [guideShapePoints, setGuideShapePoints] =
    useState<GuideShapePoints>(defaultGuideShapePoints);
  const [isGuidePositionAdjusting, setIsGuidePositionAdjusting] = useState(false);
  const [isGuideShapePointAdjusting, setIsGuideShapePointAdjusting] = useState(false);
  const [isGridLineControlAdjusting, setIsGridLineControlAdjusting] = useState(false);
  const [selectedGridGuideLine, setSelectedGridGuideLine] =
    useState<GridGuideLineKey | null>(null);
  const [selectedGuideShapePointIndex, setSelectedGuideShapePointIndex] =
    useState<number | null>(null);
  const [guideChoiceOpen, setGuideChoiceOpen] = useState(false);
  const [guideSettingsOpen, setGuideSettingsOpen] = useState(false);
  const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
  const [activeCameraControlTab, setActiveCameraControlTab] =
    useState<CameraControlTab>("photo");
  const [shutterTimer, setShutterTimer] = useState<CameraTimerValue>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [photoQuality, setPhotoQuality] = useState<CameraQualityValue>("high");
  const [cameraRatio, setCameraRatio] = useState<PhotoRatioLabel>("Original");
  const [cameraSaveScope, setCameraSaveScope] = useState<CameraSaveScope>("app");
  const [cameraShutterSoundMode, setCameraShutterSoundMode] =
    useState<CameraShutterSoundMode>("silent");
  const [cameraControlTabViewportWidth, setCameraControlTabViewportWidth] = useState(0);
  const [cameraControlShutterCenterX, setCameraControlShutterCenterX] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("back");
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(0);
  const [cameraFocusTap, setCameraFocusTap] = useState<{ x: number; y: number } | null>(null);
  const [focusIndicatorVisible, setFocusIndicatorVisible] = useState(false);
  const [cameraFocusLocked, setCameraFocusLocked] = useState(false);
  const [cameraExposureBias, setCameraExposureBias] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraScreenFocused, setIsCameraScreenFocused] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [cameraRecoveryPending, setCameraRecoveryPending] = useState(false);
  const [cameraSessionRestartKey, setCameraSessionRestartKey] = useState(0);
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
  const guidePinchStartSize = useSharedValue(44);
  const cameraPinchStartZoomPercent = useSharedValue(0);
  const cameraControlTabSlideX = useSharedValue(0);
  const cameraControlTabStartX = useSharedValue(0);
  const focusControlsOpacity = useSharedValue(0);
  const focusIndicatorScale = useSharedValue(1);
  const guideSizeRef = useRef(44);
  const guideOffsetRef = useRef({ x: 0, y: 0 });
  const gridGuideLinePositionsRef = useRef<GridGuideLinePositions>(
    defaultGridGuideLinePositions
  );
  const guideShapePointsRef = useRef<GuideShapePoints>(defaultGuideShapePoints);
  const selectedGridGuideLineRef = useRef<GridGuideLineKey | null>(null);
  const selectedGuideShapePointIndexRef = useRef<number | null>(null);
  const cameraFocusLockedRef = useRef(false);
  const cameraExposureBiasRef = useRef(0);
  const focusIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRecoveryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const isCameraModalOpen = guideChoiceOpen || guideSettingsOpen || cameraSettingsOpen;
  const controlsStyle = overlaySetupActive
    ? [styles.controls, { paddingBottom: bottomSafePadding }]
    : styles.controls;
  const isLineGuideActive = guideVisible;
  const isPhotoGuideActive = Boolean(referenceUri);
  const guideSizeBounds = useMemo(() => getGuideSizeBounds(guide), [guide]);
  const applyGridGuideLinePositionsState = useCallback(
    (nextPositions: GridGuideLinePositions) => {
      const clampedPositions = clampGridGuideLinePositions(nextPositions);
      gridGuideLinePositionsRef.current = clampedPositions;
      setGridGuideLinePositions(clampedPositions);
      return clampedPositions;
    },
    []
  );
  const applyGuideShapePointsState = useCallback((nextShapePoints: GuideShapePoints) => {
    guideShapePointsRef.current = nextShapePoints;
    setGuideShapePoints(nextShapePoints);
    return nextShapePoints;
  }, []);
  const cameraDeviceFilter = useMemo(() => getCameraDeviceFilter(cameraFacing), [cameraFacing]);
  const cameraDevice = useCameraDevice(cameraFacing, cameraDeviceFilter);
  const availableCameraLenses = useMemo(
    () => getCameraDeviceLensTypes(cameraDevice),
    [cameraDevice]
  );
  const cameraZoomPresets = useMemo(
    () => getCameraZoomPresets(cameraFacing, availableCameraLenses),
    [availableCameraLenses, cameraFacing]
  );
  const cameraZoomFactor = useMemo(
    () => getCameraZoomFactorFromPercent(zoomPercent, cameraDevice),
    [cameraDevice, zoomPercent]
  );
  const photoOutputQuality =
    CAMERA_QUALITY_OPTIONS.find((option) => option.value === photoQuality)?.quality ?? 0.92;
  const photoOutput = usePhotoOutput({ quality: photoOutputQuality });
  const cameraOutputs = useMemo(() => [photoOutput], [photoOutput]);
  const activeCameraControlTabIndex = Math.max(
    0,
    CAMERA_CONTROL_TABS.findIndex((tab) => tab.id === activeCameraControlTab)
  );
  const cameraControlTabCenterPadding = getCameraControlTabCenterPadding(
    cameraControlTabViewportWidth,
    cameraControlShutterCenterX
  );
  const cameraSupportsExposureBias = cameraDevice ? cameraDevice.supportsExposureBias : false;
  const cameraExposureMin =
    cameraDevice && cameraDevice.supportsExposureBias
      ? cameraDevice.minExposureBias
      : CAMERA_EXPOSURE_BIAS_MIN;
  const cameraExposureMax =
    cameraDevice && cameraDevice.supportsExposureBias
      ? cameraDevice.maxExposureBias
      : CAMERA_EXPOSURE_BIAS_MAX;
  const isCameraSessionActive =
    hasCameraPermission &&
    Boolean(cameraDevice) &&
    isCameraScreenFocused &&
    appState === "active" &&
    !cameraRecoveryPending;

  const focusIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusControlsOpacity.value,
    transform: [{ scale: focusIndicatorScale.value }]
  }));
  const focusControlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusControlsOpacity.value
  }));
  const cameraControlTabTrackAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cameraControlTabSlideX.value }]
  }));

  useFocusEffect(
    useCallback(() => {
      setIsCameraScreenFocused(true);

      const requestCameraPermissionOnFocus = async () => {
        if (!hasCameraPermission && canRequestCameraPermission) {
          await requestCameraPermission();
        }
      };

      void requestCameraPermissionOnFocus();

      return () => {
        setIsCameraScreenFocused(false);
        setIsCameraReady(false);
      };
    }, [canRequestCameraPermission, hasCameraPermission, requestCameraPermission])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSettings = async () => {
        const [settings, latestPhoto] = await Promise.all([getAppSettings(), getRecentPhoto()]);
        if (!isActive) {
          return;
        }

        defaultOverlayOpacity.current = settings.overlayOpacity;
        setGuide(settings.defaultGuide);
        setGuideVisible(settings.guideVisible);
        setGuideSize(settings.guideSize);
        guideSizeRef.current = settings.guideSize;
        setGuideSizeInput(String(settings.guideSize));
        setGuideStrokeWidth(settings.guideStrokeWidth);
        setGuideColor(settings.guideColor);
        setGuideOffsetX(settings.guideOffsetX);
        setGuideOffsetY(settings.guideOffsetY);
        guideOffsetRef.current = { x: settings.guideOffsetX, y: settings.guideOffsetY };
        setGridGuideLinePositions(settings.gridGuideLinePositions);
        gridGuideLinePositionsRef.current = settings.gridGuideLinePositions;
        setGuideShapePoints(settings.guideShapePoints);
        guideShapePointsRef.current = settings.guideShapePoints;
        guideOffsetXValue.value = settings.guideOffsetX;
        guideOffsetYValue.value = settings.guideOffsetY;
        setOverlayOpacity(settings.overlayOpacity);
        setZoomPercent(settings.cameraZoomPercent);
        setTorchEnabled(settings.cameraTorchEnabled && settings.cameraFacing === "back");
        setCameraFacing(settings.cameraFacing);
        setCameraRatio(settings.cameraRatio);
        setCameraSaveScope(settings.cameraSaveScope);
        setCameraShutterSoundMode(settings.cameraShutterSoundMode);
        setRecentPhoto(latestPhoto);
      };

      void loadSettings();

      return () => {
        isActive = false;
      };
    }, [guideOffsetXValue, guideOffsetYValue])
  );

  useEffect(() => {
    if (cameraControlTabViewportWidth <= 0) {
      return;
    }

    cameraControlTabSlideX.value = withTiming(
      getCameraControlTabOffset(activeCameraControlTabIndex),
      { duration: 180 }
    );
  }, [activeCameraControlTabIndex, cameraControlTabSlideX, cameraControlTabViewportWidth]);

  useEffect(
    () => () => {
      if (focusIndicatorTimeout.current) {
        clearTimeout(focusIndicatorTimeout.current);
      }
      if (cameraRecoveryTimeout.current) {
        clearTimeout(cameraRecoveryTimeout.current);
      }
    },
    []
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState !== "active") {
        setIsCameraReady(false);
      }
    });

    return () => subscription.remove();
  }, []);

  const triggerFeedback = useCallback(async () => {
    if (!hapticEnabled) {
      return;
    }

    try {
      await Haptics.selectionAsync();
    } catch {
      // 일부 Android 환경에서는 햅틱이 지원되지 않을 수 있습니다.
    }
  }, [hapticEnabled]);

  const applyGuideSize = useCallback(
    (value: number) => {
      const nextSize = Math.round(Math.max(guideSizeBounds.min, Math.min(guideSizeBounds.max, value)));
      const nextGridGuideLinePositions =
        guide === "grid" ? getDefaultGridGuideLinePositions(nextSize) : gridGuideLinePositionsRef.current;
      guideSizeRef.current = nextSize;
      setGuideSize(nextSize); setGuideSizeInput(String(nextSize));
      setGuideVisible(true);
      if (guide === "grid") {
        applyGridGuideLinePositionsState(nextGridGuideLinePositions);
      }
      void updateAppSettings({
        guideSize: nextSize,
        guideVisible: true,
        ...(guide === "grid" ? { gridGuideLinePositions: nextGridGuideLinePositions } : {})
      });
    },
    [applyGridGuideLinePositionsState, guide, guideSizeBounds.max, guideSizeBounds.min]
  );

  const previewGuideSize = useCallback(
    (value: number) => {
      const nextSize = Math.round(Math.max(guideSizeBounds.min, Math.min(guideSizeBounds.max, value)));
      guideSizeRef.current = nextSize;
      setGuideSize(nextSize); setGuideSizeInput(String(nextSize));
      setGuideVisible(true);
      if (guide === "grid") {
        applyGridGuideLinePositionsState(getDefaultGridGuideLinePositions(nextSize));
      }
    },
    [applyGridGuideLinePositionsState, guide, guideSizeBounds.max, guideSizeBounds.min]
  );

  const updateGuideType = (nextGuide: GuideType) => {
    const nextGuideSizeBounds = getGuideSizeBounds(nextGuide);
    const nextGuideSize = Math.round(
      Math.max(nextGuideSizeBounds.min, Math.min(nextGuideSizeBounds.max, guideSizeRef.current))
    );
    setGuide(nextGuide);
    if (nextGuideSize !== guideSizeRef.current) {
      guideSizeRef.current = nextGuideSize;
      setGuideSize(nextGuideSize); setGuideSizeInput(String(nextGuideSize));
    }
    setGuideVisible(true);
    if (!isShapeGuide(nextGuide)) {
      setIsGuideShapePointAdjusting(false);
      setSelectedGuideShapePointIndex(null); selectedGuideShapePointIndexRef.current = null;
    }
    void updateAppSettings({ defaultGuide: nextGuide, guideSize: nextGuideSize, guideVisible: true });
  };

  const updateGuideVisibility = (nextVisible: boolean) => {
    setGuideVisible(nextVisible);
    void updateAppSettings({ guideVisible: nextVisible });
  };

  const updateGuideStrokeWidth = (nextStrokeWidth: number) => {
    const clampedStrokeWidth = Math.round(
      Math.max(GUIDE_STROKE_WIDTH_MIN, Math.min(GUIDE_STROKE_WIDTH_MAX, nextStrokeWidth))
    );
    setGuideStrokeWidth(clampedStrokeWidth);
    setGuideVisible(true);
    void updateAppSettings({ guideStrokeWidth: clampedStrokeWidth, guideVisible: true });
  };

  const updateGuideColor = (nextColor: string) => {
    setGuideColor(nextColor);
    setGuideVisible(true);
    void updateAppSettings({ guideColor: nextColor, guideVisible: true });
  };

  const commitGuideSizeInput = () => {
    const parsedSize = Number(guideSizeInput);
    if (!Number.isFinite(parsedSize)) {
      setGuideSizeInput(String(guideSize));
      return;
    }

    applyGuideSize(parsedSize);
  };

  const applyOverlayOpacityPercent = useCallback((value: number) => {
    const nextOpacity = Math.round(Math.max(OVERLAY_OPACITY_MIN, Math.min(OVERLAY_OPACITY_MAX, value)));
    setOverlayOpacity(Number((nextOpacity / 100).toFixed(2)));
  }, []);

  const applyZoomPercent = useCallback((value: number) => {
    const nextZoom = Math.round(Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, value)));
    setZoomPercent(nextZoom);
  }, []);

  const setZoomPreset = useCallback(
    (preset: CameraZoomPreset) => {
      const nextFactor = getCameraZoomPresetFactor(preset, cameraDevice);
      const nextZoom = getCameraZoomPercentFromFactor(nextFactor, cameraDevice);
      setZoomPercent(nextZoom);
      void updateAppSettings({ cameraZoomPercent: nextZoom });
      void triggerFeedback();
    },
    [cameraDevice, triggerFeedback]
  );

  const setLightEnabled = useCallback(
    (enabled: boolean) => {
      const nextEnabled = cameraFacing === "back" && enabled;
      setTorchEnabled(nextEnabled);
      void updateAppSettings({ cameraTorchEnabled: nextEnabled });
      void triggerFeedback();
    },
    [cameraFacing, triggerFeedback]
  );

  const applyCameraExposureBias = useCallback(
    (value: number) => {
      const nextBias = Math.max(cameraExposureMin, Math.min(cameraExposureMax, value));
      const nextRoundedBias = Number(nextBias.toFixed(2));
      if (cameraExposureBiasRef.current === nextRoundedBias) {
        return;
      }

      cameraExposureBiasRef.current = nextRoundedBias;
      setCameraExposureBias(nextRoundedBias);
    },
    [cameraExposureMax, cameraExposureMin]
  );

  const showFocusControls = useCallback(() => {
    setFocusIndicatorVisible(true);
    focusControlsOpacity.value = 0;
    focusIndicatorScale.value = 1.5;
    focusControlsOpacity.value = withTiming(1, { duration: CAMERA_FOCUS_CONTROLS_FADE_MS });
    focusIndicatorScale.value = withTiming(1, { duration: CAMERA_FOCUS_CONTROLS_FADE_MS });
  }, [focusControlsOpacity, focusIndicatorScale]);

  const cancelFocusControlsDismiss = useCallback(() => {
    if (focusIndicatorTimeout.current) {
      clearTimeout(focusIndicatorTimeout.current);
      focusIndicatorTimeout.current = null;
    }
    setFocusIndicatorVisible(true);
    focusControlsOpacity.value = withTiming(1, { duration: CAMERA_FOCUS_CONTROLS_FADE_MS });
    focusIndicatorScale.value = withTiming(1, { duration: CAMERA_FOCUS_CONTROLS_FADE_MS });
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
  }, [focusControlsOpacity]);

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
      setCameraFocusTap(tap);
      showFocusControls();
      void cameraRef.current?.focusTo(tap, {
        responsiveness: "snappy",
        adaptiveness: cameraFocusLockedRef.current ? "locked" : "continuous",
        autoResetAfter: cameraFocusLockedRef.current ? null : 5,
        modes: getCameraFocusMeteringModes(cameraDevice)
      });
      void triggerFeedback();
      scheduleFocusControlsDismiss();
    },
    [cameraDevice, cameraFrame, scheduleFocusControlsDismiss, showFocusControls, triggerFeedback]
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
      void cameraRef.current?.focusTo(cameraFocusTap, {
        responsiveness: "snappy",
        adaptiveness: "locked",
        autoResetAfter: null,
        modes: getCameraFocusMeteringModes(cameraDevice)
      });
    } else {
      void cameraRef.current?.resetFocus();
      scheduleFocusControlsDismiss();
    }

    void triggerFeedback();
  }, [cameraDevice, cameraFocusTap, cancelFocusControlsDismiss, scheduleFocusControlsDismiss, triggerFeedback]);

  const changeCameraFacing = useCallback((value: CameraFacing) => {
    setCameraFacing(value);
    setIsCameraReady(false);
    setCameraFocusTap(null);
    cameraFocusLockedRef.current = false;
    setCameraFocusLocked(false);
    if (value === "front") {
      setTorchEnabled(false);
      void updateAppSettings({ cameraFacing: value, cameraTorchEnabled: false });
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

  const updateCameraShutterSoundMode = (nextMode: CameraShutterSoundMode) => {
    setCameraShutterSoundMode(nextMode);
    void updateAppSettings({ cameraShutterSoundMode: nextMode });
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

  const handleCameraSessionError = useCallback((error: Error) => {
    if (__DEV__) {
      console.warn("[camera] VisionCamera session error", error);
    }

    setIsCameraReady(false);
    setErrorMessage("카메라 연결이 불안정해 다시 시작합니다.");

    if (cameraRecoveryTimeout.current) {
      clearTimeout(cameraRecoveryTimeout.current);
    }

    setCameraRecoveryPending(true);
    cameraRecoveryTimeout.current = setTimeout(() => {
      cameraRecoveryTimeout.current = null;
      setCameraSessionRestartKey((value) => value + 1);
      setCameraRecoveryPending(false);
    }, CAMERA_SESSION_RECOVERY_DELAY_MS);
  }, []);

  const pickReferencePhoto = useCallback(async () => {
    try {
      setErrorMessage(null);
      await triggerFeedback();
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
      if (!mediaPermission.granted) {
        setErrorMessage("사진 가이드를 사용하려면 앨범 접근 권한이 필요합니다.");
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
  }, [triggerFeedback]);

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
      void pickReferencePhoto();
      return;
    }

    setOverlayLocked(false);
    setOverlaySetupActive(true);
  };

  const openCameraSettingsMenu = () => {
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
    (nextX: number, nextY: number) =>
      clampGuidePositionOffset({ x: nextX, y: nextY }, cameraFrame),
    [cameraFrame]
  );

  const syncGuideOffsetFromGesture = useCallback(
    (nextX: number, nextY: number) => {
      const clampedOffset = getClampedGuideOffset(nextX, nextY);
      guideOffsetRef.current = clampedOffset;
      setGuideOffsetX(clampedOffset.x);
      setGuideOffsetY(clampedOffset.y);
    },
    [getClampedGuideOffset]
  );

  const startGuidePositionAdjustment = () => {
    setGuideSettingsOpen(false);
    setGuideVisible(true);
    setIsGuideShapePointAdjusting(false);
    setSelectedGuideShapePointIndex(null);
    selectedGuideShapePointIndexRef.current = null;
    guideOffsetXValue.value = guideOffsetX;
    guideOffsetYValue.value = guideOffsetY;
    guidePinchStartSize.value = guideSizeRef.current;
    setIsGuidePositionAdjusting(true);
  };

  const finishGuidePositionAdjustment = () => {
    const clampedOffset = getClampedGuideOffset(guideOffsetXValue.value, guideOffsetYValue.value);
    guideOffsetXValue.value = clampedOffset.x;
    guideOffsetYValue.value = clampedOffset.y;
    guideOffsetRef.current = clampedOffset;
    setGuideOffsetX(clampedOffset.x);
    setGuideOffsetY(clampedOffset.y);
    setIsGuidePositionAdjusting(false);
    setIsGuideShapePointAdjusting(false);
    setSelectedGuideShapePointIndex(null);
    selectedGuideShapePointIndexRef.current = null;
    setGuideSettingsOpen(true);
    void updateAppSettings({
      guideOffsetX: clampedOffset.x,
      guideOffsetY: clampedOffset.y,
      guideSize: guideSizeRef.current,
      guideShapePoints: guideShapePointsRef.current,
      guideVisible: true
    });
  };

  const resetGuidePositionToCenter = () => {
    guideOffsetXValue.value = 0;
    guideOffsetYValue.value = 0;
    guideOffsetRef.current = { x: 0, y: 0 };
    setGuideOffsetX(0);
    setGuideOffsetY(0);
  };

  const resetGuideSizeToDefault = () => {
    const defaultGuideSize = Math.round(
      Math.max(guideSizeBounds.min, Math.min(guideSizeBounds.max, defaultAppSettings.guideSize))
    );
    guideSizeRef.current = defaultGuideSize;
    guidePinchStartSize.value = defaultGuideSize;
    setGuideSize(defaultGuideSize); setGuideSizeInput(String(defaultGuideSize));
    return defaultGuideSize;
  };

  const startGridLineControl = () => {
    setGuideSettingsOpen(false);
    setGuide("grid");
    setGuideVisible(true);
    selectedGridGuideLineRef.current = null;
    setSelectedGridGuideLine(null);
    setIsGridLineControlAdjusting(true);
  };

  const finishGridLineControl = () => {
    setIsGridLineControlAdjusting(false);
    selectedGridGuideLineRef.current = null;
    setSelectedGridGuideLine(null);
    setGuideSettingsOpen(true);
    void updateAppSettings({
      defaultGuide: "grid",
      guideVisible: true,
      guideSize: guideSizeRef.current,
      gridGuideLinePositions: gridGuideLinePositionsRef.current
    });
  };

  const resetGridLineControlToDefault = (nextGuideSize = guideSize) => {
    applyGridGuideLinePositionsState(getDefaultGridGuideLinePositions(nextGuideSize));
    selectedGridGuideLineRef.current = null;
    setSelectedGridGuideLine(null);
  };

  const resetCurrentGuideAdjustment = () => {
    const defaultGuideSize = resetGuideSizeToDefault();
    resetGuidePositionToCenter();
    if (guide === "grid") {
      resetGridLineControlToDefault(defaultGuideSize);
    }
    if (isShapeGuide(guide)) {
      applyGuideShapePointsState({ ...guideShapePointsRef.current, [guide]: defaultGuideShapePoints[guide].map((point) => ({ ...point })) });
      selectedGuideShapePointIndexRef.current = null; setSelectedGuideShapePointIndex(null);
    }
  };

  const startGuideShapePointControl = () => {
    if (!isShapeGuide(guide)) {
      return;
    }

    setIsGuideShapePointAdjusting(true);
    selectedGuideShapePointIndexRef.current = null;
    setSelectedGuideShapePointIndex(null);
  };

  const finishGuideShapePointControl = () => {
    setIsGuideShapePointAdjusting(false);
    selectedGuideShapePointIndexRef.current = null;
    setSelectedGuideShapePointIndex(null);
    void updateAppSettings({
      guideShapePoints: guideShapePointsRef.current,
      guideVisible: true
    });
  };

  const handleGuideShapePointStart = useCallback(
    (x: number, y: number) => {
      const selectedIndex = getNearestGuideShapePoint({
        guide,
        x,
        y,
        frame: cameraFrame,
        guideSize: guideSizeRef.current,
        offset: guideOffsetRef.current,
        shapePoints: guideShapePointsRef.current
      });
      const nextShapePoints = updateGuideShapePointFromPoint({
        guide,
        pointIndex: selectedIndex,
        x,
        y,
        frame: cameraFrame,
        guideSize: guideSizeRef.current,
        offset: guideOffsetRef.current,
        shapePoints: guideShapePointsRef.current
      });

      selectedGuideShapePointIndexRef.current = selectedIndex;
      setSelectedGuideShapePointIndex(selectedIndex);
      applyGuideShapePointsState(nextShapePoints);
    },
    [applyGuideShapePointsState, cameraFrame, guide]
  );

  const handleGuideShapePointMove = useCallback(
    (x: number, y: number) => {
      const selectedIndex = selectedGuideShapePointIndexRef.current;
      const nextShapePoints = updateGuideShapePointFromPoint({
        guide,
        pointIndex: selectedIndex,
        x,
        y,
        frame: cameraFrame,
        guideSize: guideSizeRef.current,
        offset: guideOffsetRef.current,
        shapePoints: guideShapePointsRef.current
      });

      applyGuideShapePointsState(nextShapePoints);
    },
    [applyGuideShapePointsState, cameraFrame, guide]
  );

  const handleGridLineControlStart = useCallback(
    (x: number, y: number) => {
      const selectedLine = getNearestGridGuideLine({
        x,
        y,
        frame: cameraFrame,
        positions: gridGuideLinePositionsRef.current
      });
      const nextPositions = updateGridGuideLineFromPoint({
        line: selectedLine,
        x,
        y,
        frame: cameraFrame,
        positions: gridGuideLinePositionsRef.current
      });

      selectedGridGuideLineRef.current = selectedLine;
      setSelectedGridGuideLine(selectedLine);
      applyGridGuideLinePositionsState(nextPositions);
    },
    [applyGridGuideLinePositionsState, cameraFrame]
  );

  const handleGridLineControlMove = useCallback(
    (x: number, y: number) => {
      const selectedLine =
        selectedGridGuideLineRef.current ??
        getNearestGridGuideLine({
          x,
          y,
          frame: cameraFrame,
          positions: gridGuideLinePositionsRef.current
        });
      const nextPositions = updateGridGuideLineFromPoint({
        line: selectedLine,
        x,
        y,
        frame: cameraFrame,
        positions: gridGuideLinePositionsRef.current
      });

      selectedGridGuideLineRef.current = selectedLine;
      setSelectedGridGuideLine(selectedLine);
      applyGridGuideLinePositionsState(nextPositions);
    },
    [applyGridGuideLinePositionsState, cameraFrame]
  );

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
          cameraControlTabSlideX.value = Math.max(minOffset, Math.min(0, nextOffset));
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
          cameraControlTabSlideX.value = withTiming(getCameraControlTabOffset(nextIndex), {
            duration: 160
          });
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
          const firstTabCenter =
            getCameraControlTabCenterPadding(
              cameraControlTabViewportWidth,
              cameraControlShutterCenterX
            ) +
            CAMERA_CONTROL_TAB_GAP +
            CAMERA_CONTROL_TAB_WIDTH / 2;
          const tappedIndex = Math.round(
            (event.x - firstTabCenter - cameraControlTabSlideX.value) / tabStride
          );
          const nextIndex = Math.max(0, Math.min(CAMERA_CONTROL_TABS.length - 1, tappedIndex));
          runOnJS(selectCameraControlTabByIndex)(nextIndex);
        }),
    [
      cameraControlShutterCenterX,
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
            !overlaySetupActive &&
            !isGuidePositionAdjusting &&
            !isGridLineControlAdjusting &&
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
      isCameraModalOpen,
      isCapturing,
      isGridLineControlAdjusting,
      isGuidePositionAdjusting,
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
            !overlaySetupActive &&
            !isGuidePositionAdjusting &&
            !isGridLineControlAdjusting &&
            !isCapturing
        )
        .onBegin(() => {
          cameraPinchStartZoomPercent.value = zoomPercent;
        })
        .onUpdate((event) => {
          const nextZoomPercent = Math.max(
            CAMERA_ZOOM_MIN,
            Math.min(CAMERA_ZOOM_MAX, cameraPinchStartZoomPercent.value + (event.scale - 1) * 45)
          );
          runOnJS(applyZoomPercent)(nextZoomPercent);
        }),
    [
      applyZoomPercent,
      cameraPinchStartZoomPercent,
      isCameraModalOpen,
      isCapturing,
      isGridLineControlAdjusting,
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
            !overlaySetupActive &&
            !isGuidePositionAdjusting &&
            !isGridLineControlAdjusting &&
            !isCapturing
        )
        .maxDuration(250)
        .onEnd((event) => {
          runOnJS(handleCameraTap)(event.x, event.y);
        }),
    [
      handleCameraTap,
      isCameraModalOpen,
      isCapturing,
      isGridLineControlAdjusting,
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
        .maxPointers(1)
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
          runOnJS(syncGuideOffsetFromGesture)(guideOffsetXValue.value, guideOffsetYValue.value);
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

  const guidePositionPinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(isGuidePositionAdjusting)
        .onBegin(() => {
          guidePinchStartSize.value = guideSize;
        })
        .onUpdate((event) => {
          runOnJS(previewGuideSize)(guidePinchStartSize.value * event.scale);
        }),
    [guidePinchStartSize, guideSize, isGuidePositionAdjusting, previewGuideSize]
  );

  const guidePositionAdjustmentGesture = useMemo(
    () => Gesture.Simultaneous(guidePositionGesture, guidePositionPinchGesture),
    [guidePositionGesture, guidePositionPinchGesture]
  );

  const guideShapePointGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isGuideShapePointAdjusting)
        .onBegin((event) => {
          runOnJS(handleGuideShapePointStart)(event.x, event.y);
        })
        .onUpdate((event) => {
          runOnJS(handleGuideShapePointMove)(event.x, event.y);
        }),
    [handleGuideShapePointMove, handleGuideShapePointStart, isGuideShapePointAdjusting]
  );

  const gridLineControlGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isGridLineControlAdjusting)
        .onBegin((event) => {
          runOnJS(handleGridLineControlStart)(event.x, event.y);
        })
        .onUpdate((event) => {
          runOnJS(handleGridLineControlMove)(event.x, event.y);
        }),
    [handleGridLineControlMove, handleGridLineControlStart, isGridLineControlAdjusting]
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

  const capturePhoto = async () => {
    if (!cameraDevice || !isCameraReady || isCapturing) {
      return;
    }

    let photoUri: string | null = null;

    try {
      setIsCapturing(true);
      setErrorMessage(null);
      const photo = await photoOutput.capturePhotoToFile(
        {
          flashMode: cameraDevice.hasFlash ? flashMode : "off",
          enableShutterSound: cameraShutterSoundMode === "sound"
        },
        {}
      );
      photoUri = `file://${photo.filePath}`;
      const captureInput = {
        uri: photoUri,
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
      if (savedPhoto) {
        setRecentPhoto(savedPhoto);
        try {
          await backupPhotoIfEnabled({ user, subscription, photo: savedPhoto });
        } catch (backupError) {
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
    } catch (error) {
      setErrorMessage(getUserFacingErrorMessage(error, "사진을 촬영하지 못했습니다."));
    } finally {
      if (photoUri) {
        try {
          await deleteLocalFile(photoUri);
        } catch {
          // 저장 결과와 무관한 임시 파일 정리 실패는 촬영 실패로 표시하지 않습니다.
        }
      }
      setIsCapturing(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraDevice || !isCameraReady || isCapturing) {
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

  const returnFromPermissionScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/studio");
  }, []);

  const openPermissionSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  if (!hasCameraPermission) {
    return (
      <View style={styles.permissionScreen}>
        <Text selectable style={styles.permissionTitle}>
          카메라 접근 권한이 필요합니다.
        </Text>
        <Text selectable style={styles.permissionText}>
          실시간 카메라 화면을 보여주고 구도 가이드 촬영을 하려면 카메라 권한이 필요합니다.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={canRequestCameraPermission ? requestCameraPermission : openPermissionSettings}
        >
          <Text selectable={false} style={styles.permissionButtonText}>
            {canRequestCameraPermission ? "카메라 권한 허용" : "앱 설정에서 권한 허용"}
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
      {cameraDevice ? (
        <Camera
          key={`${cameraDevice.id}-${cameraSessionRestartKey}`}
          ref={cameraRef}
          style={styles.camera}
          device={cameraDevice}
          isActive={isCameraSessionActive}
          outputs={cameraOutputs}
          torchMode={torchEnabled && cameraDevice.hasTorch ? "on" : "off"}
          zoom={cameraZoomFactor}
          exposure={cameraExposureBias}
          getInitialZoom={() => cameraZoomFactor}
          getInitialExposureBias={() => cameraExposureBias}
          onStarted={() => {
            setIsCameraReady(true);
            if (errorMessage === "카메라 연결이 불안정해 다시 시작합니다.") {
              setErrorMessage(null);
            }
          }}
          onStopped={() => setIsCameraReady(false)}
          onError={handleCameraSessionError}
        />
      ) : (
        <View style={styles.permissionScreen}>
          <ActivityIndicator color={colors.inverse} />
          <Text selectable style={styles.permissionText}>
            사용할 수 있는 카메라를 찾는 중입니다.
          </Text>
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.guidePositionLayer,
          guide !== "grid"
            ? {
                transform: [
                  { translateX: guideOffsetXValue },
                  { translateY: guideOffsetYValue }
                ]
              }
            : null
        ]}
      >
        <CameraGuideOverlay
          guide={guide}
          visible={guideVisible}
          size={guideSize}
          strokeWidth={guideStrokeWidth}
          color={guideColor}
          gridLinePositions={gridGuideLinePositions}
          selectedGridLine={selectedGridGuideLine}
          shapePoints={guideShapePoints}
          showShapeControlPoints={isGuideShapePointAdjusting}
          selectedShapePointIndex={selectedGuideShapePointIndex}
          aspectRatio={cameraRatioAspect[cameraRatio] ?? undefined}
        />
      </Animated.View>
      <PhotoReferenceOverlay
        ref={referenceOverlayRef}
        uri={referenceUri}
        opacity={overlayOpacity}
        locked={overlayLocked}
        resetKey={overlayResetKey}
      />

      {isGuideShapePointAdjusting ? (
        <GestureDetector gesture={guideShapePointGesture}>
          <View collapsable={false} pointerEvents="box-only" style={styles.guidePositionDragLayer} />
        </GestureDetector>
      ) : null}

      {isGuidePositionAdjusting && !isGuideShapePointAdjusting ? (
        <GestureDetector gesture={guidePositionAdjustmentGesture}>
          <View collapsable={false} pointerEvents="box-only" style={styles.guidePositionDragLayer} />
        </GestureDetector>
      ) : null}

      {isGridLineControlAdjusting ? (
        <GestureDetector gesture={gridLineControlGesture}>
          <View collapsable={false} pointerEvents="box-only" style={styles.guidePositionDragLayer} />
        </GestureDetector>
      ) : null}

      {!isGuidePositionAdjusting && !isGridLineControlAdjusting ? (
        <GestureDetector gesture={cameraPreviewGesture}>
          <View
            collapsable={false}
            pointerEvents={isCameraModalOpen || overlaySetupActive ? "none" : "box-only"}
            style={styles.cameraSwipeLayer}
          />
        </GestureDetector>
      ) : null}

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
            <Feather name={cameraFocusLocked ? "lock" : "unlock"} size={12} color={colors.inverse} />
          </Pressable>
        </Animated.View>
      ) : null}

      {cameraFocusTap && focusIndicatorVisible && exposureControlPosition &&
      !isCameraModalOpen &&
      !isGuidePositionAdjusting &&
      !isGridLineControlAdjusting &&
      cameraSupportsExposureBias ? (
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
            min={cameraExposureMin}
            max={cameraExposureMax}
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

      {!isGuidePositionAdjusting && !isGridLineControlAdjusting ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={styles.accountIconButton}
            onPress={() => router.push("/account")}
            accessibilityRole="button"
            accessibilityLabel={user ? "마이페이지로 이동" : "로그인으로 이동"}
          >
            <Feather name="user" size={22} color={colors.inverse} />
          </Pressable>
          <Text selectable={false} style={styles.brand}>
            트래블프레임
          </Text>
          <Pressable
            style={styles.cameraSettingsIconButton}
            onPress={openCameraSettingsMenu}
            accessibilityRole="button"
            accessibilityLabel="카메라 설정 열기"
          >
            <Feather name="settings" size={22} color={colors.inverse} />
          </Pressable>
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
                <Text selectable={false} style={styles.modalEyebrow}>GUIDE</Text>
                <Text selectable={false} style={styles.modalTitle}>가이드 띄우기</Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setGuideChoiceOpen(false)}>
                <Text selectable={false} style={styles.modalCloseText}>닫기</Text>
              </Pressable>
            </View>
            <View style={styles.navList}>
              <Pressable style={styles.navItem} onPress={openLineGuideSettings}>
                <View style={styles.navItemCopy}>
                  <Text selectable={false} style={styles.navItemTitle}>라인 가이드</Text>
                  <Text selectable={false} style={styles.navItemDetail}>
                    중앙점, 원, 십자선, 3분할, 수평선 가이드를 설정합니다.
                  </Text>
                </View>
                <View style={styles.navItemArrow}>
                  <ChevronIcon color={colors.text} size={10} />
                </View>
              </Pressable>
              <Pressable style={styles.navItem} onPress={openPhotoGuideSettings}>
                <View style={styles.navItemCopy}>
                  <Text selectable={false} style={styles.navItemTitle}>사진 가이드</Text>
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
                <Text selectable={false} style={styles.modalEyebrow}>CAMERA</Text>
                <Text selectable={false} style={styles.modalTitle}>카메라 설정</Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setCameraSettingsOpen(false)}>
                <Text selectable={false} style={styles.modalCloseText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.cameraSettingsScrollShell}>
              <View pointerEvents="none" style={styles.cameraSettingsScrollHint}>
                <Text selectable={false} style={styles.cameraSettingsScrollHintText}>스크롤</Text>
                <Text selectable={false} style={styles.cameraSettingsScrollHintIcon}>↓</Text>
              </View>

              <ScrollView
                style={styles.cameraSettingsScroll}
                contentContainerStyle={styles.cameraSettingsContent}
                showsVerticalScrollIndicator
                persistentScrollbar
              >
                <View style={styles.cameraSettingBlock}>
                  <Text selectable={false} style={styles.modalSectionTitle}>카메라 방향</Text>
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
                  <Text selectable={false} style={styles.modalSectionTitle}>촬영 타이머</Text>
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
                  <Text selectable={false} style={styles.modalSectionTitle}>플래시</Text>
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
                  <CameraSettingToggleRow
                    title="손전등"
                    detail="어두운 곳에서 계속 켜지는 보조 조명입니다."
                    valueLabel={torchEnabled && cameraFacing === "back" ? "켜짐" : "꺼짐"}
                    disabled={cameraFacing === "front"}
                    onPress={() => setLightEnabled(!torchEnabled)}
                  />
                </View>

                <View style={styles.cameraSettingBlock}>
                  <Text selectable={false} style={styles.modalSectionTitle}>촬영 품질</Text>
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
                  <Text selectable={false} style={styles.modalSectionTitle}>카메라 비율</Text>
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
                </View>

                <View style={styles.cameraSettingBlock}>
                  <Text selectable={false} style={styles.modalSectionTitle}>저장 범위</Text>
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
                  <Text selectable={false} style={styles.modalSectionTitle}>촬영 보조</Text>
                  <CameraShutterSoundChoice
                    mode={cameraShutterSoundMode}
                    onChange={updateCameraShutterSoundMode}
                  />
                  <CameraSettingToggleRow
                    title="가이드 표시"
                    detail="현재 선택한 구도 가이드를 카메라 위에 표시합니다."
                    valueLabel={guideVisible ? "켜짐" : "꺼짐"}
                    onPress={() => updateGuideVisibility(!guideVisible)}
                  />
                  <CameraSettingToggleRow
                    title="햅틱 피드백"
                    detail="촬영과 주요 조작 시 짧은 진동 피드백을 사용합니다."
                    valueLabel={hapticEnabled ? "켜짐" : "꺼짐"}
                    onPress={() => setHapticEnabled((value) => !value)}
                  />
                </View>
              </ScrollView>
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
            <View style={[styles.guideModal, { paddingBottom: bottomModalPadding }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleGroup}>
                  <Text selectable={false} style={styles.modalEyebrow}>GUIDE</Text>
                  <Text selectable={false} style={styles.modalTitle}>가이드 설정</Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={() => setGuideSettingsOpen(false)}>
                  <Text selectable={false} style={styles.modalCloseText}>닫기</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.guideSettingsScroll}
                contentContainerStyle={styles.guideSettingsContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalSection}>
                  <Text selectable={false} style={styles.modalSectionTitle}>가이드라인</Text>
                  <View style={styles.optionGrid}>
                    {GUIDE_TYPES.map((type) => (
                      <Pressable
                        key={type}
                        style={[styles.optionButton, guide === type && styles.optionButtonActive]}
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
                  <Text selectable={false} style={styles.modalSectionTitle}>크기</Text>
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
                      compact
                      value={guideSize}
                      min={guideSizeBounds.min}
                      max={guideSizeBounds.max}
                      onChange={previewGuideSize}
                      onCommit={applyGuideSize}
                    />
                    <TextInput
                      value={guideSizeInput}
                      keyboardType="number-pad"
                      maxLength={String(guideSizeBounds.max).length}
                      selectTextOnFocus
                      style={styles.sizeInput}
                      onChangeText={(value) => setGuideSizeInput(value.replace(/[^0-9]/g, ""))}
                      onBlur={commitGuideSizeInput}
                      onSubmitEditing={commitGuideSizeInput}
                    />
                  </View>
                </View>

                {guide !== "grid" ? (
                  <Pressable style={styles.guidePositionButton} onPress={startGuidePositionAdjustment}>
                    <Text selectable={false} style={styles.guidePositionButtonText}>
                      위치·모양 조절
                    </Text>
                  </Pressable>
                ) : null}

                {guide === "grid" ? (
                  <Pressable style={styles.guidePositionButton} onPress={startGridLineControl}>
                    <Text selectable={false} style={styles.guidePositionButtonText}>
                      선 위치 조절
                    </Text>
                  </Pressable>
                ) : null}

                <View style={[styles.modalSection, styles.modalSectionSpaced]}>
                  <Text selectable={false} style={styles.modalSectionTitle}>선 두께</Text>
                  <View style={styles.optionRow}>
                    {GUIDE_STROKE_WIDTH_OPTIONS.map((strokeWidth) => {
                      const isActive = guideStrokeWidth === strokeWidth;
                      return (
                        <Pressable
                          key={strokeWidth}
                          style={[styles.optionButton, isActive && styles.optionButtonActive]}
                          onPress={() => updateGuideStrokeWidth(strokeWidth)}
                        >
                          <Text
                            selectable={false}
                            style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}
                          >
                            {strokeWidth}px
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.modalSection, styles.modalSectionSpaced]}>
                  <Text selectable={false} style={styles.modalSectionTitle}>색상</Text>
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
                        <View style={[styles.colorSwatch, { backgroundColor: option.value }]} />
                        <Text selectable={false} style={styles.colorLabel}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

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

      {!isCameraModalOpen && !isGuidePositionAdjusting && !isGridLineControlAdjusting ? (
        <View style={controlsStyle}>
          {errorMessage ? <Text selectable style={styles.errorText}>{errorMessage}</Text> : null}

          {overlaySetupActive && referenceUri ? (
            <View style={styles.captureRow}>
              <View style={styles.overlaySetupPanel}>
                <View style={styles.overlaySetupHeader}>
                  <View>
                    <Text selectable={false} style={styles.overlaySetupTitle}>이전 사진 맞추기</Text>
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
                  <Pressable style={styles.overlayCompactButton} onPress={() => referenceOverlayRef.current?.scaleBy(-0.1)}>
                    <Text selectable={false} style={styles.overlayCompactText}>작게</Text>
                  </Pressable>
                  <Pressable style={styles.overlayCompactButton} onPress={() => referenceOverlayRef.current?.scaleBy(0.1)}>
                    <Text selectable={false} style={styles.overlayCompactText}>크게</Text>
                  </Pressable>
                  <Pressable style={styles.overlayCompactButton} onPress={resetOverlay}>
                    <Text selectable={false} style={styles.overlayCompactText}>초기화</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.overlayCompactButton, styles.overlayRemoveButton]}
                    onPress={removeReferenceOverlay}
                  >
                    <Text selectable={false} style={[styles.overlayCompactText, styles.overlayRemoveText]}>
                      제거
                    </Text>
                  </Pressable>
                  <Pressable style={styles.overlayConfirmButton} onPress={confirmOverlaySetup}>
                    <Text selectable={false} style={styles.overlayConfirmText}>확인</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View collapsable={false} style={styles.cameraControlDeck}>
              {activeCameraControlTab !== "photo" ? (
                <View
                  pointerEvents="box-none"
                  style={[styles.cameraFloatingPanelWrap, styles.cameraFloatingPanelRaised]}
                >
                  <View style={styles.cameraControlPanelViewport}>
                    <Animated.View
                      key={activeCameraControlTab}
                      entering={FadeIn.duration(140)}
                      style={styles.cameraControlPage}
                    >
                      {activeCameraControlTab === "zoom" ? (
                        <View style={styles.quickButtonRow}>
                          {cameraZoomPresets.map((preset) => {
                            const presetFactor = getCameraZoomPresetFactor(preset, cameraDevice);
                            const isActive =
                              Math.abs(cameraZoomFactor - presetFactor) < 0.08;
                            return (
                              <Pressable
                                key={preset.label}
                                style={[
                                  styles.quickPillButton,
                                  isActive && styles.quickPillButtonActive
                                ]}
                                onPress={() => setZoomPreset(preset)}
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
                      {activeCameraControlTab === "guide" ? (
                        <View style={styles.quickButtonRow}>
                          <Pressable
                            style={[
                              styles.quickPillButton,
                              isLineGuideActive && styles.quickPillButtonActive
                            ]}
                            onPress={openLineGuideSettings}
                          >
                            <Text
                              selectable={false}
                              style={[
                                styles.quickPillText,
                                isLineGuideActive && styles.quickPillTextActive
                              ]}
                            >
                              라인
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.quickPillButton,
                              isPhotoGuideActive && styles.quickPillButtonActive
                            ]}
                            onPress={openPhotoGuideSettings}
                          >
                            <Text
                              selectable={false}
                              style={[
                                styles.quickPillText,
                                isPhotoGuideActive && styles.quickPillTextActive
                              ]}
                            >
                              이미지
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                      {activeCameraControlTab === "light" ? (
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
                        style={[styles.cameraControlTabTrack, cameraControlTabTrackAnimatedStyle]}
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
                            <Pressable
                              key={tab.id}
                              style={[
                                styles.cameraControlTab,
                                isActive && styles.cameraControlTabActive
                              ]}
                              onPress={() => selectCameraControlTab(tab.id)}
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
                            </Pressable>
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
                    accessibilityLabel="개인 갤러리 열기"
                  >
                    {recentPhoto ? (
                      <NativeImage source={{ uri: recentPhoto.uri }} style={styles.galleryThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.galleryEmptyThumb}>
                        <View style={styles.galleryEmptyLine} />
                        <View style={styles.galleryEmptyDot} />
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    android_disableSound
                    disabled={!isCameraReady || isCapturing || !cameraDevice}
                    onLayout={(event) => {
                      const { x, width } = event.nativeEvent.layout;
                      setCameraControlShutterCenterX(x + width / 2);
                    }}
                    style={[
                      styles.shutterOuter,
                      (!isCameraReady || isCapturing || !cameraDevice) && styles.shutterDisabled
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
                      cameraFacing === "front" ? "후면 카메라로 전환" : "전면 카메라로 전환"
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

      {isGuidePositionAdjusting || isGridLineControlAdjusting ? (
        <View style={[styles.guidePositionActionGroup, { right: 16, bottom: bottomSafePadding }]}>
          <Pressable
            style={styles.guidePositionSecondaryButton}
            onPress={() => {
              if (isGridLineControlAdjusting) {
                resetGridLineControlToDefault();
                return;
              }
              resetGuidePositionToCenter();
            }}
          >
            <Text selectable={false} style={styles.guidePositionSecondaryText}>중앙</Text>
          </Pressable>
          <Pressable style={styles.guidePositionSecondaryButton} onPress={resetCurrentGuideAdjustment}>
            <Text selectable={false} style={styles.guidePositionSecondaryText}>초기화</Text>
          </Pressable>
          {isGuidePositionAdjusting && isShapeGuide(guide) ? (
            <Pressable
              style={styles.guidePositionSecondaryButton}
              onPress={isGuideShapePointAdjusting ? finishGuideShapePointControl : startGuideShapePointControl}
            >
              <Text selectable={false} style={styles.guidePositionSecondaryText}>선 설정</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.guidePositionDoneButton}
            onPress={isGridLineControlAdjusting ? finishGridLineControl : finishGuidePositionAdjustment}
          >
            <Text selectable={false} style={styles.guidePositionDoneText}>완료</Text>
          </Pressable>
        </View>
      ) : null}
      <AppGuideOverlay tabKey="camera" transparentBackdrop />
    </View>
  );
}

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Image as NativeImage,
  Linking,
  type LayoutChangeEvent,
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
  useCameraDevices,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
  type FlashMode
} from "react-native-vision-camera";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { PhotoReferenceOverlay, type PhotoReferenceOverlayHandle } from "@/components/photo-reference-overlay";
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
import {
  CAMERA_COLOR_ADJUST_MAX,
  CAMERA_COLOR_ADJUST_MIN,
  CAMERA_COLOR_TEMPERATURE_COOL,
  CAMERA_COLOR_TEMPERATURE_WARM,
  CAMERA_COLOR_TINT_GREEN,
  CAMERA_COLOR_TINT_MAGENTA,
  CAMERA_EXPOSURE_BIAS_MAX,
  CAMERA_EXPOSURE_BIAS_MIN,
  CAMERA_FACING_OPTIONS,
  CAMERA_FLASH_OPTIONS,
  CAMERA_FLIP_HORIZONTAL_TOLERANCE,
  CAMERA_FLIP_SWIPE_THRESHOLD,
  CAMERA_PREVIEW_BOTTOM_RESERVED,
  CAMERA_PREVIEW_CONTROL_GAP,
  CAMERA_PREVIEW_OVERLAY_SETUP_BOTTOM_RESERVED,
  CAMERA_PREVIEW_TOP_RESERVED,
  CAMERA_QUALITY_OPTIONS,
  CAMERA_RATIO_OPTIONS,
  CAMERA_SAVE_SCOPE_OPTIONS,
  CAMERA_SESSION_RECOVERY_DELAY_MS,
  CAMERA_TIMER_OPTIONS,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  GUIDE_COLOR_OPTIONS,
  GUIDE_SIZE_OPTIONS,
  GUIDE_STROKE_WIDTH_OPTIONS,
  OVERLAY_OPACITY_MAX,
  OVERLAY_OPACITY_MIN,
  cameraRatioAspect,
  clampCameraColorAdjustment,
  formatCameraExposureValue,
  formatCameraSignedValue,
  getCameraColorOverlayColor,
  getCameraDeviceLensTypes,
  getCameraFocusMeteringModes,
  getCameraNeutralOverlayColor,
  getCameraSaturationOverlayColor,
  getCameraSupportsUltraWideZoom,
  getCameraZoomFactorFromPercent,
  getCameraZoomPercentFromFactor,
  getCameraZoomPresetFactor,
  getCameraZoomPresets,
  getPreferredCameraDevice,
  sleep,
  type CameraControlPanel,
  type CameraQualityValue,
  type CameraSettingsPatch,
  type CameraTimerValue,
  type CameraZoomPreset
} from "@/features/camera/camera-screen.model";
import { styles } from "@/features/camera/camera-screen.styles";
import { useAuth } from "@/lib/auth-context";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import { calculateGuidePositionDragOffset, clampGuidePositionOffset } from "@/lib/camera-guide-position";
import { getNormalizedCameraFocusPoint, getTapExposureControlPosition } from "@/lib/camera-focus-controls";
import { backupPhotoIfEnabled } from "@/lib/cloud-backup";
import {
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  defaultGridGuideLinePositions,
  defaultGuideShapePoints,
  createCameraSaveScope,
  getAppSettings,
  getCameraSaveScopeTargets,
  getGuideSizeBounds,
  updateAppSettings,
  type CameraColorSlot,
  type CameraColorValues,
  type CameraFacing,
  type CameraSaveTarget,
  type CameraShutterSoundMode,
  type CameraSaveScope,
  type GridGuideLineKey,
  type GridGuideLinePositions,
  type GuideShapePoints
} from "@/lib/app-settings";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { isMediaLibraryAccessGranted, requestMediaLibraryAccess } from "@/lib/request-media-library-access";
import { deleteLocalFile, getRecentPhoto, saveCapturedPhoto, saveCapturedPhotoToDevice } from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { PhotoItem, PhotoRatioLabel, SaveCapturedPhotoInput } from "@/types/photo";
export default function CameraScreen() {
  const { user, subscription } = useAuth();
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn: Boolean(user), subscription }),
    [subscription, user]
  );
  const canSelectCloudSaveTarget = planEntitlements.canBackupToCloud;
  const cameraRef = useRef<CameraRef>(null);
  const referenceOverlayRef = useRef<PhotoReferenceOverlayHandle>(null);
  const pendingSettingsPatchRef = useRef<CameraSettingsPatch | null>(null);
  const settingsSaveChainRef = useRef<Promise<void>>(Promise.resolve());
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
  const [guideLineOpacity, setGuideLineOpacity] = useState(defaultAppSettings.guideLineOpacity);
  const [guideOffsetX, setGuideOffsetX] = useState(0);
  const [guideOffsetY, setGuideOffsetY] = useState(0);
  const [guideOffsetFrameWidth, setGuideOffsetFrameWidth] = useState(0);
  const [guideOffsetFrameHeight, setGuideOffsetFrameHeight] = useState(0);
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
  const [guideSettingsOpen, setGuideSettingsOpen] = useState(false);
  const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
  const [activeCameraControlPanel, setActiveCameraControlPanel] =
    useState<CameraControlPanel | null>(null);
  const [shutterTimer, setShutterTimer] = useState<CameraTimerValue>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [photoQuality, setPhotoQuality] = useState<CameraQualityValue>("high");
  const [cameraRatio, setCameraRatio] = useState<PhotoRatioLabel>(defaultAppSettings.cameraRatio);
  const [cameraSaveScope, setCameraSaveScope] = useState<CameraSaveScope>(defaultAppSettings.cameraSaveScope);
  const [cameraShutterSoundMode, setCameraShutterSoundMode] =
    useState<CameraShutterSoundMode>("silent");
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("back");
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(0);
  const [cameraFocusTap, setCameraFocusTap] = useState<{ x: number; y: number } | null>(null);
  const [focusIndicatorVisible, setFocusIndicatorVisible] = useState(false);
  const [cameraFocusLocked, setCameraFocusLocked] = useState(false);
  const [cameraExposureBias, setCameraExposureBias] = useState(defaultAppSettings.cameraExposureBias);
  const [cameraColorTemperature, setCameraColorTemperature] = useState(defaultAppSettings.cameraColorTemperature);
  const [cameraColorTint, setCameraColorTint] = useState(defaultAppSettings.cameraColorTint);
  const [cameraBrightness, setCameraBrightness] = useState(defaultAppSettings.cameraBrightness);
  const [cameraContrast, setCameraContrast] = useState(defaultAppSettings.cameraContrast);
  const [cameraSaturation, setCameraSaturation] = useState(defaultAppSettings.cameraSaturation);
  const [cameraColorSlots, setCameraColorSlots] = useState(defaultAppSettings.cameraColorSlots);
  const [selectedCameraColorSlot, setSelectedCameraColorSlot] =
    useState(defaultAppSettings.selectedCameraColorSlot);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCameraScreenFocused, setIsCameraScreenFocused] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [cameraRecoveryPending, setCameraRecoveryPending] = useState(false);
  const [cameraSessionRestartKey, setCameraSessionRestartKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingPhotoSaveCount, setPendingPhotoSaveCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [referenceUri, setReferenceUri] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.42);
  const defaultOverlayOpacity = useRef(0.4);
  const [overlaySetupActive, setOverlaySetupActive] = useState(false);
  const [overlayLocked, setOverlayLocked] = useState(false);
  const [overlayResetKey, setOverlayResetKey] = useState(0);
  const [recentPhoto, setRecentPhoto] = useState<PhotoItem | null>(null);
  const [cameraFrame, setCameraFrame] = useState({ width: 0, height: 0 });
  const [cameraPreviewViewport, setCameraPreviewViewport] = useState({ width: 0, height: 0 });
  const [cameraTopBarHeight, setCameraTopBarHeight] = useState(0);
  const [cameraControlsHeight, setCameraControlsHeight] = useState(0);
  const guideOffsetXValue = useSharedValue(0);
  const guideOffsetYValue = useSharedValue(0);
  const guideDragStartX = useSharedValue(0);
  const guideDragStartY = useSharedValue(0);
  const guidePinchStartSize = useSharedValue(44);
  const cameraPinchStartZoomPercent = useSharedValue(0);
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
  const cameraExposureBiasRef = useRef(defaultAppSettings.cameraExposureBias);
  const cameraTorchAppliedRef = useRef(false);
  const focusIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRecoveryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedCaptureTokenRef = useRef(0);
  const isTimedCapturePendingRef = useRef(false);
  const isCameraReadyRef = useRef(false);
  const isCameraSessionActiveRef = useRef(false);
  const cameraNativeCaptureInProgressRef = useRef(false);
  const captureSaveQueueTailRef = useRef<Promise<void>>(Promise.resolve());
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
  const isCameraModalOpen = guideSettingsOpen || cameraSettingsOpen;
  const controlsStyle = overlaySetupActive
    ? [styles.controls, { paddingBottom: bottomSafePadding }]
    : styles.controls;
  const isLineGuideActive = guideVisible;
  const isPhotoGuideActive = Boolean(referenceUri);
  const isPhotoSavePending = pendingPhotoSaveCount > 0;
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
  const flushQueuedAppSettingsUpdates = useCallback(async () => {
    const nextPatch = pendingSettingsPatchRef.current;
    if (!nextPatch) {
      return;
    }

    pendingSettingsPatchRef.current = null;
    try {
      await updateAppSettings(nextPatch);
    } catch (error) {
      const pendingPatch = pendingSettingsPatchRef.current ?? {};
      pendingSettingsPatchRef.current = {
        ...nextPatch,
        ...pendingPatch
      };
      throw error;
    }
  }, []);
  const queueAppSettingsUpdate = useCallback(
    (updates: CameraSettingsPatch) => {
      pendingSettingsPatchRef.current = {
        ...pendingSettingsPatchRef.current,
        ...updates
      };
      settingsSaveChainRef.current = settingsSaveChainRef.current.then(
        flushQueuedAppSettingsUpdates,
        flushQueuedAppSettingsUpdates
      );
      void settingsSaveChainRef.current;
    },
    [flushQueuedAppSettingsUpdates]
  );
  const cameraDevices = useCameraDevices();
  const cameraDevice = useMemo(
    () => getPreferredCameraDevice(cameraDevices, cameraFacing),
    [cameraDevices, cameraFacing]
  );
  const availableCameraLenses = useMemo(
    () => getCameraDeviceLensTypes(cameraDevice),
    [cameraDevice]
  );
  const cameraZoomPresets = useMemo(
    () => getCameraZoomPresets(cameraFacing, availableCameraLenses, cameraDevice),
    [availableCameraLenses, cameraDevice, cameraFacing]
  );
  const cameraZoomFactor = useMemo(
    () => getCameraZoomFactorFromPercent(zoomPercent, cameraDevice),
    [cameraDevice, zoomPercent]
  );
  const photoOutputQuality =
    CAMERA_QUALITY_OPTIONS.find((option) => option.value === photoQuality)?.quality ?? 0.92;
  const photoOutput = usePhotoOutput({ quality: photoOutputQuality });
  const cameraOutputs = useMemo(() => [photoOutput], [photoOutput]);
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
  const cameraNativeControlsReady = isCameraSessionActive && isCameraReady;
  const cameraLightAvailable = cameraFacing === "back" && Boolean(cameraDevice);
  const visibleTorchEnabled = cameraLightAvailable && torchEnabled;
  const cameraNativeZoom = cameraNativeControlsReady ? cameraZoomFactor : undefined;
  const cameraNativeExposure = cameraNativeControlsReady ? cameraExposureBias : undefined;
  const cameraColorOverlayStyle = useMemo(
    () => [
      styles.cameraColorOverlay,
      {
        backgroundColor: getCameraColorOverlayColor(
          cameraColorTemperature,
          CAMERA_COLOR_TEMPERATURE_COOL,
          CAMERA_COLOR_TEMPERATURE_WARM
        )
      }
    ],
    [cameraColorTemperature]
  );
  const cameraTintOverlayStyle = useMemo(
    () => [
      styles.cameraColorOverlay,
      {
        backgroundColor: getCameraColorOverlayColor(
          cameraColorTint,
          CAMERA_COLOR_TINT_GREEN,
          CAMERA_COLOR_TINT_MAGENTA
        )
      }
    ],
    [cameraColorTint]
  );
  const cameraBrightnessOverlayStyle = useMemo(
    () => [
      styles.cameraColorOverlay,
      {
        backgroundColor: getCameraNeutralOverlayColor(cameraBrightness)
      }
    ],
    [cameraBrightness]
  );
  const cameraContrastOverlayStyle = useMemo(
    () => [
      styles.cameraColorOverlay,
      {
        backgroundColor: getCameraNeutralOverlayColor(cameraContrast)
      }
    ],
    [cameraContrast]
  );
  const cameraSaturationOverlayStyle = useMemo(
    () => [
      styles.cameraColorOverlay,
      {
        backgroundColor: getCameraSaturationOverlayColor(cameraSaturation)
      }
    ],
    [cameraSaturation]
  );
  const cancelPendingTimedCapture = useCallback(() => {
    if (!isTimedCapturePendingRef.current) {
      return;
    }

    timedCaptureTokenRef.current += 1;
    isTimedCapturePendingRef.current = false;
    setCountdown(null);
    setIsCapturing(false);
  }, []);
  const canCaptureWithCurrentSession = useCallback(
    () =>
      isCameraReadyRef.current &&
      isCameraSessionActiveRef.current,
    []
  );
  const selectedCameraRatioAspect = cameraRatioAspect[cameraRatio] ?? undefined;
  const cameraPreviewTopOffset =
    cameraTopBarHeight > 0
      ? cameraTopBarHeight + CAMERA_PREVIEW_CONTROL_GAP
      : Math.max(insets.top + 56, CAMERA_PREVIEW_TOP_RESERVED);
  const cameraPreviewBottomReserved = overlaySetupActive
    ? CAMERA_PREVIEW_OVERLAY_SETUP_BOTTOM_RESERVED
    : CAMERA_PREVIEW_BOTTOM_RESERVED;
  const cameraPreviewBottomOffset = overlaySetupActive
    ? bottomSafePadding + cameraPreviewBottomReserved
    : cameraControlsHeight > 0
      ? cameraControlsHeight + CAMERA_PREVIEW_CONTROL_GAP
      : bottomSafePadding + cameraPreviewBottomReserved;
  const cameraPreviewViewportStyle = useMemo(
    () => ({
      top: 0,
      bottom: 0
    }),
    []
  );
  const cameraPreviewFrameStyle = useMemo(() => {
    const { width, height } = cameraPreviewViewport;

    if (!selectedCameraRatioAspect || width <= 0 || height <= 0) {
      return styles.cameraPreviewFrameFill;
    }

    const frameHeight = Math.round(width / selectedCameraRatioAspect);
    if (!Number.isFinite(frameHeight) || frameHeight <= 0) {
      return styles.cameraPreviewFrameFill;
    }

    const boundedFrameHeight = Math.min(frameHeight, height);
    const availablePreviewHeight = Math.max(0, height - cameraPreviewTopOffset - cameraPreviewBottomOffset);
    const frameFitsAboveControls = boundedFrameHeight <= availablePreviewHeight;
    const preferredFrameTop = frameFitsAboveControls
      ? cameraPreviewTopOffset + Math.round((availablePreviewHeight - boundedFrameHeight) / 2)
      : Math.round((height - boundedFrameHeight) / 2);
    const latestFrameTop = height - boundedFrameHeight;
    const frameTop = Math.max(
      0,
      Math.min(latestFrameTop, preferredFrameTop)
    );

    return {
      width: "100%" as const,
      height: boundedFrameHeight,
      top: frameTop
    };
  }, [
    cameraPreviewBottomOffset,
    cameraPreviewTopOffset,
    cameraPreviewViewport,
    selectedCameraRatioAspect
  ]);

  const focusIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusControlsOpacity.value,
    transform: [{ scale: focusIndicatorScale.value }]
  }));
  const focusControlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusControlsOpacity.value
  }));

  useFocusEffect(
    useCallback(() => {
      isCameraSessionActiveRef.current = true;
      setIsCameraScreenFocused(true);

      return () => {
        isCameraSessionActiveRef.current = false;
        isCameraReadyRef.current = false;
        cancelPendingTimedCapture();
        setIsCameraScreenFocused(false);
        setIsCameraReady(false);
      };
    }, [cancelPendingTimedCapture])
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
        setGuideLineOpacity(settings.guideLineOpacity);
        setGuideOffsetX(settings.guideOffsetX);
        setGuideOffsetY(settings.guideOffsetY);
        setGuideOffsetFrameWidth(settings.guideOffsetFrameWidth);
        setGuideOffsetFrameHeight(settings.guideOffsetFrameHeight);
        guideOffsetRef.current = { x: settings.guideOffsetX, y: settings.guideOffsetY };
        setGridGuideLinePositions(settings.gridGuideLinePositions);
        gridGuideLinePositionsRef.current = settings.gridGuideLinePositions;
        setGuideShapePoints(settings.guideShapePoints);
        guideShapePointsRef.current = settings.guideShapePoints;
        guideOffsetXValue.value = settings.guideOffsetX;
        guideOffsetYValue.value = settings.guideOffsetY;
        setOverlayOpacity(settings.overlayOpacity);
        setZoomPercent(settings.cameraZoomPercent);
        const restoredTorchEnabled = settings.cameraTorchEnabled && settings.cameraFacing === "back";
        setTorchEnabled(restoredTorchEnabled);
        setCameraFacing(settings.cameraFacing);
        setCameraRatio(settings.cameraRatio);
        setCameraSaveScope(settings.cameraSaveScope);
        setCameraShutterSoundMode(settings.cameraShutterSoundMode);
        cameraExposureBiasRef.current = settings.cameraExposureBias;
        setCameraExposureBias(settings.cameraExposureBias);
        setCameraColorTemperature(settings.cameraColorTemperature);
        setCameraColorTint(settings.cameraColorTint);
        setCameraBrightness(settings.cameraBrightness);
        setCameraContrast(settings.cameraContrast);
        setCameraSaturation(settings.cameraSaturation);
        setCameraColorSlots(settings.cameraColorSlots);
        setSelectedCameraColorSlot(settings.selectedCameraColorSlot);
        setRecentPhoto(latestPhoto);
      };

      void loadSettings();

      return () => {
        isActive = false;
      };
    }, [guideOffsetXValue, guideOffsetYValue])
  );

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
    isCameraReadyRef.current = isCameraReady;
    if (!isCameraReady) {
      cancelPendingTimedCapture();
    }
  }, [cancelPendingTimedCapture, isCameraReady]);

  useEffect(() => {
    isCameraSessionActiveRef.current = isCameraSessionActive;
    if (!isCameraSessionActive) {
      cancelPendingTimedCapture();
    }
  }, [cancelPendingTimedCapture, isCameraSessionActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState !== "active") {
        isCameraSessionActiveRef.current = false;
        isCameraReadyRef.current = false;
        cancelPendingTimedCapture();
        setIsCameraReady(false);
      }
    });

    return () => subscription.remove();
  }, [cancelPendingTimedCapture]);

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
      queueAppSettingsUpdate({
        guideSize: nextSize,
        guideVisible: true,
        ...(guide === "grid" ? { gridGuideLinePositions: nextGridGuideLinePositions } : {})
      });
    },
    [applyGridGuideLinePositionsState, guide, guideSizeBounds.max, guideSizeBounds.min, queueAppSettingsUpdate]
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
    queueAppSettingsUpdate({ defaultGuide: nextGuide, guideSize: nextGuideSize, guideVisible: true });
  };

  const updateGuideVisibility = (nextVisible: boolean) => {
    setGuideVisible(nextVisible);
    queueAppSettingsUpdate({ guideVisible: nextVisible });
  };

  const updateGuideStrokeWidth = (nextStrokeWidth: number) => {
    const clampedStrokeWidth = Math.round(
      Math.max(GUIDE_STROKE_WIDTH_MIN, Math.min(GUIDE_STROKE_WIDTH_MAX, nextStrokeWidth))
    );
    setGuideStrokeWidth(clampedStrokeWidth);
    setGuideVisible(true);
    queueAppSettingsUpdate({ guideStrokeWidth: clampedStrokeWidth, guideVisible: true });
  };

  const updateGuideColor = (nextColor: string) => {
    setGuideColor(nextColor);
    setGuideVisible(true);
    queueAppSettingsUpdate({ guideColor: nextColor, guideVisible: true });
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
      queueAppSettingsUpdate({ cameraZoomPercent: nextZoom });
      void triggerFeedback();
    },
    [cameraDevice, queueAppSettingsUpdate, triggerFeedback]
  );

  const setLightEnabled = useCallback(
    (enabled: boolean) => {
      const nextEnabled = cameraLightAvailable && enabled;
      setTorchEnabled(nextEnabled);
      queueAppSettingsUpdate({ cameraTorchEnabled: nextEnabled });
      void triggerFeedback();
    },
    [cameraLightAvailable, queueAppSettingsUpdate, triggerFeedback]
  );

  const handleCameraTorchError = useCallback((error: unknown) => {
    if (__DEV__) console.warn("[camera] torch update failed", error);
    cameraTorchAppliedRef.current = false;
    setTorchEnabled(false);
    queueAppSettingsUpdate({ cameraTorchEnabled: false });
    setErrorMessage(getUserFacingErrorMessage(error, "라이트를 켜지 못했습니다."));
  }, [queueAppSettingsUpdate]);

  const applyCameraTorchMode = useCallback(
    (enabled: boolean) => {
      if (!enabled && !cameraTorchAppliedRef.current) {
        return;
      }

      try {
        const result = cameraRef.current?.controller?.setTorchMode(enabled ? "on" : "off");
        cameraTorchAppliedRef.current = true;
        if (result) {
          void result.catch(handleCameraTorchError);
        }
      } catch (error) {
        handleCameraTorchError(error);
      }
    },
    [handleCameraTorchError]
  );

  useEffect(() => {
    if (!cameraNativeControlsReady || cameraFacing !== "back") {
      return;
    }

    applyCameraTorchMode(torchEnabled);
  }, [applyCameraTorchMode, cameraDevice?.id, cameraFacing, cameraNativeControlsReady, torchEnabled]);

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

  const applyCameraColorTemperature = useCallback((value: number) => {
    setCameraColorTemperature(clampCameraColorAdjustment(value));
  }, []);

  const applyCameraColorTint = useCallback((value: number) => {
    setCameraColorTint(clampCameraColorAdjustment(value));
  }, []);

  const applyCameraBrightness = useCallback((value: number) => {
    setCameraBrightness(clampCameraColorAdjustment(value));
  }, []);

  const applyCameraContrast = useCallback((value: number) => {
    setCameraContrast(clampCameraColorAdjustment(value));
  }, []);

  const applyCameraSaturation = useCallback((value: number) => {
    setCameraSaturation(clampCameraColorAdjustment(value));
  }, []);

  const applyCameraColorValues = useCallback((values: CameraColorValues) => {
    const nextExposureBias = Number(
      Math.max(cameraExposureMin, Math.min(cameraExposureMax, values.exposureBias)).toFixed(2)
    );
    const nextValues: CameraColorValues = {
      exposureBias: nextExposureBias,
      temperature: clampCameraColorAdjustment(values.temperature),
      tint: clampCameraColorAdjustment(values.tint),
      brightness: clampCameraColorAdjustment(values.brightness),
      contrast: clampCameraColorAdjustment(values.contrast),
      saturation: clampCameraColorAdjustment(values.saturation)
    };

    cameraExposureBiasRef.current = nextValues.exposureBias;
    setCameraExposureBias(nextValues.exposureBias);
    setCameraColorTemperature(nextValues.temperature);
    setCameraColorTint(nextValues.tint);
    setCameraBrightness(nextValues.brightness);
    setCameraContrast(nextValues.contrast);
    setCameraSaturation(nextValues.saturation);

    return nextValues;
  }, [cameraExposureMax, cameraExposureMin]);

  const getCameraColorAdjustmentInput = useCallback(() => ({
    brightness: cameraBrightness,
    contrast: cameraContrast,
    saturation: cameraSaturation,
    temperature: cameraColorTemperature,
    tint: cameraColorTint
  }), [
    cameraBrightness,
    cameraColorTemperature,
    cameraColorTint,
    cameraContrast,
    cameraSaturation
  ]);

  const getCurrentCameraColorValues = useCallback((): CameraColorValues => ({
    exposureBias: cameraExposureBias,
    temperature: cameraColorTemperature,
    tint: cameraColorTint,
    brightness: cameraBrightness,
    contrast: cameraContrast,
    saturation: cameraSaturation
  }), [
    cameraBrightness,
    cameraColorTemperature,
    cameraColorTint,
    cameraContrast,
    cameraExposureBias,
    cameraSaturation
  ]);

  const persistCameraColorValues = useCallback((
    values: CameraColorValues,
    slotIndex: number,
    nextSlots?: CameraColorSlot[]
  ) => {
    queueAppSettingsUpdate({
      cameraExposureBias: values.exposureBias,
      cameraColorTemperature: values.temperature,
      cameraColorTint: values.tint,
      cameraBrightness: values.brightness,
      cameraContrast: values.contrast,
      cameraSaturation: values.saturation,
      selectedCameraColorSlot: slotIndex,
      ...(nextSlots ? { cameraColorSlots: nextSlots } : {})
    });
  }, [queueAppSettingsUpdate]);

  const applyCameraColorSlot = useCallback((slot: CameraColorSlot, slotIndex: number) => {
    setSelectedCameraColorSlot(slotIndex);

    if (!slot) {
      const nextValues = applyCameraColorValues({
        exposureBias: defaultAppSettings.cameraExposureBias,
        temperature: defaultAppSettings.cameraColorTemperature,
        tint: defaultAppSettings.cameraColorTint,
        brightness: defaultAppSettings.cameraBrightness,
        contrast: defaultAppSettings.cameraContrast,
        saturation: defaultAppSettings.cameraSaturation
      });
      persistCameraColorValues(nextValues, slotIndex);
      void triggerFeedback();
      return;
    }

    const nextValues = applyCameraColorValues(slot);
    persistCameraColorValues(nextValues, slotIndex);
    void triggerFeedback();
  }, [
    applyCameraColorValues,
    persistCameraColorValues,
    triggerFeedback
  ]);

  const saveCameraColorSlot = useCallback(() => {
    const nextValues = getCurrentCameraColorValues();
    const isDefaultCameraColorValues =
      nextValues.exposureBias === defaultAppSettings.cameraExposureBias &&
      nextValues.temperature === defaultAppSettings.cameraColorTemperature &&
      nextValues.tint === defaultAppSettings.cameraColorTint &&
      nextValues.brightness === defaultAppSettings.cameraBrightness &&
      nextValues.contrast === defaultAppSettings.cameraContrast &&
      nextValues.saturation === defaultAppSettings.cameraSaturation;
    const nextSlot = isDefaultCameraColorValues ? null : nextValues;
    const nextSlots = cameraColorSlots.map((slot, index) =>
      index === selectedCameraColorSlot ? nextSlot : slot
    );

    setCameraColorSlots(nextSlots);
    persistCameraColorValues(nextValues, selectedCameraColorSlot, nextSlots);
    void triggerFeedback();
  }, [
    cameraColorSlots,
    getCurrentCameraColorValues,
    persistCameraColorValues,
    selectedCameraColorSlot,
    triggerFeedback
  ]);

  const saveCameraColorSettings = saveCameraColorSlot;

  const resetCameraColorSettings = useCallback(() => {
    const nextValues = applyCameraColorValues({
      exposureBias: defaultAppSettings.cameraExposureBias,
      temperature: defaultAppSettings.cameraColorTemperature,
      tint: defaultAppSettings.cameraColorTint,
      brightness: defaultAppSettings.cameraBrightness,
      contrast: defaultAppSettings.cameraContrast,
      saturation: defaultAppSettings.cameraSaturation
    });
    persistCameraColorValues(nextValues, selectedCameraColorSlot);
    void triggerFeedback();
  }, [
    applyCameraColorValues,
    persistCameraColorValues,
    selectedCameraColorSlot,
    triggerFeedback
  ]);

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

  const handleCameraFocusError = useCallback((error: unknown) => {
    if (__DEV__) console.warn("[camera] focus update failed", error);
    setErrorMessage(getUserFacingErrorMessage(error, "카메라 초점을 맞추지 못했습니다."));
  }, []);
  const runCameraFocusAction = useCallback(
    (action: () => Promise<void> | void) => {
      try {
        const result = action();
        if (result) {
          void result.catch(handleCameraFocusError);
        }
      } catch (error) {
        handleCameraFocusError(error);
      }
    },
    [handleCameraFocusError]
  );
  const handleCameraTap = useCallback(
    (x: number, y: number) => {
      if (!cameraDevice || !cameraRef.current || cameraFocusLockedRef.current) {
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
      runCameraFocusAction(() => cameraRef.current?.focusTo(tap, {
        responsiveness: "snappy",
        adaptiveness: cameraFocusLockedRef.current ? "locked" : "continuous",
        autoResetAfter: cameraFocusLockedRef.current ? null : 5,
        modes: getCameraFocusMeteringModes(cameraDevice)
      }));
      void triggerFeedback();
      scheduleFocusControlsDismiss();
    },
    [cameraDevice, cameraFrame, runCameraFocusAction, scheduleFocusControlsDismiss, showFocusControls, triggerFeedback]
  );
  const toggleCameraFocusLock = useCallback(() => {
    if (!cameraDevice || !cameraRef.current || !cameraFocusTap) {
      return;
    }

    const nextLocked = !cameraFocusLockedRef.current;
    cameraFocusLockedRef.current = nextLocked;
    setCameraFocusLocked(nextLocked);
    setFocusIndicatorVisible(true);

    if (nextLocked) {
      cancelFocusControlsDismiss();
      runCameraFocusAction(() => cameraRef.current?.focusTo(cameraFocusTap, {
        responsiveness: "snappy",
        adaptiveness: "locked",
        autoResetAfter: null,
        modes: getCameraFocusMeteringModes(cameraDevice)
      }));
    } else {
      runCameraFocusAction(() => cameraRef.current?.resetFocus());
      scheduleFocusControlsDismiss();
    }

    void triggerFeedback();
  }, [cameraDevice, cameraFocusTap, cancelFocusControlsDismiss, runCameraFocusAction, scheduleFocusControlsDismiss, triggerFeedback]);
  const changeCameraFacing = useCallback((value: CameraFacing) => {
    setCameraFacing(value);
    setIsCameraReady(false);
    setCameraFocusTap(null);
    cameraFocusLockedRef.current = false;
    setCameraFocusLocked(false);
    if (value === "front") {
      setTorchEnabled(false);
      queueAppSettingsUpdate({ cameraFacing: value, cameraTorchEnabled: false });
      return;
    }

    queueAppSettingsUpdate({ cameraFacing: value });
  }, [queueAppSettingsUpdate]);
  const updateCameraRatio = (nextRatio: PhotoRatioLabel) => {
    setCameraRatio(nextRatio);
    queueAppSettingsUpdate({ cameraRatio: nextRatio });
    void triggerFeedback();
  };

  const updateCameraSaveScope = (nextScope: CameraSaveScope) => {
    setCameraSaveScope(nextScope);
    queueAppSettingsUpdate({ cameraSaveScope: nextScope });
    void triggerFeedback();
  };

  const toggleCameraSaveTarget = (target: CameraSaveTarget) => {
    if (target === "cloud" && !canSelectCloudSaveTarget) {
      return;
    }

    const targets = getCameraSaveScopeTargets(cameraSaveScope);
    const nextTargets = {
      ...targets,
      [target]: !targets[target]
    };
    if (!nextTargets.app && !nextTargets.device && !nextTargets.cloud) {
      return;
    }

    const nextScope = createCameraSaveScope(nextTargets);
    setCameraSaveScope(nextScope);
    queueAppSettingsUpdate({
      cameraSaveScope: nextScope,
      ...(target === "cloud" && nextTargets.cloud
        ? { storageMode: "local_backup" as const, cloudBackupEnabled: true }
        : {})
    });
    void triggerFeedback();
  };

  const updateCameraShutterSoundMode = (nextMode: CameraShutterSoundMode) => {
    setCameraShutterSoundMode(nextMode);
    queueAppSettingsUpdate({ cameraShutterSoundMode: nextMode });
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
      const mediaAccessState = await requestMediaLibraryAccess({ fallbackMessage: "사진 가이드를 사용하려면 앨범 접근 권한이 필요합니다.", onMessage: setErrorMessage });
      if (!isMediaLibraryAccessGranted(mediaAccessState)) {
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
    setGuideSettingsOpen(true);
  };

  const openPhotoGuideSettings = () => {
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
    setGuideOffsetFrameWidth(cameraFrame.width);
    setGuideOffsetFrameHeight(cameraFrame.height);
    setIsGuidePositionAdjusting(false);
    setIsGuideShapePointAdjusting(false);
    setSelectedGuideShapePointIndex(null);
    selectedGuideShapePointIndexRef.current = null;
    setGuideSettingsOpen(true);
    queueAppSettingsUpdate({
      guideOffsetX: clampedOffset.x,
      guideOffsetY: clampedOffset.y,
      guideOffsetFrameWidth: cameraFrame.width,
      guideOffsetFrameHeight: cameraFrame.height,
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
    setGuideOffsetFrameWidth(cameraFrame.width);
    setGuideOffsetFrameHeight(cameraFrame.height);
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
    queueAppSettingsUpdate({
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
    queueAppSettingsUpdate({
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

  const openColorControls = () => {
    setActiveCameraControlPanel((current) => (current === "color" ? null : "color"));
    void triggerFeedback();
  };

  const openZoomControls = () => {
    setActiveCameraControlPanel((current) => (current === "zoom" ? null : "zoom"));
    void triggerFeedback();
  };

  const openLightControls = () => {
    setActiveCameraControlPanel((current) => (current === "light" ? null : "light"));
    void triggerFeedback();
  };

  const handleCameraTopBarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setCameraTopBarHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight
    );
  }, []);

  const handleCameraBottomTrayLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setCameraControlsHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight
    );
  }, []);

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

  const isDeviceAlbumPermissionError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("핸드폰 앨범 저장 권한") || message.includes("앨범 저장 권한");
  }, []);

  const showDeviceAlbumPermissionPrompt = useCallback(
    (message: string) => {
      setErrorMessage(message);
      Alert.alert(
        "핸드폰 앨범 저장 권한이 필요합니다.",
        `${message}\n\n설정에서 사진 및 동영상 권한을 허용하거나 클라우드로만 저장하도록 바꿀 수 있습니다.`,
        [
          { text: "나중에", style: "cancel" },
          {
            text: "클라우드로 저장",
            onPress: () => {
              setCameraSaveScope("app");
              queueAppSettingsUpdate({
                cameraSaveScope: "app",
                storageMode: "local_backup",
                cloudBackupEnabled: true
              });
            }
          },
          { text: "설정 열기", onPress: () => void Linking.openSettings() }
        ]
      );
    },
    [queueAppSettingsUpdate]
  );

  const queueCapturedPhotoSave = useCallback(
    ({
      captureInput,
      saveScope,
      backupUser,
      backupSubscription
    }: {
      captureInput: SaveCapturedPhotoInput;
      saveScope: CameraSaveScope;
      backupUser: typeof user;
      backupSubscription: typeof subscription;
    }) => {
      setPendingPhotoSaveCount((count) => count + 1);
      const runSaveJob = async () => {
        let savedPhoto: PhotoItem | null = null;
        let deviceSaveError: unknown = null;
        const targets = getCameraSaveScopeTargets(saveScope);

        try {
          if (targets.app || targets.cloud) {
            savedPhoto = await saveCapturedPhoto(captureInput);
          }
          if (targets.device) {
            try {
              await saveCapturedPhotoToDevice(captureInput, savedPhoto?.uri);
            } catch (deviceError) {
              if (!savedPhoto) throw deviceError;
              deviceSaveError = deviceError;
            }
          }
          if (savedPhoto) {
            setRecentPhoto(savedPhoto);
            if (targets.cloud) {
              try {
                await backupPhotoIfEnabled({
                  user: backupUser,
                  subscription: backupSubscription,
                  photo: savedPhoto
                });
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
          }
          if (deviceSaveError) {
            const message = getUserFacingErrorMessage(
              deviceSaveError,
              "기기 앨범 저장에 실패했습니다. 사진은 앱 보관함에 저장되었습니다."
            );
            if (isDeviceAlbumPermissionError(deviceSaveError)) {
              showDeviceAlbumPermissionPrompt(message);
            } else {
              setErrorMessage(message);
            }
          }
        } finally {
          try {
            await deleteLocalFile(captureInput.uri);
          } catch {
            // 저장 결과와 무관한 임시 파일 정리 실패는 촬영 실패로 표시하지 않습니다.
          }
          setPendingPhotoSaveCount((count) => Math.max(0, count - 1));
        }
      };

      const queuedSave = captureSaveQueueTailRef.current.then(runSaveJob, runSaveJob);
      captureSaveQueueTailRef.current = queuedSave.catch(() => undefined);
      void queuedSave.catch((error) => {
        const message = getUserFacingErrorMessage(error, "사진 저장에 실패했습니다.");
        if (isDeviceAlbumPermissionError(error)) {
          showDeviceAlbumPermissionPrompt(message);
        } else {
          setErrorMessage(message);
        }
      });
    },
    [isDeviceAlbumPermissionError, showDeviceAlbumPermissionPrompt]
  );

  const capturePhoto = async () => {
    if (
      !cameraDevice ||
      !canCaptureWithCurrentSession() ||
      isCapturing ||
      cameraNativeCaptureInProgressRef.current
    ) {
      return;
    }

    let photoUri: string | null = null;

    try {
      cameraNativeCaptureInProgressRef.current = true;
      setIsCapturing(true);
      setErrorMessage(null);
      const photo = await photoOutput.capturePhotoToFile({
        flashMode: cameraDevice.hasFlash ? flashMode : "off",
        enableShutterSound: cameraShutterSoundMode === "sound"
      }, {});
      photoUri = `file://${photo.filePath}`;
      const captureInput = {
        uri: photoUri,
        ratioLabel: cameraRatio,
        colorAdjustment: getCameraColorAdjustmentInput(),
        localImageLimit: planEntitlements.localImageLimit
      };
      setIsCapturing(false);
      cameraNativeCaptureInProgressRef.current = false;
      const captureSaveScope = canSelectCloudSaveTarget
        ? cameraSaveScope
        : createCameraSaveScope({
            ...getCameraSaveScopeTargets(cameraSaveScope),
            cloud: false
          });
      queueCapturedPhotoSave({
        captureInput,
        saveScope: captureSaveScope,
        backupUser: user,
        backupSubscription: subscription
      });
      photoUri = null;
    } catch (error) {
      setErrorMessage(getUserFacingErrorMessage(error, "사진을 촬영하지 못했습니다."));
    } finally {
      cameraNativeCaptureInProgressRef.current = false;
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
    if (!cameraDevice || !canCaptureWithCurrentSession() || isCapturing) {
      return;
    }

    if (shutterTimer <= 0) {
      await capturePhoto();
      return;
    }

    const captureToken = timedCaptureTokenRef.current + 1;
    timedCaptureTokenRef.current = captureToken;
    isTimedCapturePendingRef.current = true;

    try {
      setIsCapturing(true);
      setErrorMessage(null);
      for (let remaining = shutterTimer; remaining > 0; remaining -= 1) {
        if (timedCaptureTokenRef.current !== captureToken || !canCaptureWithCurrentSession()) {
          return;
        }
        setCountdown(remaining);
        await triggerFeedback();
        await sleep(1000);
        if (timedCaptureTokenRef.current !== captureToken || !canCaptureWithCurrentSession()) {
          return;
        }
      }
    } finally {
      if (timedCaptureTokenRef.current === captureToken) {
        isTimedCapturePendingRef.current = false;
      }
      setCountdown(null);
      setIsCapturing(false);
    }

    if (timedCaptureTokenRef.current !== captureToken || !canCaptureWithCurrentSession()) {
      return;
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
    <View style={styles.screen}>
      <View
        style={[styles.cameraPreviewViewport, cameraPreviewViewportStyle]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setCameraPreviewViewport({ width, height });
        }}
      >
        <View
          style={[styles.cameraPreviewFrame, cameraPreviewFrameStyle]}
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
          outputs={cameraOutputs} orientationSource="interface"
          zoom={cameraNativeZoom}
          exposure={cameraNativeExposure}
          getInitialZoom={() => cameraZoomFactor}
          getInitialExposureBias={() => cameraExposureBias}
          onStarted={() => {
            isCameraReadyRef.current = true;
            setIsCameraReady(true);
            if (errorMessage === "카메라 연결이 불안정해 다시 시작합니다.") {
              setErrorMessage(null);
            }
          }}
          onStopped={() => {
            isCameraReadyRef.current = false;
            cancelPendingTimedCapture();
            setIsCameraReady(false);
          }}
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

      <View pointerEvents="none" style={cameraColorOverlayStyle} />
      <View pointerEvents="none" style={cameraTintOverlayStyle} />
      <View pointerEvents="none" style={cameraBrightnessOverlayStyle} />
      <View pointerEvents="none" style={cameraContrastOverlayStyle} />
      <View pointerEvents="none" style={cameraSaturationOverlayStyle} />

      <Animated.View
        pointerEvents="none"
        style={styles.guidePositionLayer}
      >
        <CameraGuideOverlay
          guide={guide}
          visible={guideVisible}
          size={guideSize}
          strokeWidth={guideStrokeWidth}
          color={guideColor}
          offsetX={guide !== "grid" ? guideOffsetX : 0}
          offsetY={guide !== "grid" ? guideOffsetY : 0}
          offsetFrameWidth={guideOffsetFrameWidth}
          offsetFrameHeight={guideOffsetFrameHeight}
          gridLinePositions={gridGuideLinePositions}
          selectedGridLine={selectedGridGuideLine}
          shapePoints={guideShapePoints}
          showShapeControlPoints={isGuideShapePointAdjusting}
          selectedShapePointIndex={selectedGuideShapePointIndex}
          aspectRatio={cameraRatioAspect[cameraRatio] ?? undefined}
          opacity={guideLineOpacity}
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

        </View>
      </View>

      {countdown ? (
        <View style={styles.countdownOverlay}>
          <Text selectable={false} style={styles.countdownText}>
            {countdown}
          </Text>
        </View>
      ) : null}

      {!isGuidePositionAdjusting && !isGridLineControlAdjusting ? (
        <View
          style={[styles.topBar, { paddingTop: insets.top + 12 }]}
          onLayout={handleCameraTopBarLayout}
        >
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
          <View style={styles.cameraInstantControlRow}>
            <Pressable
              style={[
                styles.cameraInstantControlButton,
                isLineGuideActive && styles.cameraInstantControlButtonActive
              ]}
              onPress={openLineGuideSettings}
              accessibilityRole="button"
              accessibilityLabel="라인 가이드 설정 열기"
            >
              <Feather name="crosshair" size={15} color={colors.inverse} />
              <Text selectable={false} style={styles.cameraInstantControlText}>라인</Text>
            </Pressable>
            <Pressable
              style={[
                styles.cameraInstantControlButton,
                isPhotoGuideActive && styles.cameraInstantControlButtonActive
              ]}
              onPress={openPhotoGuideSettings}
              accessibilityRole="button"
              accessibilityLabel="사진 오버레이 열기"
            >
              <Feather name="image" size={15} color={colors.inverse} />
              <Text selectable={false} style={styles.cameraInstantControlText}>오버레이</Text>
            </Pressable>
            <Pressable
              style={[
                styles.cameraInstantControlButton,
                activeCameraControlPanel === "color" && styles.cameraInstantControlButtonActive
              ]}
              onPress={openColorControls}
              accessibilityRole="button"
              accessibilityLabel="색감 설정 열기"
            >
              <Feather name="sliders" size={15} color={colors.inverse} />
              <Text selectable={false} style={styles.cameraInstantControlText}>색감</Text>
            </Pressable>
            <Pressable
              style={[
                styles.cameraInstantControlButton,
                activeCameraControlPanel === "zoom" && styles.cameraInstantControlButtonActive
              ]}
              onPress={openZoomControls}
              accessibilityRole="button"
              accessibilityLabel="확대 설정 열기"
            >
              <Feather name="zoom-in" size={15} color={colors.inverse} />
              <Text selectable={false} style={styles.cameraInstantControlText}>확대</Text>
            </Pressable>
            <Pressable
              style={[
                styles.cameraInstantControlButton,
                (activeCameraControlPanel === "light" || visibleTorchEnabled) &&
                  styles.cameraInstantControlButtonActive
              ]}
              onPress={openLightControls}
              accessibilityRole="button"
              accessibilityLabel="라이트 켜기 끄기"
            >
              <Feather name="zap" size={15} color={colors.inverse} />
              <Text selectable={false} style={styles.cameraInstantControlText}>라이트</Text>
            </Pressable>
            <Pressable
              style={styles.cameraInstantControlButton}
              onPress={openCameraSettingsMenu}
              accessibilityRole="button"
              accessibilityLabel="카메라 설정 열기"
            >
              <Feather name="settings" size={15} color={colors.inverse} />
              <Text selectable={false} style={styles.cameraInstantControlText}>설정</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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
                        accessibilityState={{ selected: cameraFacing === option.value }}
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
                        accessibilityState={{ selected: shutterTimer === option.value }}
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
                        accessibilityState={{ selected: flashMode === option.value }}
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
                    valueLabel={visibleTorchEnabled ? "켜짐" : "꺼짐"}
                    disabled={!cameraLightAvailable}
                    selected={visibleTorchEnabled}
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
                        accessibilityState={{ selected: photoQuality === option.value }}
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
                        accessibilityState={{ selected: cameraRatio === option.value }}
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
                    {CAMERA_SAVE_SCOPE_OPTIONS.map((option) => {
                      const isCloudSaveTargetDisabled =
                        option.value === "cloud" && !canSelectCloudSaveTarget;
                      const isSelected =
                        getCameraSaveScopeTargets(cameraSaveScope)[option.value] &&
                        !isCloudSaveTargetDisabled;

                      return (
                        <Pressable
                          key={option.value}
                          disabled={isCloudSaveTargetDisabled}
                          style={[
                            styles.optionButton,
                            isSelected && styles.optionButtonActive,
                            isCloudSaveTargetDisabled && { opacity: 0.38 }
                          ]}
                          onPress={() => toggleCameraSaveTarget(option.value)}
                          accessibilityState={{ disabled: isCloudSaveTargetDisabled, selected: isSelected }}
                        >
                          <Text
                            selectable={false}
                            style={[
                              styles.optionButtonText,
                              isSelected && styles.optionButtonTextActive
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text selectable={false} style={styles.modalSectionDetail}>
                    선택한 위치에 각각 저장합니다. 클라우드는 로그인 및 백업 설정이 가능한 경우에만 사용됩니다.
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
                    selected={guideVisible}
                    onPress={() => updateGuideVisibility(!guideVisible)}
                  />
                  <CameraSettingToggleRow
                    title="햅틱 피드백"
                    detail="촬영과 주요 조작 시 짧은 진동 피드백을 사용합니다."
                    valueLabel={hapticEnabled ? "켜짐" : "꺼짐"}
                    selected={hapticEnabled}
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
                        accessibilityState={{ selected: guide === type }}
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
                        accessibilityState={{ selected: guideSize === option.value }}
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
                          accessibilityState={{ selected: isActive }}
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
                        accessibilityState={{ selected: guideColor === option.value }}
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
                  accessibilityState={{ selected: guideVisible }}
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
              {activeCameraControlPanel === "color" ? (
                <View
                  pointerEvents="box-none"
                  style={[styles.cameraFloatingPanelWrap, styles.cameraFloatingPanelRaised]}
                >
                  <View style={styles.cameraControlPanelViewport}>
                    <Animated.View
                      key={activeCameraControlPanel}
                      entering={FadeIn.duration(140)}
                      style={styles.cameraControlPage}
                    >
                      <View style={styles.cameraColorPanel}>
                        <View style={styles.cameraColorHeaderRow}>
                          <View style={styles.cameraColorHeader}>
                            <Text selectable={false} style={styles.cameraColorTitle}>색감</Text>
                            <Text selectable={false} style={styles.cameraColorHint}>
                              노출은 카메라에 바로 적용되고 온도/틴트는 화면에서 확인합니다.
                            </Text>
                          </View>
                          <Pressable
                            style={styles.cameraColorCloseButton}
                            onPress={openColorControls}
                            accessibilityRole="button"
                            accessibilityLabel="색감 설정 닫기"
                          >
                            <Feather name="x" size={18} color={colors.text} />
                          </Pressable>
                        </View>
                        <View style={styles.cameraColorSlotRow}>
                          {cameraColorSlots.map((slot, index) => (
                            <Pressable
                              key={`camera-color-slot-${index}`}
                              style={[
                                styles.cameraColorSlotButton,
                                selectedCameraColorSlot === index && styles.cameraColorSlotButtonActive,
                                slot && styles.cameraColorSlotButtonSaved
                              ]}
                              onPress={() => applyCameraColorSlot(slot, index)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: selectedCameraColorSlot === index }}
                              accessibilityLabel={`색감 슬롯 ${index + 1}`}
                            >
                              <Text
                                selectable={false}
                                style={[
                                  styles.cameraColorSlotText,
                                  !slot && styles.cameraColorSlotTextMuted
                                ]}
                              >
                                {index + 1}
                              </Text>
                              {slot ? <View pointerEvents="none" style={styles.cameraColorSlotSavedDot} /> : null}
                            </Pressable>
                          ))}
                        </View>
                        <View style={styles.cameraColorSliderList}>
                          <SmoothValueSlider
                            compact
                            value={cameraExposureBias}
                            min={cameraExposureMin}
                            max={cameraExposureMax}
                            label="노출"
                            formatValue={formatCameraExposureValue}
                            onChange={applyCameraExposureBias}
                            onCommit={applyCameraExposureBias}
                          />
                          <SmoothValueSlider
                            compact
                            value={cameraColorTemperature}
                            min={CAMERA_COLOR_ADJUST_MIN}
                            max={CAMERA_COLOR_ADJUST_MAX}
                            label="온도"
                            formatValue={formatCameraSignedValue}
                            onChange={applyCameraColorTemperature}
                            onCommit={applyCameraColorTemperature}
                          />
                          <SmoothValueSlider
                            compact
                            value={cameraColorTint}
                            min={CAMERA_COLOR_ADJUST_MIN}
                            max={CAMERA_COLOR_ADJUST_MAX}
                            label="틴트"
                            formatValue={formatCameraSignedValue}
                            onChange={applyCameraColorTint}
                            onCommit={applyCameraColorTint}
                          />
                          <SmoothValueSlider
                            compact
                            value={cameraBrightness}
                            min={CAMERA_COLOR_ADJUST_MIN}
                            max={CAMERA_COLOR_ADJUST_MAX}
                            label="밝기"
                            formatValue={formatCameraSignedValue}
                            onChange={applyCameraBrightness}
                            onCommit={applyCameraBrightness}
                          />
                          <SmoothValueSlider
                            compact
                            value={cameraContrast}
                            min={CAMERA_COLOR_ADJUST_MIN}
                            max={CAMERA_COLOR_ADJUST_MAX}
                            label="대비"
                            formatValue={formatCameraSignedValue}
                            onChange={applyCameraContrast}
                            onCommit={applyCameraContrast}
                          />
                          <SmoothValueSlider
                            compact
                            value={cameraSaturation}
                            min={CAMERA_COLOR_ADJUST_MIN}
                            max={CAMERA_COLOR_ADJUST_MAX}
                            label="채도"
                            formatValue={formatCameraSignedValue}
                            onChange={applyCameraSaturation}
                            onCommit={applyCameraSaturation}
                          />
                        </View>
                        <View style={styles.cameraColorActions}>
                          <Pressable style={styles.optionButton} onPress={resetCameraColorSettings}>
                            <Text selectable={false} style={styles.optionButtonText}>초기화</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.optionButton, styles.optionButtonActive]}
                            onPress={saveCameraColorSettings}
                          >
                            <Text
                              selectable={false}
                              style={[styles.optionButtonText, styles.optionButtonTextActive]}
                            >
                              설정 저장
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </Animated.View>
                  </View>
                </View>
              ) : null}

              {activeCameraControlPanel === "zoom" ? (
                <View
                  pointerEvents="box-none"
                  style={[styles.cameraFloatingPanelWrap, styles.cameraFloatingPanelRaised]}
                >
                  <View style={styles.cameraControlPanelViewport}>
                    <Animated.View
                      key={activeCameraControlPanel}
                      entering={FadeIn.duration(140)}
                      style={styles.cameraControlPage}
                    >
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
                    </Animated.View>
                  </View>
                </View>
              ) : null}

              {activeCameraControlPanel === "light" ? (
                <View
                  pointerEvents="box-none"
                  style={[styles.cameraFloatingPanelWrap, styles.cameraFloatingPanelRaised]}
                >
                  <View style={styles.cameraControlPanelViewport}>
                    <Animated.View
                      key={activeCameraControlPanel}
                      entering={FadeIn.duration(140)}
                      style={styles.cameraControlPage}
                    >
                      <View style={styles.quickButtonRow}>
                        <Pressable
                          disabled={!cameraLightAvailable}
                          style={[
                            styles.quickPillButton,
                            !visibleTorchEnabled && styles.quickPillButtonActive,
                            !cameraLightAvailable && styles.shutterDisabled
                          ]}
                          onPress={() => setLightEnabled(false)}
                        >
                          <Text
                            selectable={false}
                            style={[
                              styles.quickPillText,
                              !visibleTorchEnabled && styles.quickPillTextActive
                            ]}
                          >
                            끄기
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={!cameraLightAvailable}
                          style={[
                            styles.quickPillButton,
                            visibleTorchEnabled && styles.quickPillButtonActive,
                            !cameraLightAvailable && styles.shutterDisabled
                          ]}
                          onPress={() => setLightEnabled(true)}
                        >
                          <Text
                            selectable={false}
                            style={[
                              styles.quickPillText,
                              visibleTorchEnabled && styles.quickPillTextActive
                            ]}
                          >
                            켜기
                          </Text>
                        </Pressable>
                      </View>
                    </Animated.View>
                  </View>
                </View>
              ) : null}

              <View
                style={[styles.cameraControlBottomTray, { paddingBottom: bottomSafePadding }]}
                onLayout={handleCameraBottomTrayLayout}
              >
                <View style={styles.captureRow}>
                  <Pressable
                    style={styles.galleryButton}
                    onPress={openPersonalGallery}
                    accessibilityRole="button"
                    accessibilityLabel="개인 갤러리 열기"
                  >{recentPhoto ? (
                      <NativeImage source={{ uri: recentPhoto.uri }} style={styles.galleryThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.galleryEmptyThumb}>
                        <Feather name="image" size={28} color={colors.inverse} />
                      </View>
                    )}
                    {isPhotoSavePending ? (
                      <View pointerEvents="none" style={styles.gallerySavingOverlay}>
                        <ActivityIndicator color={colors.inverse} size="small" />
                        <Text selectable={false} style={styles.gallerySavingText}>저장중</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    android_disableSound
                    disabled={!isCameraReady || isCapturing || !cameraDevice}
                    style={[
                      styles.shutterOuter,
                      (!isCameraReady || isCapturing || !cameraDevice) && styles.shutterDisabled
                    ]}
                    onPress={takePhoto}
                    accessibilityRole="button"
                    accessibilityLabel="사진 촬영"
                    accessibilityState={{
                      disabled: !isCameraReady || isCapturing || !cameraDevice,
                      busy: isCapturing
                    }}
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


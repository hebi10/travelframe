import { Image } from "expo-image";
import { useAudioPlayer } from "expo-audio";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { InterstitialAdModal } from "@/components/interstitial-ad-modal";
import { TripClipRecordingCanvas } from "@/components/trip-clip-recording-canvas";
import { TripClipPreviewPlayer } from "@/components/trip-clip-preview-player";
import { colors, spacing } from "@/constants/app-theme";
import {
  GUIDE_LABELS,
  GUIDE_TYPES,
  type GuideType
} from "@/constants/camera-guides";
import {
  type TripClipRatio,
  type TripClipTemplate,
  type TripClipTransition
} from "@/constants/trip-clip";
import {
  DEFAULT_VIDEO_QUALITY,
  MAX_VIDEO_DURATION_SECONDS,
  VIDEO_DURATION_LIMIT_MESSAGE,
  VIDEO_EXPORT_BLOCKED_MESSAGE,
  VIDEO_QUALITY_DESCRIPTION,
  VIDEO_QUALITY_OPTIONS,
  type VideoQualityId
} from "@/constants/video";
import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality
} from "@/constants/image";
import {
  type ImageSaveFormat,
  saveImageToLibrary,
  saveVideoToLibrary,
  shareImage,
  shareVideo
} from "@/lib/trip-clip-export";
import {
  clearTripClipDraft,
  getTripClipDraft,
  hasTripClipDraftContent,
  saveTripClipDraft,
  type TripClipDraft
} from "@/lib/trip-clip-draft";
import { getNextTripClipTitle } from "@/lib/trip-clip-title";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  defaultGridGuideLinePositions,
  defaultGuideShapePoints,
  getAppSettings,
  getGuideSizeBounds,
  isCloudBackupTargetEnabled,
  updateAppSettings,
  type GridGuideLinePositions,
  type GuideShapePoints
} from "@/lib/app-settings";
import {
  ensurePhotoPreviews,
  getPhotos,
  saveCapturedPhoto
} from "@/lib/photo-library";
import { resolveImageDimensions } from "@/lib/image-backup-utils";
import { deselectTripClipPhoto } from "@/lib/trip-clip-selection";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import {
  getMadeVideoById,
  getMadeVideos,
  saveMadeVideo,
  updateMadeVideo
} from "@/lib/video-library";
import {
  calculateVideoDuration,
  formatVideoDuration,
  getVideoQualityOption,
  getVideoQualityOutputSize,
  isVideoDurationTooLong
} from "@/lib/video-utils";
import {
  DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT,
  getTripClipPhotoAdjustment,
  setTripClipPhotoAdjustment,
  type TripClipPhotoAdjustment,
  type TripClipPhotoAdjustmentMap
} from "@/lib/trip-clip-photo-adjustment";
import {
  getImageBundleWorkById,
  getImageBundleWorks,
  saveImageBundleWork,
  updateImageBundleWork
} from "@/lib/work-library";
import { useAuth } from "@/lib/auth-context";
import { recordBackupFailure } from "@/lib/backup-failure-queue";
import {
  isRecordingViewAvailable,
  OptionalRecordingView,
  useOptionalViewRecorder
} from "@/lib/view-recorder";
import {
  backupPhotoIfEnabled,
  backupImageBundleWork,
  backupMadeVideo,
  subscribeCloudBackupOverview,
  type CloudBackupOverview
} from "@/lib/cloud-backup";
import {
  canBackupMoreVideos,
  getCloudBackupVideoLimit,
  getRemainingBackupSlots
} from "@/lib/cloud-backup-limits";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { isMediaLibraryAccessGranted } from "@/lib/media-library-permissions";
import { requestMediaLibraryAccess } from "@/lib/request-media-library-access";
import {
  completeWeeklyVideoExport,
  flushPendingWeeklyVideoExportCompletions,
  getWeeklyVideoExportUsage,
  recordPendingWeeklyVideoExportCompletion,
  releaseWeeklyVideoExport,
  reserveWeeklyVideoExport,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import {
  pickAndUploadUserMusicTrack,
  restoreUserMusicTrackIfNeeded,
  syncUserMusicTracks,
  type UserMusicTrack
} from "@/lib/user-music";
import {
  DEFAULT_TRIP_CLIP_FRAME_DURATION as DEFAULT_DURATION,
  getDefaultFrameDuration,
} from "@/lib/trip-clip-playback";
import type { PhotoItem } from "@/types/photo";
import { RECORDING_VIEW_WIDTH } from "@/features/trip-clip/trip-clip-screen.constants";
import { getImageSaveFormatLabel, useTimelineDurationEditing } from "@/features/trip-clip/trip-clip-screen.helpers";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";
import { TripClipExportTab } from "@/features/trip-clip/components/TripClipExportTab";
import { TripClipGuideTab } from "@/features/trip-clip/components/TripClipGuideTab";
import { TripClipHeader } from "@/features/trip-clip/components/TripClipHeader";
import { TripClipMusicTab } from "@/features/trip-clip/components/TripClipMusicTab";
import { TripClipPhotoTab } from "@/features/trip-clip/components/TripClipPhotoTab";
import { TripClipPreview } from "@/features/trip-clip/components/TripClipPreview";
import { TripClipTimelineTab } from "@/features/trip-clip/components/TripClipTimelineTab";
import { TripClipVideoTab } from "@/features/trip-clip/components/TripClipVideoTab";
import { useTripClipDraft } from "@/features/trip-clip/hooks/useTripClipDraft";
import { initialExportProgress, type ExportFormat, type ExportProgress, type SaveSelectedExportOptions } from "@/features/trip-clip/hooks/useTripClipExport";
import { useTripClipGuide } from "@/features/trip-clip/hooks/useTripClipGuide";
import { useTripClipMusic, type MusicMode } from "@/features/trip-clip/hooks/useTripClipMusic";
import { useTripClipPhotos } from "@/features/trip-clip/hooks/useTripClipPhotos";
import { useTripClipPlayback } from "@/features/trip-clip/hooks/useTripClipPlayback";

const initialBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};
const FADE_OPTIONS = [
  { label: "짧게", value: 0.25 },
  { label: "기본", value: 0.45 },
  { label: "길게", value: 0.75 }
] as const;

type EditorTab = "photos" | "timeline" | "video" | "guide" | "music" | "export";

const EXPORT_FORMAT_OPTIONS: {
  label: string;
  value: ExportFormat;
  detail: string;
}[] = [
  {
    label: "MP4 영상",
    value: "mp4",
    detail: "사진, 전환 효과, 음악을 영상으로 저장합니다."
  },
  {
    label: "이미지 저장",
    value: "images",
    detail: "선택한 사진을 각각 개별 이미지로 저장합니다."
  }
];

const GUIDE_SIZE_OPTIONS = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;
const GUIDE_STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 5] as const;
const GUIDE_COLOR_OPTIONS = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

const EDITOR_TABS: { label: string; value: EditorTab }[] = [
  { label: "사진", value: "photos" },
  { label: "타임라인", value: "timeline" },
  { label: "영상", value: "video" },
  { label: "가이드", value: "guide" },
  { label: "음악", value: "music" },
  { label: "내보내기", value: "export" }
];

const VIEW_RECORDER_FPS = 24;
const TRIP_CLIP_DRAFT_AUTOSAVE_MS = 60000;
const ANDROID_DURATION_KEYBOARD_FALLBACK_HEIGHT = 320;
const DURATION_KEYBOARD_PANEL_GAP = 8;

const ratioAspect: Record<TripClipRatio, number> = {
  "9:16": 9 / 16,
  "4:5": 4 / 5,
  "1:1": 1,
  "16:9": 16 / 9,
  "3:4": 3 / 4
};

const getPhotoLabel = (photo: PhotoItem) =>
  photo.kind === "edited" ? "편집 사진" : "원본 사진";

const getPreviewUri = (photo: PhotoItem) => photo.previewUri ?? photo.uri;

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

const formatDraftTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

export default function TripClipScreen() {
  const { bundleId, videoId, returnTo, start } = useLocalSearchParams<{
    bundleId?: string;
    videoId?: string;
    returnTo?: string | string[];
    start?: string | string[];
  }>();
  const returnToParam = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const startParam = Array.isArray(start) ? start[0] : start;
  const backTarget = returnToParam ?? "/studio?tab=videos";
  const shouldStartFreshProject = startParam === "new";
  const isEditingMadeVideo = Boolean(videoId);
  const recorder = useOptionalViewRecorder();
  const { user, isLoggedIn, isAuthLoading, subscription } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 12, 28);
  const modalSafeStyle = useMemo(
    () => ({
      paddingTop: Math.max(insets.top + 18, 24),
      paddingBottom: Math.max(insets.bottom + 18, 24)
    }),
    [insets.bottom, insets.top]
  );
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [durationKeyboardHeight, setDurationKeyboardHeight] = useState(0);
  const [photoAdjustments, setPhotoAdjustments] =
    useState<TripClipPhotoAdjustmentMap>({});
  const [ratio, setRatio] = useState<TripClipRatio>("9:16");
  const [videoQuality, setVideoQuality] =
    useState<VideoQualityId>(DEFAULT_VIDEO_QUALITY);
  const [imageQuality, setImageQuality] =
    useState<ImageQuality>(DEFAULT_IMAGE_QUALITY);
  const [template, setTemplate] = useState<TripClipTemplate>("minimal");
  const [transition, setTransition] = useState<TripClipTransition>("fade");
  const [transitionDuration, setTransitionDuration] = useState(0.45);
  const [musicMode, setMusicMode] = useState<MusicMode>("none");
  const [userMusicTracks, setUserMusicTracks] = useState<UserMusicTrack[]>([]);
  const [isMusicSubmitting, setIsMusicSubmitting] = useState(false);
  const [selectedUserMusicId, setSelectedUserMusicId] = useState<string | null>(null);
  const [volume] = useState(0.7);
  const [previewAdjustEnabled, setPreviewAdjustEnabled] = useState(false);
  const [isFrameFitModalVisible, setIsFrameFitModalVisible] = useState(false);
  const [previewGuideVisible, setPreviewGuideVisible] = useState(false);
  const [previewGuide, setPreviewGuide] = useState<GuideType>("circle");
  const [previewGuideSize, setPreviewGuideSize] = useState(44);
  const [previewGuideSizeInput, setPreviewGuideSizeInput] = useState("44");
  const [previewGuideStrokeWidth, setPreviewGuideStrokeWidth] = useState(1);
  const [previewGuideColor, setPreviewGuideColor] = useState<string>(
    GUIDE_COLOR_OPTIONS[0].value
  );
  const [previewGuideLineOpacity, setPreviewGuideLineOpacity] = useState(
    defaultAppSettings.guideLineOpacity
  );
  const [previewGuideOffsetX, setPreviewGuideOffsetX] = useState(0);
  const [previewGuideOffsetY, setPreviewGuideOffsetY] = useState(0);
  const [previewGuideOffsetFrameWidth, setPreviewGuideOffsetFrameWidth] = useState(0);
  const [previewGuideOffsetFrameHeight, setPreviewGuideOffsetFrameHeight] = useState(0);
  const [previewGridGuideLinePositions, setPreviewGridGuideLinePositions] =
    useState<GridGuideLinePositions>(defaultGridGuideLinePositions);
  const [previewGuideShapePoints, setPreviewGuideShapePoints] =
    useState<GuideShapePoints>(defaultGuideShapePoints);
  const { previewGuideSizeBounds } = useTripClipGuide(previewGuide);
  const [isPreviewGuideMoving, setIsPreviewGuideMoving] = useState(false);
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: 0, height: 0 });
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>("photos");
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setIsMusicPreviewing] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
  const [imageSaveFormat, setImageSaveFormat] =
    useState<ImageSaveFormat>("original");
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [videoBackupTargetEnabled, setVideoBackupTargetEnabled] = useState(true);
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(initialBackupOverview);
  const [shouldBackupVideoExport, setShouldBackupVideoExport] = useState(true);
  const [workTitle, setWorkTitle] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [renderedVideoUri, setRenderedVideoUri] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] = useState<TripClipDraft | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [weeklyVideoExportUsage, setWeeklyVideoExportUsage] =
    useState<WeeklyVideoExportUsage | null>(null);
  const [exportProgress, setExportProgress] =
    useState<ExportProgress>(initialExportProgress);
  const [isExportComingSoonVisible, setIsExportComingSoonVisible] = useState(false);
  const [isPostSaveAdVisible, setIsPostSaveAdVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [recordingFrameIndex, setRecordingFrameIndex] = useState(0);
  const [recordingViewAvailable] = useState(isRecordingViewAvailable);
  const restoredVideoIdRef = useRef<string | null>(null);
  const restoredBundleIdRef = useRef<string | null>(null);
  const suppressAutoVideoSelectionRef = useRef(false);
  const autoDurationIdsRef = useRef<Set<string>>(new Set());
  const playbackOffsetRef = useRef(0);
  const playbackProgress = useSharedValue(0);
  const previewGuideOffsetXValue = useSharedValue(0);
  const previewGuideOffsetYValue = useSharedValue(0);
  const previewGuideDragStartX = useSharedValue(0);
  const previewGuideDragStartY = useSharedValue(0);

  const { selectedUserMusic, customMusic, activeMusicSource, activeMusicLabel } =
    useTripClipMusic({
      musicMode,
      userMusicTracks,
      selectedUserMusicId
    });
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const weeklyVideoExportLimit = planEntitlements.weeklyVideoExportLimit;
  const canUseVideoCreation = planEntitlements.canExportVideo;
  const premiumExportActive = planEntitlements.canUseAdvancedOutput;
  const videoBackupLimit = getCloudBackupVideoLimit(planEntitlements.tier);
  const videoBackupRemaining = getRemainingBackupSlots(
    backupOverview.videoCount,
    videoBackupLimit
  );
  const canBackupVideoExport =
    videoBackupTargetEnabled &&
    cloudBackupEnabled &&
    Boolean(user) &&
    planEntitlements.canBackupToCloud &&
    canBackupMoreVideos(backupOverview.videoCount, planEntitlements.tier);
  const player = useAudioPlayer(activeMusicSource);
  const loginRequiredVideoAlertShownRef = useRef(false);

  const { selectedPhotos, activePhoto, getFrameDuration } = useTripClipPhotos({
    photos,
    selectedIds,
    durations,
    activeIndex
  });
  const timelineDurationEditing = useTimelineDurationEditing({ autoDurationIdsRef, durations, getDefaultFrameDuration, getFrameDuration, setDurations });
  const totalDuration = calculateVideoDuration(selectedIds, getFrameDuration);
  const videoDurationTooLong = isVideoDurationTooLong(totalDuration);
  const selectedVideoQuality = getVideoQualityOption(videoQuality);
  const durationKeyboardPanelBottom = useMemo(() => {
    const measuredKeyboardOffset =
      durationKeyboardHeight > 0
        ? durationKeyboardHeight + DURATION_KEYBOARD_PANEL_GAP
        : 0;
    const androidKeyboardOffset =
      Math.max(durationKeyboardHeight, ANDROID_DURATION_KEYBOARD_FALLBACK_HEIGHT) +
      DURATION_KEYBOARD_PANEL_GAP;
    const keyboardOffset =
      Platform.OS === "android" ? androidKeyboardOffset : measuredKeyboardOffset;

    return Math.max(bottomSafePadding, keyboardOffset);
  }, [bottomSafePadding, durationKeyboardHeight]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      setDurationKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setDurationKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const updatePhotoAdjustment = useCallback(
    (photoId: string, adjustment: TripClipPhotoAdjustment) => {
      setPhotoAdjustments((current) =>
        setTripClipPhotoAdjustment(current, photoId, adjustment)
      );
    },
    []
  );
  const resetActivePhotoAdjustment = useCallback(() => {
    if (!activePhoto) {
      return;
    }

    setPhotoAdjustments((current) =>
      setTripClipPhotoAdjustment(current, activePhoto.id, DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT)
    );
  }, [activePhoto]);
  const frameFitPreviewProps = useMemo(
    () =>
      activePhoto
        ? {
            photo: activePhoto,
            template,
            transition,
            transitionDuration,
            frameAspectRatio: ratioAspect[ratio],
            guideVisible: previewGuideVisible,
            guide: previewGuide,
            guideSize: previewGuideSize,
            guideStrokeWidth: previewGuideStrokeWidth,
            guideColor: previewGuideColor,
            guideLineOpacity: previewGuideLineOpacity,
            guideOffsetX: previewGuideOffsetX,
            guideOffsetY: previewGuideOffsetY,
            guideOffsetFrameWidth: previewGuideOffsetFrameWidth,
            guideOffsetFrameHeight: previewGuideOffsetFrameHeight,
            gridGuideLinePositions: previewGridGuideLinePositions,
            guideShapePoints: previewGuideShapePoints,
            photoAdjustments,
            onPhotoAdjustmentChange: updatePhotoAdjustment
          }
        : null,
    [
      activePhoto,
      photoAdjustments,
      previewGridGuideLinePositions,
      previewGuide,
      previewGuideColor,
      previewGuideLineOpacity,
      previewGuideOffsetFrameHeight,
      previewGuideOffsetFrameWidth,
      previewGuideOffsetX,
      previewGuideOffsetY,
      previewGuideShapePoints,
      previewGuideSize,
      previewGuideStrokeWidth,
      previewGuideVisible,
      ratio,
      template,
      transition,
      transitionDuration,
      updatePhotoAdjustment
    ]
  );
  const resetNewTripClipProject = useCallback(() => {
    suppressAutoVideoSelectionRef.current = true;
    autoDurationIdsRef.current.clear();
    playbackOffsetRef.current = 0;
    cancelAnimation(playbackProgress);
    playbackProgress.value = 0;
    player.pause();
    setSelectedIds([]);
    setDurations({});
    setPhotoAdjustments({});
    setPreviewAdjustEnabled(false);
    setIsFrameFitModalVisible(false);
    setIsPreviewGuideMoving(false);
    setActiveEditorTab("photos");
    setWorkTitle("");
    setRenderedVideoUri(null);
    setProgressSeconds(0);
    setActiveIndex(0);
    setIsPlaying(false);
    setIsMusicPreviewing(false);
  }, [playbackProgress, player]);
  const createTripClipDraftPayload = useCallback(
    (): Omit<TripClipDraft, "updatedAt"> => ({
      selectedIds,
      durations,
      photoAdjustments,
      ratio,
      videoQuality,
      imageQuality,
      template,
      transition,
      transitionDuration,
      musicMode,
      selectedUserMusicId,
      previewAdjustEnabled,
      previewGuideVisible,
      previewGuide,
      previewGuideSize,
      previewGuideStrokeWidth,
      previewGuideColor,
      previewGuideLineOpacity,
      previewGuideOffsetX,
      previewGuideOffsetY,
      activeEditorTab,
      exportFormat,
      imageSaveFormat,
      shouldBackupVideoExport,
      workTitle
    }),
    [
      activeEditorTab,
      durations,
      exportFormat,
      imageQuality,
      imageSaveFormat,
      musicMode,
      photoAdjustments,
      previewAdjustEnabled,
      previewGuide,
      previewGuideColor,
      previewGuideLineOpacity,
      previewGuideOffsetX,
      previewGuideOffsetY,
      previewGuideSize,
      previewGuideStrokeWidth,
      previewGuideVisible,
      ratio,
      selectedIds,
      selectedUserMusicId,
      shouldBackupVideoExport,
      template,
      transition,
      transitionDuration,
      videoQuality,
      workTitle
    ]
  );
  const { latestTripClipDraftRef } = useTripClipDraft(createTripClipDraftPayload);

  const persistTripClipDraft = useCallback(
    async (showMessage = false) => {
      if (isLoading || isExporting || bundleId || videoId) {
        return;
      }

      const draft = latestTripClipDraftRef.current;
      if (!draft) {
        return;
      }

      if (!hasTripClipDraftContent(draft)) {
        if (showMessage) {
          setExportMessage("임시 저장할 영상 만들기 작업이 없습니다.");
        }
        return;
      }

      try {
        const savedDraft = await saveTripClipDraft(draft);
        setAvailableDraft(savedDraft);
        setShowDraftPrompt(false);
        if (showMessage) {
          setExportMessage("임시 저장했습니다.");
        }
      } catch (error) {
        if (showMessage) {
          setExportMessage(
            getUserFacingErrorMessage(error, "임시 저장하지 못했습니다.")
          );
        }
      }
    },
    [
      bundleId,
      isExporting,
      isLoading,
      videoId
    ]
  );

  const handleBackPress = useCallback(() => {
    router.replace(backTarget as Href);
  }, [backTarget]);

  const showLoginRequiredForVideoCreation = useCallback(() => {
    setExportMessage("동영상 만들기는 로그인 후 주 1회 무료로 사용할 수 있습니다.");
    setExportProgress({
      visible: true,
      percent: 100,
      title: "로그인이 필요합니다",
      detail: "무료 로그인 사용자는 MP4 영상을 주 1회 만들 수 있습니다.",
      error: "마이페이지에서 로그인한 뒤 다시 시도해 주세요."
    });
  }, []);

  useEffect(() => {
    if (isAuthLoading || canUseVideoCreation || loginRequiredVideoAlertShownRef.current) {
      return;
    }

    loginRequiredVideoAlertShownRef.current = true;
    Alert.alert(
      "로그인이 필요합니다",
      "동영상 만들기는 로그인 후 주 1회 무료로 사용할 수 있습니다.",
      [{ text: "확인", onPress: () => router.replace("/account" as Href) }]
    );
    router.replace("/account" as Href);
  }, [canUseVideoCreation, isAuthLoading]);

  const handleHeaderSavePress = () => {
    if (isEditingMadeVideo) {
      void saveSelectedExport({ returnToVideoWorks: true });
      return;
    }

    void persistTripClipDraft(true);
  };

  const resumeTripClipDraft = useCallback(() => {
    if (!availableDraft) {
      return;
    }

    const availablePhotoIds = new Set(photos.map((photo) => photo.id));
    const nextSelectedIds = availableDraft.selectedIds.filter((id) =>
      availablePhotoIds.has(id)
    );

    autoDurationIdsRef.current.clear();
    setSelectedIds(nextSelectedIds);
    setDurations(availableDraft.durations);
    setPhotoAdjustments(availableDraft.photoAdjustments ?? {});
    setRatio(availableDraft.ratio);
    setVideoQuality(availableDraft.videoQuality);
    setImageQuality(availableDraft.imageQuality);
    setTemplate(availableDraft.template);
    setTransition(availableDraft.transition);
    setTransitionDuration(availableDraft.transitionDuration);
    setMusicMode(availableDraft.musicMode);
    setSelectedUserMusicId(availableDraft.selectedUserMusicId);
    setPreviewAdjustEnabled(availableDraft.previewAdjustEnabled);
    setPreviewGuideVisible(availableDraft.previewGuideVisible);
    setPreviewGuide(availableDraft.previewGuide);
    setPreviewGuideSize(availableDraft.previewGuideSize);
    setPreviewGuideSizeInput(String(availableDraft.previewGuideSize));
    setPreviewGuideStrokeWidth(availableDraft.previewGuideStrokeWidth);
    setPreviewGuideColor(availableDraft.previewGuideColor);
    setPreviewGuideLineOpacity(availableDraft.previewGuideLineOpacity);
    setPreviewGuideOffsetX(availableDraft.previewGuideOffsetX);
    setPreviewGuideOffsetY(availableDraft.previewGuideOffsetY);
    previewGuideOffsetXValue.value = availableDraft.previewGuideOffsetX;
    previewGuideOffsetYValue.value = availableDraft.previewGuideOffsetY;
    setExportFormat(availableDraft.exportFormat);
    setImageSaveFormat(availableDraft.imageSaveFormat);
    setShouldBackupVideoExport(availableDraft.shouldBackupVideoExport);
    setWorkTitle(availableDraft.workTitle);
    setActiveEditorTab(
      nextSelectedIds.length > 0 ? availableDraft.activeEditorTab : "photos"
    );
    setActiveIndex(0);
    setProgressSeconds(0);
    setRenderedVideoUri(null);
    setShowDraftPrompt(false);
    setExportMessage("임시 저장된 영상 만들기 작업을 불러왔습니다.");
  }, [
    availableDraft,
    photos,
    previewGuideOffsetXValue,
    previewGuideOffsetYValue
  ]);
  const removeTripClipDraft = useCallback(async () => {
    try {
      await clearTripClipDraft();
      setAvailableDraft(null);
      setShowDraftPrompt(false);
      setExportMessage("임시 저장을 삭제했습니다.");
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "임시 저장을 삭제하지 못했습니다."));
    }
  }, []);
  const { recordingFrame, getStartTimeForIndex, getPlaybackPosition } = useTripClipPlayback({
    frameIndex: recordingFrameIndex,
    fps: VIEW_RECORDER_FPS,
    selectedPhotos,
    selectedIds,
    durations,
    transition,
    transitionDuration,
    totalDuration,
    getFrameDuration
  });

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        storedPhotos,
        settings,
        storedMusicTracks,
        storedWeeklyUsage,
        storedVideos,
        storedImageBundles
      ] = await Promise.all([
        getPhotos().then(ensurePhotoPreviews),
        getAppSettings(),
        user ? syncUserMusicTracks(user) : Promise.resolve([]),
        user
          ? flushPendingWeeklyVideoExportCompletions(user, weeklyVideoExportLimit)
              .then(
                (flushedUsage) =>
                  flushedUsage ?? getWeeklyVideoExportUsage(user, weeklyVideoExportLimit)
              )
              .catch(() => getWeeklyVideoExportUsage(user, weeklyVideoExportLimit))
          : getWeeklyVideoExportUsage(user, weeklyVideoExportLimit),
        getMadeVideos(),
        getImageBundleWorks()
      ]);
      setPhotos(storedPhotos);
      setUserMusicTracks(storedMusicTracks);
      setWeeklyVideoExportUsage(storedWeeklyUsage);
      setSelectedUserMusicId((current) => {
        if (current && storedMusicTracks.some((track) => track.id === current)) {
          return current;
        }

        return storedMusicTracks[0]?.id ?? null;
      });
      if (storedMusicTracks.length === 0) {
        setMusicMode("none");
      }
      setPreviewGuide(settings.defaultGuide);
      setPreviewGuideVisible(settings.guideVisible);
      setPreviewGuideSize(settings.guideSize);
      setPreviewGuideSizeInput(String(settings.guideSize));
      setPreviewGuideStrokeWidth(settings.guideStrokeWidth);
      setPreviewGuideColor(settings.guideColor);
      setPreviewGuideLineOpacity(settings.guideLineOpacity);
      setPreviewGuideOffsetX(settings.guideOffsetX);
      setPreviewGuideOffsetY(settings.guideOffsetY);
      setPreviewGuideOffsetFrameWidth(settings.guideOffsetFrameWidth);
      setPreviewGuideOffsetFrameHeight(settings.guideOffsetFrameHeight);
      setPreviewGridGuideLinePositions(settings.gridGuideLinePositions);
      setPreviewGuideShapePoints(settings.guideShapePoints);
      previewGuideOffsetXValue.value = settings.guideOffsetX;
      previewGuideOffsetYValue.value = settings.guideOffsetY;
      setCloudBackupEnabled(settings.cloudBackupEnabled);
      setVideoBackupTargetEnabled(isCloudBackupTargetEnabled(settings, "videos"));
      setImageQuality(settings.imageBackupQuality);
      setVideoQuality(settings.videoQuality);
      setExportFormat(settings.tripClipExportFormat);
      setImageSaveFormat(settings.imageSaveFormat);

      if (videoId && restoredVideoIdRef.current !== videoId) {
        const storedVideo = await getMadeVideoById(videoId);
        if (storedVideo) {
          const availableIds = storedVideo.photoIds.filter((id) =>
            storedPhotos.some((photo) => photo.id === id)
          );
          setSelectedIds(availableIds);
          setDurations(storedVideo.durations);
          setRatio(storedVideo.ratio);
          setTemplate(storedVideo.template);
          setTransition(storedVideo.transition);
          setTransitionDuration(storedVideo.transitionDuration);
          setExportFormat("mp4");
          setWorkTitle(storedVideo.title);
          restoredVideoIdRef.current = videoId;
          return;
        }
      }

      if (bundleId && restoredBundleIdRef.current !== bundleId) {
        const storedBundle = await getImageBundleWorkById(bundleId);
        if (storedBundle) {
          const availableIds = storedBundle.photoIds.filter((id) =>
            storedPhotos.some((photo) => photo.id === id)
          );
          setSelectedIds(availableIds);
          setRatio(storedBundle.ratio);
          setExportFormat("images");
          setWorkTitle(storedBundle.title);
          restoredBundleIdRef.current = bundleId;
          return;
        }
      }

      const nextWorkTitle = getNextTripClipTitle([
        ...storedVideos.map((video) => video.title),
        ...storedImageBundles.map((bundle) => bundle.title)
      ]);
      setWorkTitle((current) => current.trim() ? current : nextWorkTitle);
      setRatio(settings.defaultRatio);
      const shouldSuppressAutoVideoSelection = suppressAutoVideoSelectionRef.current;
      suppressAutoVideoSelectionRef.current = false;
      setSelectedIds((current) => {
        if (shouldSuppressAutoVideoSelection) {
          return [];
        }

        if (current.length > 0) {
          return current.filter((id) => storedPhotos.some((photo) => photo.id === id));
        }

        return storedPhotos
          .filter((photo) => photo.addedToVideo)
          .map((photo) => photo.id);
      });
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "사진을 불러오지 못했습니다."));
    } finally {
      setIsLoading(false);
    }
  }, [
    bundleId,
    previewGuideOffsetXValue,
    previewGuideOffsetYValue,
    user,
    videoId,
    weeklyVideoExportLimit
  ]);

  const applyPreviewGuideSize = useCallback((value: number) => {
    const nextSize = Math.round(
      Math.max(
        previewGuideSizeBounds.min,
        Math.min(previewGuideSizeBounds.max, value)
      )
    );
    setPreviewGuideSize(nextSize);
    setPreviewGuideSizeInput(String(nextSize));
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideSize: nextSize,
      guideVisible: true
    });
  }, [previewGuideSizeBounds.max, previewGuideSizeBounds.min]);

  const updatePreviewGuideType = (nextGuide: GuideType) => {
    const nextGuideSizeBounds = getGuideSizeBounds(nextGuide);
    const nextGuideSize = Math.round(
      Math.max(
        nextGuideSizeBounds.min,
        Math.min(nextGuideSizeBounds.max, previewGuideSize)
      )
    );
    setPreviewGuide(nextGuide);
    if (nextGuideSize !== previewGuideSize) {
      setPreviewGuideSize(nextGuideSize);
      setPreviewGuideSizeInput(String(nextGuideSize));
    }
    setPreviewGuideVisible(true);
    void updateAppSettings({
      defaultGuide: nextGuide,
      guideSize: nextGuideSize,
      guideVisible: true
    });
  };

  const updatePreviewGuideVisibility = (nextVisible: boolean) => {
    setPreviewGuideVisible(nextVisible);
    void updateAppSettings({ guideVisible: nextVisible });
  };

  const updatePreviewGuideStrokeWidth = (nextStrokeWidth: number) => {
    const clampedStrokeWidth = Math.round(
      Math.max(
        GUIDE_STROKE_WIDTH_MIN,
        Math.min(GUIDE_STROKE_WIDTH_MAX, nextStrokeWidth)
      )
    );
    setPreviewGuideStrokeWidth(clampedStrokeWidth);
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideStrokeWidth: clampedStrokeWidth,
      guideVisible: true
    });
  };

  const updatePreviewGuideColor = (nextColor: string) => {
    setPreviewGuideColor(nextColor);
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideColor: nextColor,
      guideVisible: true
    });
  };

  const getClampedPreviewGuideOffset = useCallback(
    (nextX: number, nextY: number) => {
      const maxX = Math.max(0, previewFrameSize.width * 0.42);
      const maxY = Math.max(0, previewFrameSize.height * 0.42);

      return {
        x: Math.round(Math.max(-maxX, Math.min(maxX, nextX))),
        y: Math.round(Math.max(-maxY, Math.min(maxY, nextY)))
      };
    },
    [previewFrameSize.height, previewFrameSize.width]
  );

  const syncPreviewGuideOffsetFromGesture = useCallback(
    (nextX: number, nextY: number) => {
      const clampedOffset = getClampedPreviewGuideOffset(nextX, nextY);
      setPreviewGuideOffsetX(clampedOffset.x);
      setPreviewGuideOffsetY(clampedOffset.y);
    },
    [getClampedPreviewGuideOffset]
  );

  const finishPreviewGuideMove = useCallback(
    (nextX: number, nextY: number) => {
      const clampedOffset = getClampedPreviewGuideOffset(nextX, nextY);
      previewGuideOffsetXValue.value = clampedOffset.x;
      previewGuideOffsetYValue.value = clampedOffset.y;
      setPreviewGuideOffsetX(clampedOffset.x);
      setPreviewGuideOffsetY(clampedOffset.y);
      setPreviewGuideOffsetFrameWidth(previewFrameSize.width);
      setPreviewGuideOffsetFrameHeight(previewFrameSize.height);
      void updateAppSettings({
        guideOffsetX: clampedOffset.x,
        guideOffsetY: clampedOffset.y,
        guideOffsetFrameWidth: previewFrameSize.width,
        guideOffsetFrameHeight: previewFrameSize.height,
        guideVisible: true
      });
    },
    [
      getClampedPreviewGuideOffset,
      previewFrameSize.height,
      previewFrameSize.width,
      previewGuideOffsetXValue,
      previewGuideOffsetYValue
    ]
  );

  const startPreviewGuideMove = () => {
    setPreviewGuideVisible(true);
    setPreviewAdjustEnabled(false);
    previewGuideOffsetXValue.value = previewGuideOffsetX;
    previewGuideOffsetYValue.value = previewGuideOffsetY;
    setIsPreviewGuideMoving(true);
    void updateAppSettings({ guideVisible: true });
  };

  const stopPreviewGuideMove = () => {
    finishPreviewGuideMove(
      previewGuideOffsetXValue.value,
      previewGuideOffsetYValue.value
    );
    setIsPreviewGuideMoving(false);
  };

  const resetPreviewGuidePositionToCenter = () => {
    previewGuideOffsetXValue.value = 0;
    previewGuideOffsetYValue.value = 0;
    setPreviewGuideOffsetX(0);
    setPreviewGuideOffsetY(0);
    setPreviewGuideOffsetFrameWidth(previewFrameSize.width);
    setPreviewGuideOffsetFrameHeight(previewFrameSize.height);
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideOffsetX: 0,
      guideOffsetY: 0,
      guideOffsetFrameWidth: previewFrameSize.width,
      guideOffsetFrameHeight: previewFrameSize.height,
      guideVisible: true
    });
  };

  const previewGuideMoveGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isPreviewGuideMoving)
        .onStart(() => {
          previewGuideDragStartX.value = previewGuideOffsetXValue.value;
          previewGuideDragStartY.value = previewGuideOffsetYValue.value;
        })
        .onUpdate((event) => {
          const maxX = Math.max(0, previewFrameSize.width * 0.42);
          const maxY = Math.max(0, previewFrameSize.height * 0.42);
          const nextX = Math.max(
            -maxX,
            Math.min(maxX, previewGuideDragStartX.value + event.translationX)
          );
          const nextY = Math.max(
            -maxY,
            Math.min(maxY, previewGuideDragStartY.value + event.translationY)
          );
          previewGuideOffsetXValue.value = nextX;
          previewGuideOffsetYValue.value = nextY;
          runOnJS(syncPreviewGuideOffsetFromGesture)(nextX, nextY);
        })
        .onEnd(() => {
          runOnJS(finishPreviewGuideMove)(
            previewGuideOffsetXValue.value,
            previewGuideOffsetYValue.value
          );
        }),
    [
      finishPreviewGuideMove,
      isPreviewGuideMoving,
      previewFrameSize.height,
      previewFrameSize.width,
      previewGuideDragStartX,
      previewGuideDragStartY,
      previewGuideOffsetXValue,
      previewGuideOffsetYValue,
      syncPreviewGuideOffsetFromGesture
    ]
  );

  const updateImageQuality = (nextQuality: ImageQuality) => {
    setImageQuality(nextQuality);
    void updateAppSettings({ imageBackupQuality: nextQuality });
  };

  const updateTripClipRatio = (nextRatio: TripClipRatio) => {
    setRatio(nextRatio);
    void updateAppSettings({ defaultRatio: nextRatio });
  };

  const updateTripClipExportFormat = (nextFormat: ExportFormat) => {
    setExportFormat(nextFormat);
    setExportMessage(null);
    void updateAppSettings({ tripClipExportFormat: nextFormat });
  };

  const updateTripClipVideoQuality = (nextQuality: VideoQualityId) => {
    setVideoQuality(nextQuality);
    setRenderedVideoUri(null);
    void updateAppSettings({ videoQuality: nextQuality });
  };

  const updateTripClipImageSaveFormat = (nextFormat: ImageSaveFormat) => {
    setImageSaveFormat(nextFormat);
    void updateAppSettings({ imageSaveFormat: nextFormat });
  };

  const commitPreviewGuideSizeInput = () => {
    const parsedSize = Number(previewGuideSizeInput);
    if (!Number.isFinite(parsedSize)) {
      setPreviewGuideSizeInput(String(previewGuideSize));
      return;
    }

    applyPreviewGuideSize(parsedSize);
  };

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

  useEffect(() => {
    if (isLoading || bundleId || videoId) {
      return;
    }

    let isMounted = true;

    const loadTripClipDraft = async () => {
      if (shouldStartFreshProject) {
        resetNewTripClipProject();
        setAvailableDraft(null);
        setShowDraftPrompt(false);
        return;
      }

      const draft = await getTripClipDraft();
      if (!isMounted) {
        return;
      }

      if (draft && hasTripClipDraftContent(draft)) {
        setAvailableDraft(draft);
        setShowDraftPrompt(true);
      } else {
        setAvailableDraft(null);
        setShowDraftPrompt(false);
      }
    };

    loadTripClipDraft();

    return () => {
      isMounted = false;
    };
  }, [
    bundleId,
    isLoading,
    resetNewTripClipProject,
    shouldStartFreshProject,
    videoId
  ]);

  useEffect(() => {
    if (isLoading || bundleId || videoId) {
      return;
    }

    const interval = setInterval(() => {
      void persistTripClipDraft(false);
    }, TRIP_CLIP_DRAFT_AUTOSAVE_MS);

    return () => {
      clearInterval(interval);
    };
  }, [bundleId, isLoading, persistTripClipDraft, videoId]);

  useEffect(
    () =>
      subscribeCloudBackupOverview({
        user,
        onChange: setBackupOverview
      }),
    [user]
  );

  useEffect(() => {
    if (selectedIds.length === 0) {
      autoDurationIdsRef.current.clear();
      return;
    }

    setDurations((current) => {
      const autoIds = autoDurationIdsRef.current;
      const selectedSet = new Set(selectedIds);
      let changed = false;
      const next = { ...current };

      autoIds.forEach((id) => {
        if (!selectedSet.has(id)) {
          autoIds.delete(id);
        }
      });

      selectedIds.forEach((id, index) => {
        const defaultDuration = getDefaultFrameDuration(index);

        if (index === 0) {
          if (
            next[id] === undefined ||
            next[id] === DEFAULT_DURATION ||
            autoIds.has(id)
          ) {
            if (next[id] !== defaultDuration) {
              next[id] = defaultDuration;
              changed = true;
            }
            autoIds.add(id);
          }
          return;
        }

        if (autoIds.has(id)) {
          if (next[id] !== defaultDuration) {
            next[id] = defaultDuration;
            changed = true;
          }
          autoIds.delete(id);
        }
      });

      return changed ? next : current;
    });
  }, [selectedIds]);

  useEffect(() => {
    player.volume = activeMusicSource ? volume : 0;
    player.loop = true;

    if (!activeMusicSource) {
      player.pause();
      setIsMusicPreviewing(false);
    }
  }, [activeMusicSource, player, volume]);

  useEffect(() => {
    setRenderedVideoUri(null);
  }, [
    customMusic?.uri,
    durations,
    musicMode,
    photoAdjustments,
    planEntitlements.showWatermark,
    previewGridGuideLinePositions,
    previewGuide,
    previewGuideColor,
    previewGuideOffsetX,
    previewGuideOffsetY,
    previewGuideShapePoints,
    previewGuideSize,
    previewGuideStrokeWidth,
    previewGuideVisible,
    ratio,
    selectedIds,
    selectedUserMusicId,
    template,
    transition,
    transitionDuration,
    videoQuality
  ]);

  useEffect(() => {
    if (activeIndex >= selectedPhotos.length) {
      setActiveIndex(Math.max(0, selectedPhotos.length - 1));
    }

    if (selectedPhotos.length === 0) {
      setProgressSeconds(0);
      setActiveEditorTab("photos");
    }
  }, [activeIndex, selectedPhotos.length]);

  useEffect(() => {
    if (!isPlaying || selectedPhotos.length === 0) {
      return;
    }

    const currentId = selectedPhotos[activeIndex]?.id;
    const duration = currentId
      ? getFrameDuration(currentId, activeIndex)
      : DEFAULT_DURATION;
    const playbackOffset = Math.max(
      0,
      Math.min(duration - 0.05, playbackOffsetRef.current)
    );
    playbackOffsetRef.current = 0;
    const remainingDuration = Math.max(0.05, duration - playbackOffset);
    const durationMs = remainingDuration * 1000;
    const startSeconds = getStartTimeForIndex(activeIndex) + playbackOffset;

    setProgressSeconds(startSeconds);
    cancelAnimation(playbackProgress);
    playbackProgress.value = startSeconds;
    playbackProgress.value = withTiming(
      Math.min(totalDuration, startSeconds + remainingDuration),
      {
        duration: durationMs,
        easing: Easing.linear
      }
    );

    const timer = setTimeout(() => {
      const nextProgress = Math.min(totalDuration, startSeconds + remainingDuration);
      setProgressSeconds(nextProgress);
      setActiveIndex((index) => {
        if (index >= selectedPhotos.length - 1) {
          setIsPlaying(false);
          player.pause();
          setIsMusicPreviewing(false);
          setProgressSeconds(totalDuration);
          return index;
        }

        return index + 1;
      });
    }, durationMs);

    return () => {
      cancelAnimation(playbackProgress);
      clearTimeout(timer);
    };
  }, [
    activeIndex,
    getFrameDuration,
    getStartTimeForIndex,
    isPlaying,
    player,
    playbackProgress,
    selectedPhotos,
    totalDuration
  ]);

  const togglePhoto = (photo: PhotoItem) => {
    setSelectedIds((current) => {
      if (current.includes(photo.id)) {
        return current.filter((id) => id !== photo.id);
      }

      setDurations((values) => ({
        ...values,
        [photo.id]: values[photo.id] ?? getDefaultFrameDuration(current.length)
      }));
      return [...current, photo.id];
    });
  };

  const deselectPickerPhoto = (photo: PhotoItem) => {
    const nextSelection = deselectTripClipPhoto({
      photoId: photo.id,
      selectedIds,
      durations,
      activeIndex
    });

    setSelectedIds(nextSelection.selectedIds);
    setDurations(nextSelection.durations);
    setActiveIndex(nextSelection.activeIndex);
    setExportMessage("사진 선택을 해제했습니다.");
  };

  const pickPhotosFromPreview = async () => {
    if (isImportingPhotos) {
      return;
    }

    try {
      setIsImportingPhotos(true);
      const mediaAccessState = await requestMediaLibraryAccess({
        fallbackMessage: "사진을 선택하려면 앨범 접근 권한이 필요합니다.",
        onMessage: setExportMessage
      });
      if (!isMediaLibraryAccessGranted(mediaAccessState)) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: 10,
        quality: 1
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const savedPhotos = await Promise.all(
        result.assets.map((asset) =>
          saveCapturedPhoto({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            localImageLimit: planEntitlements.localImageLimit
          })
        )
      );
      let backupFailureCount = 0;

      for (const savedPhoto of savedPhotos) {
        try {
          await backupPhotoIfEnabled({
            user,
            subscription,
            photo: savedPhoto
          });
        } catch (backupError) {
          backupFailureCount += 1;
          console.error("가져온 사진 자동 백업에 실패했습니다.", backupError);
          await recordBackupFailure({
            id: savedPhoto.id,
            kind: "photo",
            label: "가져온 사진",
            message: getUserFacingErrorMessage(
              backupError,
              "클라우드 백업을 완료하지 못했습니다."
            )
          });
        }
      }

      setPhotos((current) => [...savedPhotos, ...current]);
      setSelectedIds((current) => [
        ...current,
        ...savedPhotos
          .map((photo) => photo.id)
          .filter((id) => !current.includes(id))
      ]);
      setActiveIndex(0);
      setExportMessage(
        backupFailureCount > 0
          ? `사진은 추가됐지만 ${backupFailureCount}장은 클라우드 백업을 설정에서 다시 시도할 수 있습니다.`
          : null
      );
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "사진을 선택하지 못했습니다."));
    } finally {
      setIsImportingPhotos(false);
    }
  };

  const handleAddUserMusic = useCallback(async () => {
    if (isMusicSubmitting) {
      return;
    }

    if (!isLoggedIn || !user) {
      setExportProgress({
        visible: true,
        percent: 100,
        title: "로그인이 필요합니다",
        detail: "내 음악은 로그인 후 추가할 수 있습니다.",
        error: "마이페이지에서 로그인한 뒤 다시 시도해 주세요."
      });
      return;
    }

    const previousTrackIds = new Set(userMusicTracks.map((track) => track.id));

    try {
      setIsMusicSubmitting(true);
      setExportMessage(null);

      const appSettings = await getAppSettings();
      const nextTracks = await pickAndUploadUserMusicTrack(
        user,
        planEntitlements.musicTrackLimit,
        {
          uploadToCloud: isCloudBackupTargetEnabled(appSettings, "music")
        }
      );
      const uploadedTrack = nextTracks.find((track) => !previousTrackIds.has(track.id));

      setUserMusicTracks(nextTracks);

      if (uploadedTrack) {
        setSelectedUserMusicId(uploadedTrack.id);
        setMusicMode("device");
        setExportMessage("내 음악을 추가했습니다.");
      }
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "내 음악을 추가하지 못했습니다."));
    } finally {
      setIsMusicSubmitting(false);
    }
  }, [
    isLoggedIn,
    isMusicSubmitting,
    planEntitlements.musicTrackLimit,
    user,
    userMusicTracks
  ]);

  const movePhoto = (id: string, direction: -1 | 1) => {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const seekPreview = useCallback(
    (seconds: number) => {
      if (selectedPhotos.length === 0 || totalDuration <= 0) {
        setProgressSeconds(0);
        return;
      }

      const position = getPlaybackPosition(seconds);

      setIsPlaying(false);
      setIsMusicPreviewing(false);
      player.pause();
      cancelAnimation(playbackProgress);
      playbackProgress.value = position.seconds;
      playbackOffsetRef.current = position.offset;
      setActiveIndex(position.index);
      setProgressSeconds(position.seconds);
    },
    [getPlaybackPosition, playbackProgress, player, selectedPhotos.length, totalDuration]
  );

  const stopPlayback = () => {
    const currentProgress = Math.max(0, Math.min(totalDuration, playbackProgress.value));
    const position = getPlaybackPosition(currentProgress);
    cancelAnimation(playbackProgress);
    playbackOffsetRef.current = position.offset;
    setProgressSeconds(position.seconds);
    setActiveIndex(position.index);
    setIsPlaying(false);
    setIsMusicPreviewing(false);
    player.pause();
  };

  const resetPlayback = () => {
    cancelAnimation(playbackProgress);
    playbackProgress.value = 0;
    playbackOffsetRef.current = 0;
    setIsPlaying(false);
    setIsMusicPreviewing(false);
    setActiveIndex(0);
    setProgressSeconds(0);
    player.pause();
  };

  const jumpPhoto = (direction: -1 | 1) => {
    if (selectedPhotos.length === 0) {
      return;
    }

    const nextIndex = Math.max(
      0,
      Math.min(selectedPhotos.length - 1, activeIndex + direction)
    );
    const nextSeconds = getStartTimeForIndex(nextIndex);

    cancelAnimation(playbackProgress);
    playbackProgress.value = nextSeconds;
    playbackOffsetRef.current = 0;
    setIsPlaying(false);
    setIsMusicPreviewing(false);
    setActiveIndex(nextIndex);
    setProgressSeconds(nextSeconds);
    player.pause();
  };

  const preloadSelectedPreviewImages = async () => {
    const uris = selectedPhotos.map(getPreviewUri);
    if (uris.length === 0) {
      return;
    }

    try {
      await Image.prefetch(uris, "memory-disk");
    } catch {
      // Preloading is a best-effort optimization. Playback should still work.
    }
  };

  const playClip = async () => {
    if (selectedPhotos.length === 0) {
      return;
    }

    await preloadSelectedPreviewImages();

    const startSeconds = progressSeconds >= totalDuration ? 0 : progressSeconds;
    const position = getPlaybackPosition(startSeconds);

    playbackOffsetRef.current = position.offset;
    playbackProgress.value = position.seconds;
    setActiveIndex(position.index);
    setProgressSeconds(position.seconds);
    setIsPlaying(true);

    if (activeMusicSource) {
      player.volume = volume;
      await player.seekTo(position.seconds);
      player.play();
      setIsMusicPreviewing(true);
    }
  };

  const recordTripClipVideo = async (
    onProgress?: (percent: number, detail: string) => void
  ) => {
    if (!recordingViewAvailable) {
      throw new Error(
        "MP4 저장 기능을 사용할 수 없습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요."
      );
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error("영상 파일을 만들 임시 저장소를 찾지 못했습니다.");
    }

    const totalFrames = Math.max(1, Math.ceil(totalDuration * VIEW_RECORDER_FPS));
    const outputSize = getVideoQualityOutputSize(videoQuality, ratioAspect[ratio]);
    const outputUri = `${FileSystem.cacheDirectory}trip-clip-${Date.now()}.mp4`;
    const output = toNativeFilePath(outputUri);
    let exportMusicUri = customMusic?.uri ?? null;
    if (musicMode === "device" && selectedUserMusic) {
      const restoredTrack = await restoreUserMusicTrackIfNeeded(user, selectedUserMusic);
      exportMusicUri = restoredTrack.uri;
      if (restoredTrack.uri !== selectedUserMusic.uri) {
        setUserMusicTracks((currentTracks) =>
          currentTracks.map((track) =>
            track.id === restoredTrack.id ? restoredTrack : track
          )
        );
      }
    }
    const audioFilePath =
      musicMode === "device" && exportMusicUri?.startsWith("file")
        ? toNativeFilePath(exportMusicUri)
        : null;

    await preloadSelectedPreviewImages();
    setRecordingFrameIndex(0);
    await waitForPaint();
    onProgress?.(12, "영상 제작을 준비하고 있습니다.");

    const recordedPath = await recorder.record({
      output,
      fps: VIEW_RECORDER_FPS,
      totalFrames,
      width: outputSize.width,
      height: outputSize.height,
      codec: "h264",
      quality: 0.92,
      bitrate: selectedVideoQuality.bitrate,
      keyFrameInterval: 1,
      ...(audioFilePath ? { audioFile: { path: audioFilePath, startTime: 0 } } : {}),
      onFrame: async ({ frameIndex }) => {
        setRecordingFrameIndex(frameIndex);
        await waitForPaint();
      },
      onProgress: ({ framesEncoded }) => {
        const percent = 12 + Math.round((framesEncoded / totalFrames) * 70);
        onProgress?.(
          Math.min(82, percent),
          `영상을 제작중입니다. ${framesEncoded}/${totalFrames}`
        );
      }
    });

    onProgress?.(84, "완성된 MP4 영상을 저장할 준비를 하고 있습니다.");
    const recordedUri = toFileUri(recordedPath);
    const fileInfo = await FileSystem.getInfoAsync(recordedUri);

    if (!fileInfo.exists) {
      throw new Error("MP4 파일 생성은 완료됐지만 저장할 파일을 찾지 못했습니다.");
    }

    return recordedUri;
  };

  const renderMp4Video = async (onProgress?: (percent: number, detail: string) => void) => {
    if (renderedVideoUri) {
      return renderedVideoUri;
    }

    if (selectedPhotos.length === 0) {
      setExportMessage("내보내기 전에 사진을 선택해 주세요.");
      return null;
    }

    if (Platform.OS === "web") {
      setIsExportComingSoonVisible(true);
      return null;
    }

    try {
      const localUri = await recordTripClipVideo(onProgress);
      setRenderedVideoUri(localUri);
      return localUri;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");

      if (
        message.includes("Native module not linked") ||
        message.includes("ViewRecorder") ||
        message.includes("TurboModule")
      ) {
        throw new Error(
          "MP4 영상을 만들지 못했습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요."
        );
      }

      throw error;
    }
  };

  const showVideoDurationBlocked = () => {
    setExportMessage(VIDEO_EXPORT_BLOCKED_MESSAGE);
    setExportProgress({
      visible: true,
      percent: 100,
      title: "내보내기 불가",
      detail: `현재 예상 길이는 ${formatVideoDuration(totalDuration)}입니다. 최대 길이는 ${formatVideoDuration(MAX_VIDEO_DURATION_SECONDS)}입니다.`,
      error: VIDEO_EXPORT_BLOCKED_MESSAGE
    });
  };

  const saveSelectedExport = async ({
    returnToVideoWorks = false
  }: SaveSelectedExportOptions = {}) => {
    if (!canUseVideoCreation) {
      showLoginRequiredForVideoCreation();
      return;
    }

    if (exportFormat !== "mp4") {
      await executeSelectedExport({ returnToVideoWorks });
      return;
    }

    if (videoDurationTooLong) {
      showVideoDurationBlocked();
      return;
    }

    if (!isLoggedIn || !user) {
      setExportMessage("로그인하면 무료로 주 1회 MP4 영상을 만들 수 있습니다.");
      setExportProgress({
        visible: true,
        percent: 100,
        title: "로그인이 필요합니다",
        detail: "무료 MP4 저장은 로그인한 사용자에게 주 1회 제공됩니다.",
        error: "마이페이지에서 로그인한 뒤 다시 시도해 주세요."
      });
      return;
    }

    try {
      const usage = await getWeeklyVideoExportUsage(user, weeklyVideoExportLimit);
      setWeeklyVideoExportUsage(usage);

      if (usage && usage.remaining <= 0) {
        setExportMessage("이번 주 무료 MP4 저장 횟수를 모두 사용했습니다.");
        setExportProgress({
          visible: true,
          percent: 100,
          title: "무료 저장 한도 초과",
          detail: `${planEntitlements.label} 플랜은 MP4 영상을 주 ${weeklyVideoExportLimit}회까지 만들 수 있습니다.`,
          error: `이번 주(${usage.weekLabel}) MP4 저장 ${weeklyVideoExportLimit}회를 이미 사용했습니다. 다음 주에 다시 만들거나 플랜을 확인해 주세요.`
        });
        return;
      }

      await executeSelectedExport({ countWeeklyMp4: true, returnToVideoWorks });
    } catch (error) {
      const message = getUserFacingErrorMessage(
        error,
        "무료 저장 가능 여부를 확인하지 못했습니다."
      );
      setExportMessage(message);
      setExportProgress({
        visible: true,
        percent: 100,
        title: "저장 확인 실패",
        detail: "무료 MP4 저장 가능 여부를 확인하지 못했습니다.",
        error: message
      });
    }
  };

  const executeSelectedExport = async ({
    countWeeklyMp4 = false,
    returnToVideoWorks = false
  }: {
    countWeeklyMp4?: boolean;
    returnToVideoWorks?: boolean;
  } = {}) => {
    if (exportFormat === "mp4" && Platform.OS === "web") {
      setIsExportComingSoonVisible(true);
      return;
    }

    if (selectedPhotos.length === 0 || isExporting) {
      setExportMessage("저장하기 전에 사진을 선택해 주세요.");
      return;
    }

    if (exportFormat === "mp4" && videoDurationTooLong) {
      showVideoDurationBlocked();
      return;
    }

    let weeklyExportReservationId: string | null = null;
    let weeklyExportSaveSucceeded = false;

    try {
      setIsExporting(true);
      setExportProgress({
        visible: true,
        percent: 5,
        title: "저장 준비 중",
        detail: "선택한 저장 형식을 확인하고 있습니다."
      });

      if (countWeeklyMp4 && exportFormat === "mp4" && user) {
        const reservation = await reserveWeeklyVideoExport(user, weeklyVideoExportLimit);
        weeklyExportReservationId = reservation.reservationId;
        setWeeklyVideoExportUsage(reservation);
      }

      if (exportFormat === "images") {
        if (selectedPhotos.length === 0) {
          setExportMessage("저장할 이미지가 없습니다.");
          return;
        }

        const savedImageUris: string[] = [];
        const savedImageWidths: (number | null)[] = [];
        const savedImageHeights: (number | null)[] = [];

        for (let index = 0; index < selectedPhotos.length; index += 1) {
          const photo = selectedPhotos[index];
          const percent = Math.round(((index + 1) / selectedPhotos.length) * 90);

          setExportProgress({
            visible: true,
            percent: Math.max(12, percent),
            title: "이미지 저장 중",
            detail: `선택한 사진 ${selectedPhotos.length}장 중 ${index + 1}장을 저장하고 있습니다.`
          });
          const savedImageUri = await saveImageToLibrary(photo.uri, imageSaveFormat, {
            imageQuality,
            width: photo.width,
            height: photo.height,
            frameAspectRatio: ratioAspect[ratio],
            adjustment: getTripClipPhotoAdjustment(photoAdjustments, photo.id),
            frameWidth: previewFrameSize.width,
            frameHeight: previewFrameSize.height
          });
          savedImageUris.push(savedImageUri);
          const savedImageDimensions = await resolveImageDimensions({ uri: savedImageUri });
          savedImageWidths.push(savedImageDimensions?.width ?? null);
          savedImageHeights.push(savedImageDimensions?.height ?? null);
        }

        const normalizedWorkTitle = workTitle.trim();
        const bundlePayload = {
          coverUri: selectedPhotos[0]?.uri,
          ratio,
          photoIds: selectedPhotos.map((photo) => photo.id),
          imageUris: savedImageUris,
          imageWidths: savedImageWidths,
          imageHeights: savedImageHeights,
          imageQuality,
          ...(normalizedWorkTitle ? { title: normalizedWorkTitle } : {})
        };

        let savedBundle = null;
        if (bundleId) {
          const updatedBundle = await updateImageBundleWork(bundleId, bundlePayload);
          if (!updatedBundle) {
            savedBundle = await saveImageBundleWork(bundlePayload, {
              localImageLimit: planEntitlements.localImageLimit
            });
          } else {
            savedBundle = updatedBundle;
          }
        } else {
          savedBundle = await saveImageBundleWork(bundlePayload, {
            localImageLimit: planEntitlements.localImageLimit
          });
        }

        let backupWarning: string | null = null;

        if (savedBundle && cloudBackupEnabled && user && planEntitlements.canBackupToCloud) {
          try {
            setExportProgress({
              visible: true,
              percent: 94,
              title: "클라우드 백업 중",
              detail: "저장한 이미지 작업을 계정에 백업하고 있습니다."
            });
            await backupImageBundleWork({
              user,
              work: savedBundle,
              enabled: cloudBackupEnabled,
              subscription
            });
          } catch (backupError) {
            await recordBackupFailure({
              id: savedBundle.id,
              kind: "image-bundle",
              label: savedBundle.title,
              message: getUserFacingErrorMessage(
                backupError,
                "클라우드 백업은 완료하지 못했습니다."
              )
            });
            backupWarning = getUserFacingErrorMessage(
              backupError,
              "클라우드 백업은 완료하지 못했습니다."
            );
          }
        }

        setExportMessage(
          backupWarning
            ? `선택한 이미지는 핸드폰에 저장되었습니다. ${backupWarning}`
            : "선택한 이미지가 핸드폰에 저장되었습니다."
        );
        setExportProgress({
          visible: true,
          percent: 100,
          title: "저장 완료",
          detail: backupWarning
            ? `이미지 ${selectedPhotos.length}장은 저장됐고, 클라우드 백업은 나중에 다시 시도할 수 있습니다.`
            : `이미지 ${selectedPhotos.length}장이 ${getImageSaveFormatLabel(imageSaveFormat)}으로 핸드폰 앨범과 작업물에 저장되었습니다.`
        });
        await clearTripClipDraft();
        setAvailableDraft(null);
        setShowDraftPrompt(false);
        resetNewTripClipProject();
        return;
      }

      const videoUri = await renderMp4Video((percent, detail) => {
        setExportProgress({
          visible: true,
          percent,
          title: "영상 저장 중",
          detail
        });
      });
      if (!videoUri) {
        if (weeklyExportReservationId && user) {
          const releasedUsage = await releaseWeeklyVideoExport(user, weeklyExportReservationId);
          setWeeklyVideoExportUsage(releasedUsage);
          weeklyExportReservationId = null;
        }
        setExportProgress({
          visible: true,
          percent: 100,
          title: "저장 실패",
          detail: "영상을 만들 준비가 완료되지 않았습니다.",
          error: "사진 선택이나 저장 설정을 다시 확인해 주세요."
        });
        return;
      }

      const normalizedWorkTitle = workTitle.trim();
      setExportProgress({
        visible: true,
        percent: 88,
        title: "핸드폰에 저장 중",
        detail: "완성된 MP4 영상을 앨범에 저장하고 있습니다."
      });
      await saveVideoToLibrary(videoUri);
      setExportProgress({
        visible: true,
        percent: 96,
        title: videoId ? "작업물 저장 중" : "목록에 추가 중",
        detail: videoId
          ? "편집한 영상을 작업물에 저장하고 있습니다."
          : "저장한 영상을 작업물 목록에 등록하고 있습니다."
      });
      const videoPayload: Parameters<typeof saveMadeVideo>[0] = {
        uri: videoUri,
        coverUri: activePhoto?.uri,
        title: normalizedWorkTitle || undefined,
        ratio,
        template,
        transition,
        transitionDuration,
        duration: totalDuration,
        photoIds: selectedPhotos.map((photo) => photo.id),
        durations: selectedPhotos.reduce<Record<string, number>>((next, photo, index) => {
          next[photo.id] = getFrameDuration(photo.id, index);
          return next;
        }, {}),
        musicId: musicMode === "device" && customMusic ? "custom" : "none",
        musicLabel: activeMusicLabel
      };
      let savedVideo = null;
      if (videoId) {
        savedVideo = await updateMadeVideo(videoId, videoPayload);
      }
      if (!savedVideo) {
        savedVideo = await saveMadeVideo(videoPayload, {
          localVideoLimit: planEntitlements.localVideoLimit
        });
      }
      weeklyExportSaveSucceeded = true;
      if (weeklyExportReservationId && user) {
        try {
          const completedUsage = await completeWeeklyVideoExport(user, weeklyExportReservationId);
          if (completedUsage) {
            setWeeklyVideoExportUsage(completedUsage);
          }
        } catch {
          await recordPendingWeeklyVideoExportCompletion({
            user,
            reservationId: weeklyExportReservationId,
            limit: weeklyVideoExportLimit
          });
        }
      }
      let backupWarning: string | null = null;
      const wantsVideoBackup =
        shouldBackupVideoExport && videoBackupTargetEnabled &&
        cloudBackupEnabled &&
        user &&
        planEntitlements.canBackupToCloud;

      if (wantsVideoBackup && !canBackupMoreVideos(backupOverview.videoCount, planEntitlements.tier)) {
        backupWarning = `영상 백업 한도 ${videoBackupLimit}개를 모두 사용해 클라우드 백업은 건너뛰었습니다.`;
      } else if (wantsVideoBackup) {
        try {
          setExportProgress({
            visible: true,
            percent: 98,
            title: "클라우드 백업 중",
            detail: "저장한 영상을 계정에 백업하고 있습니다."
          });
          await backupMadeVideo({
            user,
            video: savedVideo,
            enabled: cloudBackupEnabled,
            subscription
          });
        } catch (backupError) {
          await recordBackupFailure({
            id: savedVideo.id,
            kind: "video",
            label: savedVideo.title,
            message: getUserFacingErrorMessage(
              backupError,
              "클라우드 백업은 완료하지 못했습니다."
            )
          });
          backupWarning = getUserFacingErrorMessage(
            backupError,
            "클라우드 백업은 완료하지 못했습니다."
          );
        }
      }
      setExportMessage(
        backupWarning
          ? `MP4 영상은 핸드폰에 저장되었습니다. ${backupWarning}`
          : "MP4 영상이 핸드폰에 저장되었습니다."
      );
      setExportProgress({
        visible: true,
        percent: 100,
        title: "저장 완료",
        detail: backupWarning
          ? "저장한 영상은 핸드폰 갤러리에 저장됐습니다. 클라우드 백업은 나중에 다시 시도할 수 있습니다."
          : "저장한 영상은 핸드폰 갤러리에 저장됐습니다.",
        completedVideoId: savedVideo.id
      });
      await clearTripClipDraft();
      setAvailableDraft(null);
      setShowDraftPrompt(false);
      resetNewTripClipProject();
      if (weeklyExportReservationId && user) {
        setWeeklyVideoExportUsage(await getWeeklyVideoExportUsage(user, weeklyVideoExportLimit));
      }
      if (returnToVideoWorks) {
        router.replace("/studio?tab=works" as Href);
        return;
      }
      if (planEntitlements.showAds) {
        setIsPostSaveAdVisible(true);
      }
    } catch (error) {
      if (weeklyExportReservationId && user && !weeklyExportSaveSucceeded) {
        await releaseWeeklyVideoExport(user, weeklyExportReservationId).catch(() => null);
      }
      if (weeklyExportReservationId && user) {
        setWeeklyVideoExportUsage(
          await getWeeklyVideoExportUsage(user, weeklyVideoExportLimit).catch(() => null)
        );
      }
      const message = getUserFacingErrorMessage(error, "저장하지 못했습니다.");
      setExportMessage(message);
      setExportProgress({
        visible: true,
        percent: 100,
        title: "저장 실패",
        detail: "저장 준비를 완료하지 못했습니다.",
        error: message
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareSelectedExport = async () => {
    if (!canUseVideoCreation) {
      showLoginRequiredForVideoCreation();
      return;
    }

    if (exportFormat === "mp4" && videoDurationTooLong) {
      showVideoDurationBlocked();
      return;
    }

    if (selectedPhotos.length === 0 || isExporting) {
      setExportMessage("공유하기 전에 사진을 선택해 주세요.");
      return;
    }

    try {
      setIsExporting(true);

      if (exportFormat === "images") {
        if (!activePhoto) {
          setExportMessage("공유할 이미지가 없습니다.");
          return;
        }

        await shareImage(activePhoto.uri, imageSaveFormat, {
          imageQuality,
          width: activePhoto.width,
          height: activePhoto.height,
          frameAspectRatio: ratioAspect[ratio],
          adjustment: getTripClipPhotoAdjustment(photoAdjustments, activePhoto.id),
          frameWidth: previewFrameSize.width,
          frameHeight: previewFrameSize.height
        });
        return;
      }

      if (Platform.OS === "web") {
        setIsExportComingSoonVisible(true);
        return;
      }

      const videoUri = await renderMp4Video();
      if (!videoUri) {
        return;
      }

      await shareVideo(videoUri);
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "공유하지 못했습니다."));
    } finally {
      setIsExporting(false);
    }
  };

  const renderAddPhotoTile = () => (
    <Pressable
      disabled={isImportingPhotos}
      style={[
        styles.photoTile,
        styles.addPhotoTile,
        isImportingPhotos && styles.disabledButton
      ]}
      onPress={pickPhotosFromPreview}
    >
      <View style={styles.addPhotoIcon}>
        <Text selectable={false} style={styles.addPhotoIconText}>
          +
        </Text>
      </View>
      <Text selectable={false} style={styles.addPhotoTitle}>
        사진 추가
      </Text>
      <Text selectable={false} style={styles.addPhotoDetail}>
        앨범에서 선택
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.section + bottomSafePadding }
        ]}
      >
      <TripClipHeader
        handleBackPress={handleBackPress}
        isLoading={isLoading}
        isExporting={isExporting}
        handleHeaderSavePress={handleHeaderSavePress}
        isEditingMadeVideo={isEditingMadeVideo}
        availableDraft={availableDraft}
        showDraftPrompt={showDraftPrompt}
        formatDraftTime={formatDraftTime}
        resumeTripClipDraft={resumeTripClipDraft}
        removeTripClipDraft={removeTripClipDraft}
        workTitle={workTitle}
        setWorkTitle={setWorkTitle}
      />

      <TripClipPreview
        ratio={ratio}
        ratioAspect={ratioAspect}
        setPreviewFrameSize={setPreviewFrameSize}
        activePhoto={activePhoto}
        frameFitPreviewProps={frameFitPreviewProps}
        previewAdjustEnabled={previewAdjustEnabled}
        setPreviewAdjustEnabled={setPreviewAdjustEnabled}
        resetActivePhotoAdjustment={resetActivePhotoAdjustment}
        setIsFrameFitModalVisible={setIsFrameFitModalVisible}
        isPreviewGuideMoving={isPreviewGuideMoving}
        previewGuideMoveGesture={previewGuideMoveGesture}
        isImportingPhotos={isImportingPhotos}
        pickPhotosFromPreview={pickPhotosFromPreview}
        selectedPhotoCount={selectedPhotos.length}
        totalDuration={totalDuration}
        transition={transition}
        activeMusicLabel={activeMusicLabel}
        videoDurationTooLong={videoDurationTooLong}
        isPlaying={isPlaying}
        stopPlayback={stopPlayback}
        playClip={playClip}
        jumpPhoto={jumpPhoto}
        resetPlayback={resetPlayback}
        progressSeconds={progressSeconds}
        playbackProgress={playbackProgress}
        seekPreview={seekPreview}
      />

      {activeEditorTab === "photos" ? (
        <TripClipPhotoTab
          isLoading={isLoading}
          photos={photos}
          selectedIds={selectedIds}
          isImportingPhotos={isImportingPhotos}
          getPhotoLabel={getPhotoLabel}
          togglePhoto={togglePhoto}
          deselectPickerPhoto={deselectPickerPhoto}
          renderAddPhotoTile={renderAddPhotoTile}
        />
      ) : null}

      {activeEditorTab === "timeline" ? (
        <TripClipTimelineTab
          selectedPhotos={selectedPhotos}
          getPhotoLabel={getPhotoLabel}
          getFrameDuration={getFrameDuration}
          timelineDurationEditing={timelineDurationEditing}
          movePhoto={movePhoto}
        />
      ) : null}

      {activeEditorTab === "video" ? (
        <TripClipVideoTab
          ratio={ratio}
          transition={transition}
          transitionDuration={transitionDuration}
          fadeOptions={FADE_OPTIONS}
          updateTripClipRatio={updateTripClipRatio}
          setTransition={setTransition}
          setTransitionDuration={setTransitionDuration}
        />
      ) : null}

      {activeEditorTab === "guide" ? (
        <TripClipGuideTab
          activePhoto={activePhoto}
          previewGuideVisible={previewGuideVisible}
          previewGuide={previewGuide}
          previewGuideSize={previewGuideSize}
          previewGuideStrokeWidth={previewGuideStrokeWidth}
          previewGuideSizeBounds={previewGuideSizeBounds}
          previewGuideSizeInput={previewGuideSizeInput}
          previewGuideColor={previewGuideColor}
          isPreviewGuideMoving={isPreviewGuideMoving}
          guideSizeOptions={GUIDE_SIZE_OPTIONS}
          guideStrokeWidthOptions={GUIDE_STROKE_WIDTH_OPTIONS}
          guideColorOptions={GUIDE_COLOR_OPTIONS}
          updatePreviewGuideVisibility={updatePreviewGuideVisibility}
          stopPreviewGuideMove={stopPreviewGuideMove}
          startPreviewGuideMove={startPreviewGuideMove}
          resetPreviewGuidePositionToCenter={resetPreviewGuidePositionToCenter}
          updatePreviewGuideType={updatePreviewGuideType}
          applyPreviewGuideSize={applyPreviewGuideSize}
          setPreviewGuideSizeInput={setPreviewGuideSizeInput}
          commitPreviewGuideSizeInput={commitPreviewGuideSizeInput}
          updatePreviewGuideStrokeWidth={updatePreviewGuideStrokeWidth}
          updatePreviewGuideColor={updatePreviewGuideColor}
        />
      ) : null}

      {activeEditorTab === "music" ? (
        <TripClipMusicTab
          musicMode={musicMode}
          setMusicMode={setMusicMode}
          setExportMessage={setExportMessage}
          userMusicTracks={userMusicTracks}
          selectedUserMusic={selectedUserMusic}
          setSelectedUserMusicId={setSelectedUserMusicId}
          isMusicSubmitting={isMusicSubmitting}
          musicTrackLimit={planEntitlements.musicTrackLimit}
          handleAddUserMusic={handleAddUserMusic}
          activeMusicLabel={activeMusicLabel}
          activeMusicSource={activeMusicSource}
          isPlaying={isPlaying}
          stopPlayback={stopPlayback}
          playClip={playClip}
        />
      ) : null}

      {activeEditorTab === "export" ? (
        <TripClipExportTab
          exportFormat={exportFormat}
          exportFormatOptions={EXPORT_FORMAT_OPTIONS}
          isLoggedIn={isLoggedIn}
          premiumExportActive={premiumExportActive}
          planLabel={planEntitlements.label}
          canBackupToCloud={planEntitlements.canBackupToCloud}
          weeklyVideoExportLimit={weeklyVideoExportLimit}
          weeklyVideoExportUsage={weeklyVideoExportUsage}
          cloudBackupEnabled={cloudBackupEnabled}
          updateTripClipExportFormat={updateTripClipExportFormat}
          videoQuality={videoQuality}
          updateTripClipVideoQuality={updateTripClipVideoQuality}
          canBackupVideoExport={canBackupVideoExport}
          shouldBackupVideoExport={shouldBackupVideoExport}
          setShouldBackupVideoExport={setShouldBackupVideoExport}
          setExportMessage={setExportMessage}
          videoBackupTargetEnabled={videoBackupTargetEnabled}
          videoBackupRemaining={videoBackupRemaining}
          videoBackupLimit={videoBackupLimit}
          imageQuality={imageQuality}
          updateImageQuality={updateImageQuality}
          imageSaveFormat={imageSaveFormat}
          updateTripClipImageSaveFormat={updateTripClipImageSaveFormat}
          isExporting={isExporting}
          selectedPhotoCount={selectedPhotos.length}
          videoDurationTooLong={videoDurationTooLong}
          saveSelectedExport={saveSelectedExport}
          shareSelectedExport={shareSelectedExport}
          exportMessage={exportMessage}
        />
      ) : null}
      </ScrollView>
      <Modal
        visible={isFrameFitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFrameFitModalVisible(false)}
      >
        <View style={styles.frameFitModalBackdrop}>
          <View style={styles.frameFitModalPanel}>
            <View style={styles.frameFitModalHeader}>
              <View style={styles.frameFitModalCopy}>
                <Text selectable={false} style={styles.frameFitModalTitle}>
                  프레임 맞추기
                </Text>
                <Text selectable={false} style={styles.frameFitModalDetail}>
                  손가락으로 사진 위치와 크기를 맞추세요.
                </Text>
              </View>
              <Pressable
                style={styles.frameFitModalCloseButton}
                onPress={() => setIsFrameFitModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="프레임 맞추기 닫기"
              >
                <Feather name="x" size={18} color={colors.text} />
              </Pressable>
            </View>
            <View style={[styles.frameFitModalFrame, { aspectRatio: ratioAspect[ratio] }]}>
              {frameFitPreviewProps ? (
                <TripClipPreviewPlayer
                  {...frameFitPreviewProps}
                  adjustEnabled={isFrameFitModalVisible}
                />
              ) : null}
            </View>
            <View style={styles.frameFitModalActions}>
              <Pressable
                style={styles.frameFitModalButton}
                onPress={resetActivePhotoAdjustment}
              >
                <Text selectable={false} style={styles.frameFitModalButtonText}>
                  초기화
                </Text>
              </Pressable>
              <Pressable
                style={[styles.frameFitModalButton, styles.frameFitModalPrimaryButton]}
                onPress={() => setIsFrameFitModalVisible(false)}
              >
                <Text
                  selectable={false}
                  style={[styles.frameFitModalButtonText, styles.frameFitModalPrimaryButtonText]}
                >
                  완료
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {timelineDurationEditing.editingDurationId ? (
        <View
          style={[
            styles.timelineDurationKeyboardPanel,
            { bottom: durationKeyboardPanelBottom }
          ]}
        >
          <View style={styles.timelineDurationKeyboardCopy}>
            <Text selectable={false} style={styles.timelineDurationKeyboardTitle}>
              노출 시간
            </Text>
            <Text selectable={false} style={styles.timelineDurationKeyboardDetail}>
              초 단위로 입력
            </Text>
          </View>
          <TextInput
            autoFocus
            value={timelineDurationEditing.durationInputValue}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={styles.timelineDurationKeyboardInput}
            onChangeText={timelineDurationEditing.setDurationInputValue}
            onBlur={timelineDurationEditing.finishActiveDurationEditing}
            onSubmitEditing={timelineDurationEditing.finishActiveDurationEditing}
          />
          <Pressable
            style={styles.timelineDurationKeyboardDoneButton}
            onPress={Keyboard.dismiss}
            accessibilityRole="button"
            accessibilityLabel="노출 시간 입력 완료"
          >
            <Text selectable={false} style={styles.timelineDurationKeyboardDoneText}>
              완료
            </Text>
          </Pressable>
        </View>
      ) : null}
      {recordingViewAvailable ? (
        <View pointerEvents="none" style={styles.recordingHost}>
          <OptionalRecordingView
            available={recordingViewAvailable}
            sessionId={recorder.sessionId}
            style={[
              styles.recordingView,
              {
                width: RECORDING_VIEW_WIDTH,
                aspectRatio: ratioAspect[ratio]
              }
            ]}
          >
            <TripClipRecordingCanvas
              frame={recordingFrame}
              template={template}
              transition={transition}
              showWatermark={planEntitlements.showWatermark}
              frameAspectRatio={ratioAspect[ratio]}
              guideVisible={false}
              guide={previewGuide}
              guideSize={previewGuideSize}
              guideStrokeWidth={previewGuideStrokeWidth}
              guideColor={previewGuideColor}
              guideLineOpacity={previewGuideLineOpacity}
              guideOffsetX={previewGuideOffsetX}
              guideOffsetY={previewGuideOffsetY}
              guideOffsetFrameWidth={previewGuideOffsetFrameWidth}
              guideOffsetFrameHeight={previewGuideOffsetFrameHeight}
              gridGuideLinePositions={previewGridGuideLinePositions}
              guideShapePoints={previewGuideShapePoints}
              photoAdjustments={photoAdjustments}
            />
          </OptionalRecordingView>
        </View>
      ) : null}
      <View
        style={[
          styles.bottomEditorTabs,
          { paddingBottom: bottomSafePadding }
        ]}
      >
        {EDITOR_TABS.map((tab) => {
          const isLocked = tab.value !== "photos" && selectedPhotos.length === 0;
          const isActive = activeEditorTab === tab.value;

          return (
            <Pressable
              key={tab.value}
              disabled={isLocked}
              style={[
                styles.bottomEditorTab,
                isActive && styles.bottomEditorTabActive,
                isLocked && styles.bottomEditorTabDisabled
              ]}
              onPress={() => {
                setActiveEditorTab(tab.value);
              }}
            >
              <Text
                selectable={false}
                style={[
                  styles.bottomEditorTabText,
                  isActive && styles.bottomEditorTabTextActive
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Modal
        visible={exportProgress.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isExporting) {
            setExportProgress(initialExportProgress);
          }
        }}
      >
        <View style={[styles.exportModalBackdrop, modalSafeStyle]}>
          <View
            style={[
              styles.exportModalPanel,
              exportProgress.error && styles.exportModalPanelError
            ]}
          >
            <ScrollView
              style={styles.exportModalScroll}
              contentContainerStyle={styles.exportModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.exportModalTitle}>
                {exportProgress.title}
              </Text>
              <Text style={styles.exportModalDetail}>
                {exportProgress.detail}
              </Text>
            {exportProgress.error ? (
              <View style={styles.exportErrorBox}>
                <Text style={styles.exportErrorLabel}>
                  확인할 내용
                </Text>
                <Text style={styles.exportErrorText}>
                  {exportProgress.error}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.exportProgressTrack}>
                  <View
                    style={[
                      styles.exportProgressFill,
                      { width: `${Math.max(0, Math.min(100, exportProgress.percent))}%` }
                    ]}
                  />
                </View>
                <Text style={styles.exportProgressText}>
                  {Math.round(exportProgress.percent)}%
                </Text>
              </>
            )}
            {isExporting ? (
              <View style={styles.exportModalStatus}>
                <ActivityIndicator color={colors.text} />
                <Text style={styles.exportModalStatusText}>
                  앱을 닫지 말고 잠시만 기다려 주세요.
                </Text>
              </View>
            ) : null}
            {!isExporting ? (
              <View style={styles.exportModalActions}>
                {exportProgress.completedVideoId ? (
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() =>
                      router.replace("/studio?tab=works" as Href)
                    }
                  >
                    <Text selectable={false} style={styles.primaryButtonText}>
                      작업물로 이동
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    exportProgress.error ? styles.primaryButton : styles.secondaryButton,
                    styles.exportModalButton
                  ]}
                  onPress={() => setExportProgress(initialExportProgress)}
                >
                  <Text
                    selectable={false}
                    style={
                      exportProgress.error
                        ? styles.primaryButtonText
                        : styles.secondaryButtonText
                    }
                  >
                    {exportProgress.error ? "확인" : "닫기"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isExportComingSoonVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExportComingSoonVisible(false)}
      >
        <View style={[styles.exportModalBackdrop, modalSafeStyle]}>
          <View style={[styles.exportModalPanel, styles.comingSoonPanel]}>
            <View style={styles.exportModalContent}>
              <Text style={styles.exportModalTitle}>
                준비중입니다
              </Text>
              <Text style={styles.exportModalDetail}>
                핸드폰에 바로 저장하는 기능은 준비 중입니다. 지금은 미리보기와 편집 흐름을 먼저 사용할 수 있습니다.
              </Text>
            </View>
            <View style={[styles.exportModalActions, styles.exportModalExternalActions]}>
              <Pressable
                style={[styles.primaryButton, styles.exportModalButton]}
                onPress={() => setIsExportComingSoonVisible(false)}
              >
                <Text selectable={false} style={styles.primaryButtonText}>
                  확인
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <InterstitialAdModal
        visible={isPostSaveAdVisible}
        placement="post_video_save"
        onClose={() => setIsPostSaveAdVisible(false)}
      />
      <AppGuideOverlay tabKey="tripClip" />
    </View>
  );
}

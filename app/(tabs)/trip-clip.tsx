import { Image } from "expo-image";
import { useAudioPlayer, type AudioSource } from "expo-audio";
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
  TRIP_CLIP_RATIOS,
  TRIP_CLIP_TRANSITIONS,
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
  IMAGE_QUALITY_DESCRIPTION,
  IMAGE_QUALITY_OPTIONS,
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
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
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
import { getMadeVideoById, saveMadeVideo, updateMadeVideo } from "@/lib/video-library";
import {
  calculateVideoDuration,
  formatVideoDuration,
  getVideoQualityOption,
  getVideoQualityOutputSize,
  isVideoDurationTooLong
} from "@/lib/video-utils";
import {
  getTripClipPhotoAdjustment,
  setTripClipPhotoAdjustment,
  type TripClipPhotoAdjustment,
  type TripClipPhotoAdjustmentMap
} from "@/lib/trip-clip-photo-adjustment";
import {
  getImageBundleWorkById,
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
  getRecordingFrame
} from "@/lib/trip-clip-playback";
import type { PhotoItem } from "@/types/photo";
import { Chip, OptionRow, Section, SmallButton, TimelineScrubber } from "@/features/trip-clip/trip-clip-screen.components";
import { IMAGE_SAVE_FORMAT_OPTIONS, RECORDING_VIEW_WIDTH } from "@/features/trip-clip/trip-clip-screen.constants";
import { getImageSaveFormatLabel, transitionLabel } from "@/features/trip-clip/trip-clip-screen.helpers";
import { styles } from "@/features/trip-clip/trip-clip-screen.styles";

const initialExportProgress = {
  visible: false,
  percent: 0,
  title: "",
  detail: ""
};
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

type MusicMode = "none" | "device";
type ExportFormat = "mp4" | "images";
type ExportProgress = {
  visible: boolean;
  percent: number;
  title: string;
  detail: string;
  completedVideoId?: string;
  error?: string;
};
type SaveSelectedExportOptions = {
  returnToVideoWorks?: boolean;
};
type CustomMusic = {
  uri: string;
  name: string;
  mimeType?: string;
};
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
  const { bundleId, videoId } = useLocalSearchParams<{
    bundleId?: string;
    videoId?: string;
  }>();
  const isEditingMadeVideo = Boolean(videoId);
  const recorder = useOptionalViewRecorder();
  const { user, isLoggedIn, subscription } = useAuth();
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
  const [previewGuideVisible, setPreviewGuideVisible] = useState(false);
  const [previewGuide, setPreviewGuide] = useState<GuideType>("circle");
  const [previewGuideSize, setPreviewGuideSize] = useState(44);
  const [previewGuideSizeInput, setPreviewGuideSizeInput] = useState("44");
  const [previewGuideStrokeWidth, setPreviewGuideStrokeWidth] = useState(1);
  const [previewGuideColor, setPreviewGuideColor] = useState<string>(
    GUIDE_COLOR_OPTIONS[0].value
  );
  const [previewGuideOffsetX, setPreviewGuideOffsetX] = useState(0);
  const [previewGuideOffsetY, setPreviewGuideOffsetY] = useState(0);
  const [previewGridGuideLinePositions, setPreviewGridGuideLinePositions] =
    useState<GridGuideLinePositions>(defaultGridGuideLinePositions);
  const [previewGuideShapePoints, setPreviewGuideShapePoints] =
    useState<GuideShapePoints>(defaultGuideShapePoints);
  const previewGuideSizeBounds = useMemo(
    () => getGuideSizeBounds(previewGuide),
    [previewGuide]
  );
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
  const latestTripClipDraftRef = useRef<Omit<TripClipDraft, "updatedAt"> | null>(null);
  const restoredVideoIdRef = useRef<string | null>(null);
  const restoredBundleIdRef = useRef<string | null>(null);
  const autoDurationIdsRef = useRef<Set<string>>(new Set());
  const playbackOffsetRef = useRef(0);
  const playbackProgress = useSharedValue(0);
  const previewGuideOffsetXValue = useSharedValue(0);
  const previewGuideOffsetYValue = useSharedValue(0);
  const previewGuideDragStartX = useSharedValue(0);
  const previewGuideDragStartY = useSharedValue(0);

  const selectedUserMusic =
    userMusicTracks.find((track) => track.id === selectedUserMusicId) ??
    userMusicTracks[0];
  const customMusic = useMemo<CustomMusic | null>(() => {
    if (musicMode !== "device" || !selectedUserMusic) {
      return null;
    }

    return {
      uri: selectedUserMusic.uri,
      name: selectedUserMusic.name,
      mimeType: selectedUserMusic.mimeType
    };
  }, [musicMode, selectedUserMusic]);
  const activeMusicSource = useMemo<AudioSource | undefined>(() => {
    if (musicMode === "device") {
      return customMusic ? { uri: customMusic.uri, name: customMusic.name } : undefined;
    }

    return undefined;
  }, [customMusic, musicMode]);
  const activeMusicLabel =
    musicMode === "device"
      ? customMusic?.name ?? "내 음악 선택"
      : "무음";
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const weeklyVideoExportLimit = planEntitlements.weeklyVideoExportLimit;
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

  const selectedPhotos = useMemo(
    () =>
      selectedIds
        .map((id) => photos.find((photo) => photo.id === id))
        .filter((photo): photo is PhotoItem => Boolean(photo)),
    [photos, selectedIds]
  );

  const activePhoto = selectedPhotos[activeIndex] ?? selectedPhotos[0];
  const getFrameDuration = useCallback(
    (id: string, index: number) => durations[id] ?? getDefaultFrameDuration(index),
    [durations]
  );
  const totalDuration = calculateVideoDuration(selectedIds, getFrameDuration);
  const videoDurationTooLong = isVideoDurationTooLong(totalDuration);
  const selectedVideoQuality = getVideoQualityOption(videoQuality);
  const updatePhotoAdjustment = useCallback(
    (photoId: string, adjustment: TripClipPhotoAdjustment) => {
      setPhotoAdjustments((current) =>
        setTripClipPhotoAdjustment(current, photoId, adjustment)
      );
    },
    []
  );
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
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/studio?tab=videos" as Href);
  }, []);

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
  useEffect(() => {
    latestTripClipDraftRef.current = createTripClipDraftPayload();
  }, [createTripClipDraftPayload]);
  const recordingFrame = useMemo(
    () =>
      getRecordingFrame({
        frameIndex: recordingFrameIndex,
        fps: VIEW_RECORDER_FPS,
        photos: selectedPhotos,
        durations,
        transition,
        transitionDuration
      }),
    [durations, recordingFrameIndex, selectedPhotos, transition, transitionDuration]
  );

  const getStartTimeForIndex = useCallback(
    (index: number) =>
      selectedIds
        .slice(0, Math.max(0, index))
        .reduce((sum, id, itemIndex) => sum + getFrameDuration(id, itemIndex), 0),
    [getFrameDuration, selectedIds]
  );

  const getPlaybackPosition = useCallback(
    (seconds: number) => {
      const safeSeconds = Math.max(0, Math.min(totalDuration, seconds));
      let elapsed = 0;

      for (let index = 0; index < selectedIds.length; index += 1) {
        const id = selectedIds[index];
        const duration = getFrameDuration(id, index);
        const isLast = index === selectedIds.length - 1;

        if (safeSeconds < elapsed + duration || isLast) {
          return {
            index,
            offset: Math.max(0, Math.min(duration, safeSeconds - elapsed)),
            seconds: safeSeconds
          };
        }

        elapsed += duration;
      }

      return {
        index: 0,
        offset: 0,
        seconds: 0
      };
    },
    [getFrameDuration, selectedIds, totalDuration]
  );

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const [storedPhotos, settings, storedMusicTracks, storedWeeklyUsage] = await Promise.all([
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
          : getWeeklyVideoExportUsage(user, weeklyVideoExportLimit)
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
      setPreviewGuideOffsetX(settings.guideOffsetX);
      setPreviewGuideOffsetY(settings.guideOffsetY);
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

      setRatio(settings.defaultRatio);
      setSelectedIds((current) => {
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
      void updateAppSettings({
        guideOffsetX: clampedOffset.x,
        guideOffsetY: clampedOffset.y,
        guideVisible: true
      });
    },
    [getClampedPreviewGuideOffset, previewGuideOffsetXValue, previewGuideOffsetYValue]
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
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideOffsetX: 0,
      guideOffsetY: 0,
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
  }, [bundleId, isLoading, videoId]);

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

  const changeDuration = (id: string, index: number, delta: number) => {
    autoDurationIdsRef.current.delete(id);
    setDurations((current) => ({
      ...current,
      [id]: Math.max(
        0.5,
        Math.min(
          8,
          Number(((current[id] ?? getDefaultFrameDuration(index)) + delta).toFixed(1))
        )
      )
    }));
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
      <View style={styles.header}>
        <View style={styles.headerActionRow}>
          <Pressable
            style={styles.headerBackButton}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="보관함으로 돌아가기"
          >
            <Feather name="chevron-left" size={21} color={colors.text} />
            <Text selectable={false} style={styles.headerBackButtonText}>
              뒤로
            </Text>
          </Pressable>
          <View style={styles.headerSpacer} />
          <Pressable
            disabled={isLoading || isExporting}
            style={[
              styles.draftSaveButton,
              (isLoading || isExporting) && styles.disabledButton
            ]}
            onPress={handleHeaderSavePress}
          >
            <Text selectable={false} style={styles.draftSaveButtonText}>
              {isEditingMadeVideo ? "저장" : "임시 저장"}
            </Text>
          </Pressable>
        </View>
        <Text selectable style={styles.eyebrow}>
          여행클립 만들기
        </Text>
        <Text selectable style={styles.title}>
          동영상
        </Text>
        <Text selectable style={styles.description}>
          사진을 고르고 순서를 정한 뒤 템플릿과 음악을 적용해 앱 안에서 영상처럼 재생합니다.
        </Text>
        {availableDraft && showDraftPrompt ? (
          <View style={styles.draftPanel}>
            <View style={styles.draftCopy}>
              <Text selectable style={styles.draftTitle}>
                임시 저장된 영상 만들기 작업이 있습니다
              </Text>
              <Text selectable style={styles.draftDetail}>
                {formatDraftTime(availableDraft.updatedAt)} 작업 상태에서 이어서 편집할 수 있습니다.
              </Text>
            </View>
            <View style={styles.draftActions}>
              <Pressable style={styles.draftButton} onPress={resumeTripClipDraft}>
                <Text selectable={false} style={styles.draftButtonText}>
                  이어서 작업하기
                </Text>
              </Pressable>
              <Pressable style={styles.draftGhostButton} onPress={removeTripClipDraft}>
                <Text selectable={false} style={styles.draftGhostButtonText}>
                  삭제
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.workTitlePanel}>
          <Text selectable style={styles.settingLabel}>
            작업 이름
          </Text>
          <TextInput
            value={workTitle}
            placeholder="영상 만들기 이름"
            placeholderTextColor={colors.faint}
            style={styles.workTitleInput}
            onChangeText={setWorkTitle}
          />
        </View>
      </View>

      <View style={styles.previewSection}>
        <View
          style={[styles.previewFrame, { aspectRatio: ratioAspect[ratio] }]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewFrameSize({ width, height });
          }}
        >
          {activePhoto ? (
            <>
              <TripClipPreviewPlayer
                photo={activePhoto}
                template={template}
                transition={transition}
                transitionDuration={transitionDuration}
                frameAspectRatio={ratioAspect[ratio]}
                adjustEnabled={previewAdjustEnabled}
                guideVisible={previewGuideVisible}
                guide={previewGuide}
                guideSize={previewGuideSize}
                guideStrokeWidth={previewGuideStrokeWidth}
                guideColor={previewGuideColor}
                guideOffsetX={previewGuideOffsetX}
                guideOffsetY={previewGuideOffsetY}
                gridGuideLinePositions={previewGridGuideLinePositions}
                guideShapePoints={previewGuideShapePoints}
                photoAdjustments={photoAdjustments}
                onPhotoAdjustmentChange={updatePhotoAdjustment}
              />
              <Pressable
                style={[
                  styles.previewAdjustButton,
                  previewAdjustEnabled && styles.previewAdjustButtonActive
                ]}
                onPress={() => setPreviewAdjustEnabled((value) => !value)}
              >
                <Text
                  selectable={false}
                  style={[
                    styles.previewAdjustButtonText,
                    previewAdjustEnabled && styles.previewAdjustButtonTextActive
                  ]}
                >
                  드래그 조절 {previewAdjustEnabled ? "ON" : "OFF"}
                </Text>
              </Pressable>
              {isPreviewGuideMoving ? (
                <GestureDetector gesture={previewGuideMoveGesture}>
                  <View
                    collapsable={false}
                    pointerEvents="box-only"
                    style={styles.previewGuideMoveLayer}
                  >
                    <Text selectable={false} style={styles.previewGuideMoveText}>
                      가이드를 손가락으로 드래그하세요
                    </Text>
                  </View>
                </GestureDetector>
              ) : null}
            </>
          ) : (
            <Pressable
              disabled={isImportingPhotos}
              style={({ pressed }) => [
                styles.emptyPreview,
                pressed && styles.emptyPreviewPressed,
                isImportingPhotos && styles.disabledButton
              ]}
              onPress={pickPhotosFromPreview}
            >
              <Text selectable numberOfLines={2} style={styles.emptyPreviewText}>
                {isImportingPhotos ? "사진을 불러오는 중" : "사진을 선택하세요"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.previewMeta}>
          <Text selectable style={styles.previewTitle}>
            사진 {selectedPhotos.length}장 / {totalDuration.toFixed(1)}초
          </Text>
          <Text selectable style={styles.previewDetail}>
            {ratio} / {transitionLabel(transition)} / {activeMusicLabel}
          </Text>
          {videoDurationTooLong ? (
            <Text selectable style={styles.durationWarningText}>
              {VIDEO_DURATION_LIMIT_MESSAGE}
            </Text>
          ) : null}
        </View>

        <View style={styles.playbackPanel}>
          <View style={styles.playbackTopRow}>
            <View style={styles.playbackSide}>
              <Pressable
                disabled={selectedPhotos.length === 0}
                style={[
                  styles.playToggleButton,
                  selectedPhotos.length === 0 && styles.disabledButton
                ]}
                onPress={isPlaying ? stopPlayback : playClip}
              >
                <Text selectable={false} style={styles.playToggleText}>
                  {isPlaying ? "멈춤" : "재생"}
                </Text>
              </Pressable>
              <Pressable style={styles.restartButton} onPress={() => jumpPhoto(-1)}>
                <Text selectable={false} style={styles.restartButtonText}>
                  이전
                </Text>
              </Pressable>
            </View>
            <Text selectable style={styles.timeText}>
              {formatVideoDuration(progressSeconds)} / {formatVideoDuration(totalDuration)}
            </Text>
            <View style={[styles.playbackSide, styles.playbackSideRight]}>
              <Pressable style={styles.restartButton} onPress={() => jumpPhoto(1)}>
                <Text selectable={false} style={styles.restartButtonText}>
                  다음
                </Text>
              </Pressable>
              <Pressable style={styles.restartButton} onPress={resetPlayback}>
                <Text selectable={false} style={styles.restartButtonText}>
                  처음
                </Text>
              </Pressable>
            </View>
          </View>
          <TimelineScrubber
            progressSeconds={progressSeconds}
            progressValue={playbackProgress}
            totalDuration={totalDuration}
            onSeek={seekPreview}
          />
        </View>
      </View>

      {activeEditorTab === "photos" ? (
      <Section title="사진 선택">
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoPicker}
          >
            {photos.map((photo) => {
              const selectedIndex = selectedIds.indexOf(photo.id);
              const isSelected = selectedIndex >= 0;

              return (
                <Pressable
                  key={photo.id}
                  style={[styles.photoTile, isSelected && styles.photoTileActive]}
                  onPress={() => togglePhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                  <View style={styles.photoTileMeta}>
                    <Text selectable style={styles.photoTileText}>
                      {getPhotoLabel(photo)}
                    </Text>
                    <Text selectable style={styles.photoTileDetail}>
                      {photo.ratioLabel}
                    </Text>
                  </View>
                  {isSelected ? (
                    <>
                      <View style={styles.orderBadge}>
                        <Text selectable={false} style={styles.orderBadgeText}>
                          {selectedIndex + 1}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.removePhotoButton}
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          deselectPickerPhoto(photo);
                        }}
                      >
                        <Text selectable={false} style={styles.removePhotoButtonText}>
                          X
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </Pressable>
              );
            })}
            {renderAddPhotoTile()}
          </ScrollView>
        ) : (
          <View style={styles.emptyPhotoPicker}>
            <Text selectable style={styles.emptyText}>
              아직 사진이 없습니다. 먼저 사진을 촬영하거나 편집해 주세요.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoPicker}
            >
              {renderAddPhotoTile()}
            </ScrollView>
          </View>
        )}
      </Section>
      ) : null}

      {activeEditorTab === "timeline" ? (
      <Section title="타임라인">
        {selectedPhotos.length > 0 ? (
          <View style={styles.timeline}>
            {selectedPhotos.map((photo, index) => (
              <View key={photo.id} style={styles.timelineRow}>
                <Image source={{ uri: photo.uri }} style={styles.timelineThumb} contentFit="cover" />
                <View style={styles.timelineCopy}>
                  <Text selectable style={styles.timelineTitle}>
                    {String(index + 1).padStart(2, "0")} / {getPhotoLabel(photo)}
                  </Text>
                  <Text selectable style={styles.timelineDetail}>
                    {getFrameDuration(photo.id, index).toFixed(1)}s
                  </Text>
                </View>
                <View style={styles.smallControls}>
                  <View style={styles.controlLine}>
                    <Text selectable={false} style={styles.controlLabel}>
                      순서
                    </Text>
                    <SmallButton label="위" onPress={() => movePhoto(photo.id, -1)} />
                    <SmallButton label="아래" onPress={() => movePhoto(photo.id, 1)} />
                  </View>
                  <View style={styles.controlLine}>
                    <Text selectable={false} style={styles.controlLabel}>
                      타임
                    </Text>
                    <SmallButton label="-" onPress={() => changeDuration(photo.id, index, -0.5)} />
                    <SmallButton label="+" onPress={() => changeDuration(photo.id, index, 0.5)} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text selectable style={styles.emptyText}>
            타임라인을 만들려면 사진을 1장 이상 선택해 주세요.
          </Text>
        )}
      </Section>
      ) : null}

      {activeEditorTab === "video" ? (
      <Section title="영상 설정">
        <OptionRow>
          {TRIP_CLIP_RATIOS.map((item) => (
            <Chip
              key={item}
              label={item}
              active={ratio === item}
              onPress={() => updateTripClipRatio(item)}
            />
          ))}
        </OptionRow>
        <OptionRow>
          {TRIP_CLIP_TRANSITIONS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={transition === item.id}
              onPress={() => setTransition(item.id)}
            />
          ))}
        </OptionRow>
        {transition === "fade" ? (
          <>
            <Text selectable style={styles.settingDetail}>
              페이드 속도 {transitionDuration.toFixed(2)}초
            </Text>
            <OptionRow>
              {FADE_OPTIONS.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  active={transitionDuration === item.value}
                  onPress={() => setTransitionDuration(item.value)}
                />
              ))}
            </OptionRow>
          </>
        ) : null}
      </Section>
      ) : null}

      {activeEditorTab === "guide" ? (
      <Section title="가이드 설정">
        <View style={styles.guideSummaryPanel}>
          <View style={styles.guideSummaryCopy}>
            <Text selectable style={styles.settingDetail}>
              미리보기 사진 위에 카메라와 같은 구도 가이드를 표시합니다.
            </Text>
            <Text selectable style={styles.guideSummaryValue}>
              {previewGuideVisible ? "표시 중" : "숨김"} / {GUIDE_LABELS[previewGuide]} /{" "}
              {previewGuideSize} / {previewGuideStrokeWidth}px
            </Text>
          </View>
          <Pressable
            style={[
              styles.guideToggleButton,
              previewGuideVisible && styles.guideToggleButtonActive
            ]}
            onPress={() => updatePreviewGuideVisibility(!previewGuideVisible)}
          >
            <Text
              selectable={false}
              style={[
                styles.guideToggleButtonText,
                previewGuideVisible && styles.guideToggleButtonTextActive
              ]}
            >
              가이드 {previewGuideVisible ? "끄기" : "켜기"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.guideMoveActions}>
          <Pressable
            disabled={!activePhoto}
            style={[
              styles.guideMoveButton,
              isPreviewGuideMoving && styles.guideMoveButtonActive,
              !activePhoto && styles.disabledButton
            ]}
            onPress={isPreviewGuideMoving ? stopPreviewGuideMove : startPreviewGuideMove}
          >
            <Text
              selectable={false}
              style={[
                styles.guideMoveButtonText,
                isPreviewGuideMoving && styles.guideMoveButtonTextActive
              ]}
            >
              {isPreviewGuideMoving ? "이동 완료" : "드래그 이동하기"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.guideMoveButton}
            onPress={resetPreviewGuidePositionToCenter}
          >
            <Text selectable={false} style={styles.guideMoveButtonText}>
              중앙 이동
            </Text>
          </Pressable>
        </View>

        <Text selectable style={styles.settingLabel}>
          가이드라인
        </Text>
        <OptionRow>
          {GUIDE_TYPES.map((type) => (
            <Chip
              key={type}
              label={GUIDE_LABELS[type]}
              active={previewGuide === type}
              onPress={() => updatePreviewGuideType(type)}
            />
          ))}
        </OptionRow>

        <Text selectable style={styles.settingLabel}>
          크기
        </Text>
        <OptionRow>
          {GUIDE_SIZE_OPTIONS.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={previewGuideSize === item.value}
              onPress={() => applyPreviewGuideSize(item.value)}
            />
          ))}
        </OptionRow>
        <View style={styles.guideSizeInputRow}>
          <Text selectable style={styles.settingDetail}>
            {previewGuideSizeBounds.min}-{previewGuideSizeBounds.max}
          </Text>
          <TextInput
            value={previewGuideSizeInput}
            keyboardType="number-pad"
            maxLength={String(previewGuideSizeBounds.max).length}
            selectTextOnFocus
            style={styles.guideSizeInput}
            onChangeText={(value) =>
              setPreviewGuideSizeInput(value.replace(/[^0-9]/g, ""))
            }
            onBlur={commitPreviewGuideSizeInput}
            onSubmitEditing={commitPreviewGuideSizeInput}
          />
        </View>

        <Text selectable style={styles.settingLabel}>
          선 두께
        </Text>
        <OptionRow>
          {GUIDE_STROKE_WIDTH_OPTIONS.map((strokeWidth) => (
            <Chip
              key={strokeWidth}
              label={`${strokeWidth}px`}
              active={previewGuideStrokeWidth === strokeWidth}
              onPress={() => updatePreviewGuideStrokeWidth(strokeWidth)}
            />
          ))}
        </OptionRow>

        <Text selectable style={styles.settingLabel}>
          색상
        </Text>
        <View style={styles.guideColorRow}>
          {GUIDE_COLOR_OPTIONS.map((option) => {
            const isActive = previewGuideColor === option.value;

            return (
              <Pressable
                key={option.label}
                style={[styles.guideColorOption, isActive && styles.guideColorOptionActive]}
                onPress={() => updatePreviewGuideColor(option.value)}
              >
                <View
                  style={[
                    styles.guideColorSwatch,
                    { backgroundColor: option.value }
                  ]}
                />
                <Text selectable={false} style={styles.guideColorLabel}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
      ) : null}

      {activeEditorTab === "music" ? (
      <Section title="음악">
        <View style={styles.musicList}>
          <Pressable
            style={[styles.musicRow, musicMode === "none" && styles.musicRowActive]}
            onPress={() => {
              setMusicMode("none");
              setExportMessage(null);
            }}
          >
            <View style={styles.musicCopy}>
              <Text selectable style={styles.musicTitle}>
                무음
              </Text>
              <Text selectable style={styles.musicDetail}>
                배경음악 없이 사진 전환만 재생합니다.
              </Text>
            </View>
            {musicMode === "none" ? <View style={styles.musicMark} /> : null}
          </Pressable>
          {userMusicTracks.map((track) => {
            const isActive = musicMode === "device" && selectedUserMusic?.id === track.id;

            return (
              <Pressable
                key={track.id}
                style={[styles.musicRow, isActive && styles.musicRowActive]}
                onPress={() => {
                  setSelectedUserMusicId(track.id);
                  setMusicMode("device");
                  setExportMessage(null);
                }}
              >
                <View style={styles.musicCopy}>
                  <Text selectable style={styles.musicTitle}>
                    {track.name}
                  </Text>
                  <Text selectable style={styles.musicDetail}>
                    추가된 음악
                  </Text>
                </View>
                {isActive ? <View style={styles.musicMark} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            disabled={
              isMusicSubmitting ||
              planEntitlements.musicTrackLimit <= 0 ||
              userMusicTracks.length >= planEntitlements.musicTrackLimit
            }
            style={[
              styles.musicRow,
              styles.musicAddRow,
              (isMusicSubmitting ||
                planEntitlements.musicTrackLimit <= 0 ||
                userMusicTracks.length >= planEntitlements.musicTrackLimit) &&
                styles.disabledButton
            ]}
            onPress={handleAddUserMusic}
          >
            <View style={styles.musicCopy}>
              <Text selectable style={styles.musicTitle}>
                내 음악 추가
              </Text>
              <Text selectable style={styles.musicDetail}>
                파일 앱의 오디오에서 음악 파일을 선택합니다.
              </Text>
            </View>
            {isMusicSubmitting ? <ActivityIndicator color={colors.text} /> : null}
          </Pressable>
        </View>
        <View style={styles.volumeControls}>
          <Text selectable style={styles.musicTitle}>
            현재 음악
          </Text>
          <Text selectable style={styles.musicDetail}>
            {activeMusicLabel}
          </Text>
          <Pressable
            disabled={!activeMusicSource}
            style={[styles.musicPickButton, !activeMusicSource && styles.disabledButton]}
            onPress={() => {
              if (!activeMusicSource) {
                return;
              }

              if (isPlaying) {
                stopPlayback();
                return;
              }

              void playClip();
            }}
          >
            <Text selectable={false} style={styles.musicPickButtonText}>
              {isPlaying ? "정지" : "음악 미리듣기"}
            </Text>
          </Pressable>
        </View>
      </Section>
      ) : null}

      {activeEditorTab === "export" ? (
      <Section title="핸드폰에 저장">
        <View style={styles.exportPanel}>
          <Text selectable style={styles.exportDetail}>
            저장할 형식을 선택한 뒤 바로 핸드폰 앨범에 저장하거나 공유합니다.
          </Text>
          {exportFormat === "mp4" && !isLoggedIn ? (
            <Text selectable style={styles.exportNotice}>
              MP4 저장은 로그인 후 사용할 수 있습니다. 무료 로그인 사용자는 주 1개까지 만들 수 있습니다.
            </Text>
          ) : exportFormat === "mp4" && premiumExportActive ? (
            <Text selectable style={styles.exportNotice}>
              {planEntitlements.label} 이용 중입니다. MP4 영상을 주 {weeklyVideoExportLimit}회 저장하고 광고 없이 사용할 수 있습니다.
            </Text>
          ) : exportFormat === "mp4" ? (
            <Text selectable style={styles.exportNotice}>
              무료 MP4 저장은 주 1개까지 가능합니다.
              {weeklyVideoExportUsage
                ? ` 이번 주 남은 횟수는 ${weeklyVideoExportUsage.remaining}개입니다.`
                : " 저장 전 가능 횟수를 확인합니다."}
            </Text>
          ) : cloudBackupEnabled ? (
            <Text selectable style={styles.exportNotice}>
              클라우드 백업이 켜져 있어 저장한 작업물이 계정에도 백업됩니다.
            </Text>
          ) : (
            <Text selectable style={styles.exportNotice}>
              클라우드 백업은 설정에서 켤 수 있습니다. 꺼져 있으면 기기에만 저장됩니다.
            </Text>
          )}
          <View style={styles.exportFormatList}>
            {EXPORT_FORMAT_OPTIONS.map((option) => {
              const isActive = exportFormat === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.exportFormatOption, isActive && styles.exportFormatOptionActive]}
                  onPress={() => updateTripClipExportFormat(option.value)}
                >
                  <View style={styles.exportFormatCopy}>
                    <Text
                      selectable
                      style={[
                        styles.exportFormatTitle,
                        isActive && styles.exportFormatTitleActive
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      selectable
                      style={[
                        styles.exportFormatDetail,
                        isActive && styles.exportFormatDetailActive
                      ]}
                    >
                      {option.detail}
                    </Text>
                  </View>
                  <View style={[styles.exportFormatMark, isActive && styles.exportFormatMarkActive]} />
                </Pressable>
              );
            })}
          </View>
          {exportFormat === "mp4" ? (
            <>
              <View style={styles.imageFormatPanel}>
                <Text selectable style={styles.settingLabel}>
                  영상 화질
                </Text>
                <OptionRow>
                  {VIDEO_QUALITY_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      active={videoQuality === option.id}
                      onPress={() => updateTripClipVideoQuality(option.id)}
                    />
                  ))}
                </OptionRow>
                <Text selectable style={styles.settingDetail}>
                  {VIDEO_QUALITY_DESCRIPTION}
                </Text>
              </View>
              <Pressable
                disabled={!canBackupVideoExport}
                style={[
                  styles.videoBackupOption,
                  !canBackupVideoExport && styles.videoBackupOptionDisabled
                ]}
                onPress={() => {
                  setShouldBackupVideoExport((current) => !current);
                  setExportMessage(null);
                }}
              >
                <View
                  style={[
                    styles.videoBackupCheckbox,
                    shouldBackupVideoExport &&
                      canBackupVideoExport &&
                      styles.videoBackupCheckboxActive
                  ]}
                >
                  {shouldBackupVideoExport && canBackupVideoExport ? (
                    <Text selectable={false} style={styles.videoBackupCheckboxText}>
                      ✓
                    </Text>
                  ) : null}
                </View>
                <View style={styles.videoBackupCopy}>
                  <Text selectable style={styles.videoBackupTitle}>
                    클라우드 백업
                  </Text>
                  <Text selectable style={styles.videoBackupDetail}>
                    {cloudBackupEnabled && planEntitlements.canBackupToCloud && videoBackupTargetEnabled
                      ? `체크한 영상만 백업합니다. 남은 영상 백업 ${videoBackupRemaining}개 / ${videoBackupLimit}개`
                      : "구독과 클라우드 백업 설정이 켜져 있을 때 사용할 수 있습니다."}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}
          {exportFormat === "images" ? (
            <View style={styles.imageFormatPanel}>
              <Text selectable style={styles.settingLabel}>
                이미지 화질
              </Text>
              <OptionRow>
                {IMAGE_QUALITY_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={imageQuality === option.value}
                    onPress={() => updateImageQuality(option.value)}
                  />
                ))}
              </OptionRow>
              <Text selectable style={styles.settingDetail}>
                {IMAGE_QUALITY_DESCRIPTION}
              </Text>
              <Text selectable style={styles.settingLabel}>
                이미지 형식
              </Text>
              <View style={styles.imageFormatOptions}>
                {IMAGE_SAVE_FORMAT_OPTIONS.map((option) => {
                  const isActive = imageSaveFormat === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.imageFormatButton,
                        isActive && styles.imageFormatButtonActive
                      ]}
                      onPress={() => updateTripClipImageSaveFormat(option.value)}
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.imageFormatButtonText,
                          isActive && styles.imageFormatButtonTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text selectable style={styles.settingDetail}>
                {
                  IMAGE_SAVE_FORMAT_OPTIONS.find(
                    (option) => option.value === imageSaveFormat
                  )?.detail
                }
              </Text>
            </View>
          ) : null}
          <View style={styles.previewActions}>
            <Pressable
              android_disableSound
              disabled={isExporting || selectedPhotos.length === 0 || videoDurationTooLong}
              style={[
                styles.primaryButton,
                (isExporting || selectedPhotos.length === 0 || videoDurationTooLong) &&
                  styles.disabledButton
              ]}
              onPress={() => void saveSelectedExport()}
            >
              <Text selectable={false} style={styles.primaryButtonText}>
                {exportFormat === "mp4" && Platform.OS === "web"
                  ? "준비중"
                  : isExporting
                    ? "저장 중"
                    : exportFormat === "mp4"
                      ? "MP4 저장"
                      : "이미지 저장"}
              </Text>
            </Pressable>
            <Pressable
              android_disableSound
              disabled={
                isExporting ||
                selectedPhotos.length === 0 ||
                (exportFormat === "mp4" && videoDurationTooLong)
              }
              style={[
                styles.secondaryButton,
                (isExporting ||
                  selectedPhotos.length === 0 ||
                  (exportFormat === "mp4" && videoDurationTooLong)) &&
                  styles.disabledButton
              ]}
              onPress={shareSelectedExport}
            >
              <Text selectable={false} style={styles.secondaryButtonText}>
                공유
              </Text>
            </Pressable>
          </View>
          {exportMessage ? (
            <Text selectable style={styles.exportMessage}>
              {exportMessage}
            </Text>
          ) : null}
        </View>
      </Section>
      ) : null}
      </ScrollView>
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
              guideVisible={previewGuideVisible}
              guide={previewGuide}
              guideSize={previewGuideSize}
              guideStrokeWidth={previewGuideStrokeWidth}
              guideColor={previewGuideColor}
              guideOffsetX={previewGuideOffsetX}
              guideOffsetY={previewGuideOffsetY}
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
            </ScrollView>
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
            <View style={styles.exportModalActions}>
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

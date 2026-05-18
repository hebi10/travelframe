import { Image } from "expo-image";
import { useAudioPlayer, type AudioSource } from "expo-audio";
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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InterstitialAdModal } from "@/components/interstitial-ad-modal";
import { TripClipPreviewPlayer } from "@/components/trip-clip-preview-player";
import { colors, controls, spacing, typography } from "@/constants/app-theme";
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
  type ImageSaveFormat,
  saveImageToLibrary,
  saveVideoToLibrary,
  shareImage,
  shareVideo
} from "@/lib/trip-clip-export";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  getAppSettings,
  updateAppSettings
} from "@/lib/app-settings";
import {
  deletePhoto,
  ensurePhotoPreviews,
  getPhotos,
  saveCapturedPhoto
} from "@/lib/photo-library";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { getMadeVideoById, saveMadeVideo } from "@/lib/video-library";
import {
  getImageBundleWorkById,
  saveImageBundleWork,
  updateImageBundleWork
} from "@/lib/work-library";
import { useAuth } from "@/lib/auth-context";
import {
  isRecordingViewAvailable,
  OptionalRecordingView,
  useOptionalViewRecorder
} from "@/lib/view-recorder";
import { backupImageBundleWork, backupMadeVideo } from "@/lib/cloud-backup";
import { shouldShowAds } from "@/lib/ad-entitlement";
import { isCreatorSubscriptionActive } from "@/lib/subscription";
import {
  getWeeklyVideoExportUsage,
  releaseWeeklyVideoExport,
  reserveWeeklyVideoExport,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import {
  syncUserMusicTracks,
  type UserMusicTrack
} from "@/lib/user-music";
import type { PhotoItem } from "@/types/photo";

const DEFAULT_DURATION = 2.5;
const FIRST_FRAME_DURATION = Math.max(0.5, DEFAULT_DURATION - 0.5);
const initialExportProgress = {
  visible: false,
  percent: 0,
  title: "",
  detail: ""
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
type CustomMusic = {
  uri: string;
  name: string;
  mimeType?: string;
};
type EditorTab = "photos" | "timeline" | "video" | "guide" | "music" | "export";

const MUSIC_MODE_OPTIONS: { label: string; value: MusicMode }[] = [
  { label: "무음", value: "none" },
  { label: "내 음악", value: "device" }
];

const EXPORT_FORMAT_OPTIONS: {
  label: string;
  value: ExportFormat;
  detail: string;
}[] = [
  {
    label: "이미지 저장",
    value: "images",
    detail: "선택한 사진을 각각 개별 이미지로 저장합니다."
  },
  {
    label: "MP4 영상",
    value: "mp4",
    detail: "사진, 전환 효과, 음악을 영상으로 저장합니다."
  }
];

const IMAGE_SAVE_FORMAT_OPTIONS: {
  label: string;
  value: ImageSaveFormat;
  detail: string;
}[] = [
  {
    label: "원본 형식",
    value: "original",
    detail: "추가 압축 없이 현재 앱에 저장된 이미지 파일을 그대로 저장합니다."
  },
  {
    label: "PNG",
    value: "png",
    detail: "무손실 PNG로 변환해 저장합니다."
  },
  {
    label: "JPG",
    value: "jpeg",
    detail: "호환성이 높은 JPG로 저장합니다."
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
const RECORDING_VIEW_WIDTH = 360;

const ratioAspect: Record<TripClipRatio, number> = {
  "9:16": 9 / 16,
  "4:5": 4 / 5,
  "1:1": 1,
  "16:9": 16 / 9,
  "3:4": 3 / 4
};

const recordingOutputSize: Record<TripClipRatio, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "4:5": { width: 864, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1280, height: 720 },
  "3:4": { width: 810, height: 1080 }
};

type RecordingFrame = {
  currentPhoto: PhotoItem | null;
  nextPhoto: PhotoItem | null;
  transitionProgress: number;
};

const getPhotoLabel = (photo: PhotoItem) =>
  photo.kind === "edited" ? "편집 사진" : "원본 사진";

const getPreviewUri = (photo: PhotoItem) => photo.previewUri ?? photo.uri;

const getDefaultFrameDuration = (index: number) =>
  index === 0 ? FIRST_FRAME_DURATION : DEFAULT_DURATION;

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

const getRecordingFrame = ({
  frameIndex,
  fps,
  photos,
  durations,
  transition,
  transitionDuration
}: {
  frameIndex: number;
  fps: number;
  photos: PhotoItem[];
  durations: Record<string, number>;
  transition: TripClipTransition;
  transitionDuration: number;
}): RecordingFrame => {
  if (photos.length === 0) {
    return {
      currentPhoto: null,
      nextPhoto: null,
      transitionProgress: 0
    };
  }

  const seconds = frameIndex / fps;
  let elapsed = 0;

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const duration = durations[photo.id] ?? getDefaultFrameDuration(index);
    const isLast = index === photos.length - 1;

    if (seconds < elapsed + duration || isLast) {
      const localSeconds = Math.max(0, Math.min(duration, seconds - elapsed));
      const nextPhoto = photos[index + 1] ?? null;
      const transitionWindow =
        transition === "none" || !nextPhoto
          ? 0
          : Math.max(0.1, Math.min(transitionDuration, duration * 0.5));
      const transitionStart = duration - transitionWindow;
      const transitionProgress =
        transitionWindow > 0 && localSeconds >= transitionStart
          ? Math.max(0, Math.min(1, (localSeconds - transitionStart) / transitionWindow))
          : 0;

      return {
        currentPhoto: photo,
        nextPhoto: transitionProgress > 0 ? nextPhoto : null,
        transitionProgress
      };
    }

    elapsed += duration;
  }

  return {
    currentPhoto: photos[photos.length - 1] ?? null,
    nextPhoto: null,
    transitionProgress: 0
  };
};

const formatClipTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

export default function TripClipScreen() {
  const { bundleId, videoId } = useLocalSearchParams<{
    bundleId?: string;
    videoId?: string;
  }>();
  const recorder = useOptionalViewRecorder();
  const { user, isLoggedIn, subscription } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 12, 28);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [ratio, setRatio] = useState<TripClipRatio>("9:16");
  const [template, setTemplate] = useState<TripClipTemplate>("minimal");
  const [transition, setTransition] = useState<TripClipTransition>("fade");
  const [transitionDuration, setTransitionDuration] = useState(0.45);
  const [musicMode, setMusicMode] = useState<MusicMode>("none");
  const [userMusicTracks, setUserMusicTracks] = useState<UserMusicTrack[]>([]);
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
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>("photos");
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setIsMusicPreviewing] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("images");
  const [imageSaveFormat, setImageSaveFormat] =
    useState<ImageSaveFormat>("original");
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [workTitle, setWorkTitle] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [renderedVideoUri, setRenderedVideoUri] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
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
  const autoDurationIdsRef = useRef<Set<string>>(new Set());
  const playbackOffsetRef = useRef(0);
  const playbackProgress = useSharedValue(0);

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
  const creatorExportActive = isCreatorSubscriptionActive(subscription);
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
  const totalDuration = selectedIds.reduce(
    (sum, id, index) => sum + getFrameDuration(id, index),
    0
  );
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
    const [storedPhotos, settings, storedMusicTracks, storedWeeklyUsage] = await Promise.all([
      getPhotos().then(ensurePhotoPreviews),
      getAppSettings(),
      user ? syncUserMusicTracks(user) : Promise.resolve([]),
      getWeeklyVideoExportUsage(user)
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
    setCloudBackupEnabled(settings.cloudBackupEnabled);

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
        restoredVideoIdRef.current = videoId;
        setIsLoading(false);
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
        setIsLoading(false);
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
    setIsLoading(false);
  }, [bundleId, user, videoId]);

  const applyPreviewGuideSize = useCallback((value: number) => {
    const nextSize = Math.round(
      Math.max(GUIDE_SIZE_MIN, Math.min(GUIDE_SIZE_MAX, value))
    );
    setPreviewGuideSize(nextSize);
    setPreviewGuideSizeInput(String(nextSize));
    setPreviewGuideVisible(true);
    void updateAppSettings({
      guideSize: nextSize,
      guideVisible: true
    });
  }, []);

  const updatePreviewGuideType = (nextGuide: GuideType) => {
    setPreviewGuide(nextGuide);
    setPreviewGuideVisible(true);
    void updateAppSettings({
      defaultGuide: nextGuide,
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
  }, [customMusic?.uri, musicMode, selectedUserMusicId]);

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

  const deletePickerPhoto = (photo: PhotoItem) => {
    Alert.alert("사진을 삭제할까요?", "앱에 저장된 사진 목록에서 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePhoto(photo.id);
            setPhotos((current) => current.filter((item) => item.id !== photo.id));
            setSelectedIds((current) => current.filter((id) => id !== photo.id));
            setDurations((current) => {
              const next = { ...current };
              delete next[photo.id];
              return next;
            });
            setActiveIndex((current) =>
              Math.max(0, Math.min(current, selectedIds.length - 2))
            );
            setExportMessage("사진을 삭제했습니다.");
          } catch (error) {
            setExportMessage(getUserFacingErrorMessage(error, "사진을 삭제하지 못했습니다."));
          }
        }
      }
    ]);
  };

  const pickPhotosFromPreview = async () => {
    if (isImportingPhotos) {
      return;
    }

    try {
      setIsImportingPhotos(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);

      if (!permission.granted) {
        setExportMessage("사진을 선택하려면 앨범 접근 권한이 필요합니다.");
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
            height: asset.height
          })
        )
      );

      setPhotos((current) => [...savedPhotos, ...current]);
      setSelectedIds((current) => [
        ...current,
        ...savedPhotos
          .map((photo) => photo.id)
          .filter((id) => !current.includes(id))
      ]);
      setActiveIndex(0);
      setExportMessage(null);
    } catch (error) {
      setExportMessage(getUserFacingErrorMessage(error, "사진을 선택하지 못했습니다."));
    } finally {
      setIsImportingPhotos(false);
    }
  };

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
        "MP4 저장 기능이 현재 앱에 연결되지 않았습니다. 최신 Android 개발 빌드를 설치한 뒤 다시 시도해 주세요."
      );
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error("영상 파일을 만들 임시 저장소를 찾지 못했습니다.");
    }

    const totalFrames = Math.max(1, Math.ceil(totalDuration * VIEW_RECORDER_FPS));
    const outputSize = recordingOutputSize[ratio];
    const outputUri = `${FileSystem.cacheDirectory}trip-clip-${Date.now()}.mp4`;
    const output = toNativeFilePath(outputUri);
    const audioFilePath =
      musicMode === "device" && customMusic?.uri?.startsWith("file")
        ? toNativeFilePath(customMusic.uri)
        : null;

    await preloadSelectedPreviewImages();
    setRecordingFrameIndex(0);
    await waitForPaint();
    onProgress?.(12, "기기 안에서 영상 저장을 준비하고 있습니다.");

    const recordedPath = await recorder.record({
      output,
      fps: VIEW_RECORDER_FPS,
      totalFrames,
      width: outputSize.width,
      height: outputSize.height,
      codec: "h264",
      quality: 0.92,
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
          `기기 안에서 MP4 영상을 만들고 있습니다. ${framesEncoded}/${totalFrames}`
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
          "react-native-view-recorder가 현재 앱에 연결되지 않았습니다. EAS Android 개발 빌드를 설치한 뒤 다시 실행해 주세요."
        );
      }

      throw error;
    }
  };

  const saveSelectedExport = async () => {
    if (exportFormat !== "mp4") {
      await executeSelectedExport();
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

    if (creatorExportActive) {
      await executeSelectedExport();
      return;
    }

    try {
      const usage = await getWeeklyVideoExportUsage(user);
      setWeeklyVideoExportUsage(usage);

      if (usage && usage.remaining <= 0) {
        setExportMessage("이번 주 무료 MP4 저장 횟수를 모두 사용했습니다.");
        setExportProgress({
          visible: true,
          percent: 100,
          title: "무료 저장 한도 초과",
          detail: "무료 로그인 사용자는 MP4 영상을 주 1개까지 만들 수 있습니다.",
          error: `이번 주(${usage.weekLabel}) 무료 저장 1회를 이미 사용했습니다. 영상 내보내기 플랜을 이용하면 제한 없이 만들 수 있습니다.`
        });
        return;
      }

      await executeSelectedExport({ countWeeklyMp4: true });
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
    countWeeklyMp4 = false
  }: {
    countWeeklyMp4?: boolean;
  } = {}) => {
    if (exportFormat === "mp4" && Platform.OS === "web") {
      setIsExportComingSoonVisible(true);
      return;
    }

    if (selectedPhotos.length === 0 || isExporting) {
      setExportMessage("저장하기 전에 사진을 선택해 주세요.");
      return;
    }

    let reservedWeeklyExport = false;

    try {
      setIsExporting(true);
      setExportProgress({
        visible: true,
        percent: 5,
        title: "저장 준비 중",
        detail: "선택한 저장 형식을 확인하고 있습니다."
      });

      if (countWeeklyMp4 && exportFormat === "mp4" && user) {
        await reserveWeeklyVideoExport(user);
        reservedWeeklyExport = true;
        setWeeklyVideoExportUsage(await getWeeklyVideoExportUsage(user));
      }

      if (exportFormat === "images") {
        if (selectedPhotos.length === 0) {
          setExportMessage("저장할 이미지가 없습니다.");
          return;
        }

        const savedImageUris: string[] = [];

        for (let index = 0; index < selectedPhotos.length; index += 1) {
          const photo = selectedPhotos[index];
          const percent = Math.round(((index + 1) / selectedPhotos.length) * 90);

          setExportProgress({
            visible: true,
            percent: Math.max(12, percent),
            title: "이미지 저장 중",
            detail: `선택한 사진 ${selectedPhotos.length}장 중 ${index + 1}장을 저장하고 있습니다.`
          });
          await saveImageToLibrary(photo.uri, imageSaveFormat);
          savedImageUris.push(photo.uri);
        }

        const normalizedWorkTitle = workTitle.trim();
        const bundlePayload = {
          coverUri: selectedPhotos[0]?.uri,
          ratio,
          photoIds: selectedPhotos.map((photo) => photo.id),
          imageUris: savedImageUris,
          ...(normalizedWorkTitle ? { title: normalizedWorkTitle } : {})
        };

        let savedBundle = null;
        if (bundleId) {
          const updatedBundle = await updateImageBundleWork(bundleId, bundlePayload);
          if (!updatedBundle) {
            savedBundle = await saveImageBundleWork(bundlePayload);
          } else {
            savedBundle = updatedBundle;
          }
        } else {
          savedBundle = await saveImageBundleWork(bundlePayload);
        }

        let backupWarning: string | null = null;

        if (savedBundle && cloudBackupEnabled && user && isCreatorSubscriptionActive(subscription)) {
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
              enabled: cloudBackupEnabled
            });
          } catch (backupError) {
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
        setExportProgress({
          visible: true,
          percent: 100,
          title: "저장 실패",
          detail: "영상을 만들 준비가 완료되지 않았습니다.",
          error: "사진 선택이나 저장 설정을 다시 확인해 주세요."
        });
        return;
      }

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
        title: "목록에 추가 중",
        detail: "저장한 영상을 작업물 목록에 등록하고 있습니다."
      });
      const savedVideo = await saveMadeVideo({
        uri: videoUri,
        coverUri: activePhoto?.uri,
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
      });
      let backupWarning: string | null = null;

      if (cloudBackupEnabled && user && isCreatorSubscriptionActive(subscription)) {
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
            enabled: cloudBackupEnabled
          });
        } catch (backupError) {
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
          ? "저장한 영상은 작업물 목록에서 확인할 수 있고, 클라우드 백업은 나중에 다시 시도할 수 있습니다."
          : "저장한 영상을 작업물 목록에서 확인할 수 있습니다.",
        completedVideoId: savedVideo.id
      });
      if (reservedWeeklyExport && user) {
        setWeeklyVideoExportUsage(await getWeeklyVideoExportUsage(user));
      }
      if (shouldShowAds(subscription)) {
        setIsPostSaveAdVisible(true);
      }
    } catch (error) {
      if (reservedWeeklyExport && user) {
        await releaseWeeklyVideoExport(user).catch(() => undefined);
        setWeeklyVideoExportUsage(await getWeeklyVideoExportUsage(user).catch(() => null));
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

        await shareImage(activePhoto.uri);
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
        <Text selectable style={styles.eyebrow}>
          여행 클립
        </Text>
        <Text selectable style={styles.title}>
          다중 편집
        </Text>
        <Text selectable style={styles.description}>
          사진을 고르고 순서를 정한 뒤 템플릿과 음악을 적용해 앱 안에서 영상처럼 재생합니다.
        </Text>
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
        <View style={[styles.previewFrame, { aspectRatio: ratioAspect[ratio] }]}>
          {activePhoto ? (
            <>
              <TripClipPreviewPlayer
                photo={activePhoto}
                template={template}
                transition={transition}
                transitionDuration={transitionDuration}
                adjustEnabled={previewAdjustEnabled}
                guideVisible={previewGuideVisible}
                guide={previewGuide}
                guideSize={previewGuideSize}
                guideStrokeWidth={previewGuideStrokeWidth}
                guideColor={previewGuideColor}
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
              <Text selectable style={styles.emptyPreviewText}>
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
              {formatClipTime(progressSeconds)} / {formatClipTime(totalDuration)}
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
                          deletePickerPhoto(photo);
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
              onPress={() => setRatio(item)}
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
            {GUIDE_SIZE_MIN}-{GUIDE_SIZE_MAX}
          </Text>
          <TextInput
            value={previewGuideSizeInput}
            keyboardType="number-pad"
            maxLength={2}
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
          <View style={styles.musicModeRow}>
            {MUSIC_MODE_OPTIONS.map((item) => {
              const isActive = musicMode === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => {
                    if (item.value === "device" && userMusicTracks.length === 0) {
                      setExportMessage("마이페이지에서 내 음악을 먼저 추가해 주세요.");
                    }
                    setMusicMode(item.value);
                  }}
                >
                  <Text
                    selectable={false}
                    style={[styles.chipText, isActive && styles.chipTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {musicMode === "none" ? (
            <View style={[styles.musicRow, styles.musicRowActive]}>
              <View style={styles.musicCopy}>
                <Text selectable style={styles.musicTitle}>
                  무음
                </Text>
                <Text selectable style={styles.musicDetail}>
                  배경음악 없이 사진 전환만 재생합니다.
                </Text>
              </View>
              <View style={styles.musicMark} />
            </View>
          ) : null}
          {musicMode === "device" ? (
            <View style={styles.musicUserPanel}>
              {userMusicTracks.length > 0 ? (
                userMusicTracks.map((track) => {
                  const isActive = selectedUserMusic?.id === track.id;

                  return (
                    <Pressable
                      key={track.id}
                      style={[styles.musicRow, isActive && styles.musicRowActive]}
                      onPress={() => setSelectedUserMusicId(track.id)}
                    >
                      <View style={styles.musicCopy}>
                        <Text selectable style={styles.musicTitle}>
                          {track.name}
                        </Text>
                        <Text selectable style={styles.musicDetail}>
                          마이페이지에 저장한 내 음악입니다.
                        </Text>
                      </View>
                      {isActive ? <View style={styles.musicMark} /> : null}
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.musicComingSoonCard}>
                  <Text selectable style={styles.musicTitle}>
                    저장한 음악이 없습니다
                  </Text>
                  <Text selectable style={styles.musicDetail}>
                    마이페이지에서 핸드폰 음악을 최대 3개까지 추가한 뒤 이곳에서 선택할 수 있습니다.
                  </Text>
                  <Pressable
                    style={styles.musicPickButton}
                    onPress={() => router.push("/account" as Href)}
                  >
                    <Text selectable={false} style={styles.musicPickButtonText}>
                      마이페이지로 이동
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}
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
          ) : exportFormat === "mp4" && creatorExportActive ? (
            <Text selectable style={styles.exportNotice}>
              영상 내보내기 플랜 이용 중입니다. MP4 영상을 제한 없이 저장할 수 있습니다.
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
                  onPress={() => {
                    setExportFormat(option.value);
                    setExportMessage(null);
                  }}
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
          {exportFormat === "images" ? (
            <View style={styles.imageFormatPanel}>
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
                      onPress={() => setImageSaveFormat(option.value)}
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
              disabled={isExporting}
              style={[
                styles.primaryButton,
                isExporting && styles.disabledButton
              ]}
              onPress={saveSelectedExport}
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
              disabled={isExporting || selectedPhotos.length === 0}
              style={[
                styles.secondaryButton,
                (isExporting || selectedPhotos.length === 0) && styles.disabledButton
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
              showWatermark={!creatorExportActive}
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
        <View style={styles.exportModalBackdrop}>
          <ScrollView
            style={[
              styles.exportModalPanel,
              exportProgress.error && styles.exportModalPanelError
            ]}
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
      </Modal>
      <Modal
        visible={isExportComingSoonVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsExportComingSoonVisible(false)}
      >
        <View style={styles.exportModalBackdrop}>
          <View style={[styles.exportModalPanel, styles.comingSoonPanel]}>
            <Text style={styles.exportModalTitle}>
              준비중입니다
            </Text>
            <Text style={styles.exportModalDetail}>
              핸드폰에 바로 저장하는 기능은 준비 중입니다. 지금은 미리보기와 편집 흐름을 먼저 사용할 수 있습니다.
            </Text>
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
    </View>
  );
}

function TripClipRecordingCanvas({
  frame,
  template,
  transition,
  showWatermark
}: {
  frame: RecordingFrame;
  template: TripClipTemplate;
  transition: TripClipTransition;
  showWatermark: boolean;
}) {
  const isFilm = template === "film-log";
  const isCenter = template === "center-cut";
  const contentFit = isFilm || isCenter ? "contain" : "cover";
  const progress = frame.transitionProgress;
  const nextLayerStyle =
    transition === "slide"
      ? { opacity: progress > 0 ? 1 : 0, transform: [{ translateX: (1 - progress) * 44 }] }
      : transition === "zoom"
        ? { opacity: progress > 0 ? 1 : 0, transform: [{ scale: 1.08 - progress * 0.08 }] }
        : { opacity: transition === "fade" ? progress : progress > 0 ? 1 : 0 };

  return (
    <View style={[styles.recordingCanvasInner, isFilm && styles.recordingCanvasFilm]}>
      {frame.currentPhoto ? (
        <View style={styles.recordingLayer}>
          <Image
            source={{ uri: getPreviewUri(frame.currentPhoto) }}
            style={[styles.recordingImage, isFilm && styles.recordingImageFilm]}
            contentFit={contentFit}
            cachePolicy="memory-disk"
          />
        </View>
      ) : null}
      {frame.nextPhoto ? (
        <View style={[styles.recordingLayer, styles.recordingNextLayer, nextLayerStyle]}>
          <Image
            source={{ uri: getPreviewUri(frame.nextPhoto) }}
            style={[styles.recordingImage, isFilm && styles.recordingImageFilm]}
            contentFit={contentFit}
            cachePolicy="memory-disk"
          />
        </View>
      ) : null}
      {isFilm ? (
        <View style={styles.recordingFilmMeta}>
          <Text selectable={false} style={styles.recordingFilmText}>
            트래블프레임
          </Text>
          <Text selectable={false} style={styles.recordingFilmText}>
            구도 편집
          </Text>
        </View>
      ) : null}
      {isCenter ? <View style={styles.recordingCenterGuide} /> : null}
      {showWatermark ? (
        <View style={styles.recordingWatermark}>
          <Text selectable={false} style={styles.recordingWatermarkText}>
            트래블프레임
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text selectable style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function OptionRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.optionRow}>{children}</View>;
}

function Chip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text selectable={false} style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TimelineScrubber({
  progressSeconds,
  progressValue,
  totalDuration,
  onSeek
}: {
  progressSeconds: number;
  progressValue: SharedValue<number>;
  totalDuration: number;
  onSeek: (seconds: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progressRatio =
    totalDuration > 0 ? Math.max(0, Math.min(1, progressSeconds / totalDuration)) : 0;
  const progress = useSharedValue(progressRatio);
  const isScrubbing = useSharedValue(false);

  useEffect(() => {
    if (isScrubbing.value) {
      return;
    }

    progress.value = progressRatio;
    progressValue.value = progressSeconds;
  }, [isScrubbing, progress, progressRatio, progressSeconds, progressValue]);

  const commitSeek = useCallback(
    (ratio: number) => {
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration]
  );

  const scrubberGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(trackWidth > 0 && totalDuration > 0)
        .minDistance(0)
        .onBegin((event) => {
          isScrubbing.value = true;
          const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
          progress.value = ratio;
          progressValue.value = ratio * totalDuration;
        })
        .onUpdate((event) => {
          const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
          progress.value = ratio;
          progressValue.value = ratio * totalDuration;
        })
        .onFinalize(() => {
          isScrubbing.value = false;
          runOnJS(commitSeek)(progress.value);
        }),
    [commitSeek, isScrubbing, progress, progressValue, totalDuration, trackWidth]
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${(totalDuration > 0 ? progressValue.value / totalDuration : progress.value) * 100}%`
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${(totalDuration > 0 ? progressValue.value / totalDuration : progress.value) * 100}%`
  }));

  return (
    <GestureDetector gesture={scrubberGesture}>
      <Reanimated.View
        style={styles.scrubber}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.scrubberBase} />
        <Reanimated.View style={[styles.scrubberFill, fillStyle]} />
        <Reanimated.View style={[styles.scrubberThumb, thumbStyle]} />
      </Reanimated.View>
    </GestureDetector>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.smallButton} onPress={onPress}>
      <Text selectable={false} style={styles.smallButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

const transitionLabel = (id: TripClipTransition) =>
  TRIP_CLIP_TRANSITIONS.find((item) => item.id === id)?.label ?? id;

const getImageSaveFormatLabel = (format: ImageSaveFormat) =>
  IMAGE_SAVE_FORMAT_OPTIONS.find((item) => item.value === format)?.label ?? "원본 형식";

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  recordingHost: {
    position: "absolute",
    top: 0,
    left: -10000,
    width: RECORDING_VIEW_WIDTH,
    zIndex: -1
  },
  recordingView: {
    overflow: "hidden",
    backgroundColor: colors.ink
  },
  recordingCanvasInner: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.ink
  },
  recordingCanvasFilm: {
    padding: 22
  },
  recordingLayer: {
    ...StyleSheet.absoluteFillObject
  },
  recordingNextLayer: {
    zIndex: 2
  },
  recordingImage: {
    width: "100%",
    height: "100%"
  },
  recordingImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  recordingFilmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  recordingFilmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  recordingCenterGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  },
  recordingWatermark: {
    position: "absolute",
    right: 18,
    bottom: 18,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0, 0, 0, 0.52)"
  },
  recordingWatermarkText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    gap: spacing.section,
    padding: spacing.screen,
    paddingBottom: spacing.section
  },
  header: {
    gap: 10,
    paddingTop: 6
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 35,
    letterSpacing: 0
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    letterSpacing: 0
  },
  workTitlePanel: {
    gap: 8,
    paddingTop: 4
  },
  workTitleInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0,
    backgroundColor: colors.background
  },
  previewSection: {
    gap: 12
  },
  previewFrame: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.ink,
    position: "relative"
  },
  previewAdjustButton: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.88)"
  },
  previewAdjustButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  previewAdjustButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewAdjustButtonTextActive: {
    color: colors.inverse
  },
  previewInner: {
    flex: 1,
    backgroundColor: colors.ink,
    position: "relative"
  },
  previewInnerFilm: {
    padding: 22
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  previewGestureLayer: {
    flex: 1
  },
  previewPreviousLayer: {
    ...StyleSheet.absoluteFillObject
  },
  previewImageMotionLayer: {
    flex: 1
  },
  previewImageFilm: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  emptyPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyPreviewPressed: {
    backgroundColor: "#161616"
  },
  emptyPreviewText: {
    color: colors.inverse,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewMeta: {
    gap: 4
  },
  previewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0
  },
  previewDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  previewActions: {
    flexDirection: "row",
    gap: 10
  },
  playbackPanel: {
    gap: 10,
    paddingTop: 2
  },
  playbackTopRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  playbackSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  playbackSideRight: {
    justifyContent: "flex-end"
  },
  playToggleButton: {
    minWidth: 56,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  playToggleText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  timeText: {
    width: 92,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  restartButton: {
    minWidth: 48,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  restartButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  scrubber: {
    height: 32,
    justifyContent: "center"
  },
  scrubberBase: {
    height: 2,
    backgroundColor: colors.line
  },
  scrubberFill: {
    position: "absolute",
    left: 0,
    height: 2,
    backgroundColor: colors.text
  },
  scrubberThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  primaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  primaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  secondaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
    letterSpacing: 0
  },
  loading: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center"
  },
  photoPicker: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 8
  },
  emptyPhotoPicker: {
    gap: 12
  },
  photoTile: {
    width: 124,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  photoTileActive: {
    borderColor: colors.text
  },
  addPhotoTile: {
    minHeight: 176,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: colors.background
  },
  addPhotoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text
  },
  addPhotoIconText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: 0
  },
  addPhotoTitle: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  addPhotoDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  photoThumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surface
  },
  photoTileMeta: {
    gap: 3,
    minHeight: 54,
    padding: 8
  },
  photoTileText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  photoTileDetail: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0
  },
  orderBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  orderBadgeText: {
    color: colors.inverse,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  removePhotoButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  removePhotoButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
    letterSpacing: 0
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  timeline: {
    gap: 10
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  timelineThumb: {
    width: 48,
    height: 60,
    backgroundColor: colors.surface
  },
  timelineCopy: {
    flex: 1,
    gap: 4
  },
  timelineTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    letterSpacing: 0
  },
  timelineDetail: {
    color: colors.muted,
    fontSize: typography.small,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  smallControls: {
    gap: 6,
    width: 134
  },
  controlLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  controlLabel: {
    minWidth: 28,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  smallButton: {
    minWidth: 34,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  settingDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  settingLabel: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideSummaryPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  guideSummaryCopy: {
    flex: 1,
    gap: 5
  },
  guideSummaryValue: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideToggleButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  guideToggleButtonActive: {
    backgroundColor: colors.text
  },
  guideToggleButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  guideToggleButtonTextActive: {
    color: colors.inverse
  },
  guideSizeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  guideSizeInput: {
    width: 64,
    minHeight: controls.height,
    borderWidth: 1,
    borderColor: colors.text,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0
  },
  guideColorRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 4
  },
  guideColorOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideColorOptionActive: {
    borderColor: colors.text
  },
  guideColorSwatch: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.darkLine
  },
  guideColorLabel: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0
  },
  chip: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  chipText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  chipTextActive: {
    color: colors.inverse
  },
  musicList: {
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  musicModeRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12
  },
  musicUserPanel: {
    gap: 8
  },
  musicRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.background
  },
  musicRowActive: {
    borderColor: colors.text,
    backgroundColor: colors.surface
  },
  musicComingSoonCard: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  musicComingSoonModes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  musicComingSoonMode: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  musicComingSoonModeText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicCopy: {
    flex: 1,
    gap: 4,
    paddingLeft: 8
  },
  musicTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    letterSpacing: 0
  },
  musicDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  musicMark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text
  },
  musicPickButton: {
    minWidth: 58,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  musicPickButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  volumeControls: {
    minHeight: controls.height,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  volumeActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  volumeText: {
    minWidth: 42,
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  filmMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  filmText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0
  },
  centerGuide: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    pointerEvents: "none"
  },
  exportPanel: {
    gap: 10,
    paddingTop: 2
  },
  exportDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  exportFormatList: {
    gap: 8
  },
  exportFormatOption: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  exportFormatOptionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  exportFormatCopy: {
    flex: 1,
    gap: 4
  },
  exportFormatTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  exportFormatTitleActive: {
    color: colors.inverse
  },
  exportFormatDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportFormatDetailActive: {
    color: "rgba(255, 255, 255, 0.74)"
  },
  exportFormatMark: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 999
  },
  exportFormatMarkActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  imageFormatPanel: {
    gap: 8,
    paddingVertical: 4
  },
  imageFormatOptions: {
    flexDirection: "row",
    gap: 8
  },
  imageFormatButton: {
    flex: 1,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  imageFormatButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  imageFormatButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  imageFormatButtonTextActive: {
    color: colors.inverse
  },
  serverInputRow: {
    flexDirection: "row",
    gap: 8
  },
  serverPreset: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  serverPresetActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  serverPresetText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  serverPresetTextActive: {
    color: colors.inverse
  },
  serverUrlText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 17,
    letterSpacing: 0
  },
  serverInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.small,
    letterSpacing: 0
  },
  exportMessage: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportNotice: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
    backgroundColor: "rgba(0, 0, 0, 0.36)"
  },
  exportModalPanel: {
    width: "92%",
    maxWidth: 360,
    flexGrow: 0,
    maxHeight: "78%",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
    overflow: "visible"
  },
  exportModalContent: {
    gap: 12,
    padding: 18
  },
  exportModalPanelError: {
    gap: 12,
    borderColor: colors.darkLine
  },
  comingSoonPanel: {
    maxWidth: 340
  },
  exportModalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: 0
  },
  exportModalDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    letterSpacing: 0
  },
  exportErrorBox: {
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  exportErrorLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  },
  exportErrorText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  exportProgressTrack: {
    height: 8,
    overflow: "hidden",
    backgroundColor: colors.surfaceStrong
  },
  exportProgressFill: {
    height: "100%",
    backgroundColor: colors.text
  },
  exportProgressText: {
    alignSelf: "flex-end",
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"]
  },
  exportModalStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2
  },
  exportModalStatusText: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  exportModalActions: {
    gap: 8,
    paddingTop: 2,
    width: "100%"
  },
  exportModalButton: {
    flex: 0,
    width: "100%"
  },
  bottomEditorTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.background
  },
  bottomEditorTab: {
    width: "31.8%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  bottomEditorTabActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  bottomEditorTabDisabled: {
    opacity: 0.34
  },
  bottomEditorTabText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  bottomEditorTabTextActive: {
    color: colors.inverse
  }
});


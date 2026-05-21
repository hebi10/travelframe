import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { ActionRow } from "@/components/action-row";
import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { GUIDE_LABELS, GUIDE_TYPES } from "@/constants/camera-guides";
import {
  IMAGE_BACKUP_OPTIMIZATION_MESSAGE,
  IMAGE_QUALITY_DESCRIPTION,
  IMAGE_QUALITY_OPTIONS
} from "@/constants/image";
import {
  DELETE_ACCOUNT_REQUEST_URL,
  PRIVACY_POLICY_URL
} from "@/constants/legal-links";
import { TRIP_CLIP_RATIOS, type TripClipRatio } from "@/constants/trip-clip";
import { VIDEO_QUALITY_OPTIONS } from "@/constants/video";
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  getAppSettings,
  saveAppSettings,
  subscribeAppSettings,
  type AppImageSaveFormat,
  type AppSettings,
  type CameraSaveScope,
  type CloudBackupTarget,
  type FontSize,
  type FontStyle,
  type ScreenLayout,
  type StorageMode,
  type TripClipExportFormat,
  type ThemeMode
} from "@/lib/app-settings";
import {
  useAppAppearance
} from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import {
  getEffectiveStorageMode,
  getStorageModeLabel,
  STORAGE_MODE_OPTIONS
} from "@/lib/storage-mode";
import {
  clearBackupFailure,
  getBackupFailures,
  recordBackupFailure,
  type BackupFailureRecord
} from "@/lib/backup-failure-queue";
import {
  backupImageBundleWork,
  backupMadeVideo,
  backupPhotoIfEnabled,
  backupCurrentWorkspace,
  deleteCloudBackupData,
  getCloudBackupOverview,
  getLocalWorkspaceSummary,
  markBackupExpired,
  restoreCloudBackupToLocal,
  subscribeCloudBackupOverview,
  type BackupProgressUpdate,
  type CloudBackupOverview,
  type LocalWorkspaceSummary
} from "@/lib/cloud-backup";
import {
  formatImageBackupUsage
} from "@/lib/image-backup-utils";
import { getPhotos } from "@/lib/photo-library";
import { getUserSubscription, isCreatorSubscriptionActive } from "@/lib/subscription";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import {
  getWeeklyVideoExportUsage,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import { getMadeVideos } from "@/lib/video-library";
import {
  syncUserMusicTracks,
  type UserMusicTrack
} from "@/lib/user-music";
import { getImageBundleWorks } from "@/lib/work-library";
import { OptionButton, SettingsGuideSizeSlider } from "@/features/settings/settings-screen.components";
import { emptyBackupOverview, emptyUsageStats, type UsageStats } from "@/features/settings/settings-screen.constants";
import {
  clampSettingsGuideSize,
  formatBackupDateTime,
  formatQuotaValue,
  formatStorageQuotaValue
} from "@/features/settings/settings-screen.helpers";
import { createThemedStyles, styles } from "@/features/settings/settings-screen.styles";

type SettingKey =
  | "defaultGuide"
  | "guideVisible"
  | "guideSize"
  | "guideStrokeWidth"
  | "guideColor"
  | "overlayOpacity"
  | "cameraRatio"
  | "cameraSaveScope"
  | "defaultRatio"
  | "videoQuality"
  | "tripClipExportFormat"
  | "imageSaveFormat"
  | "themeMode"
  | "fontStyle"
  | "fontSize"
  | "screenLayout"
  | "storageMode"
  | "cloudBackupEnabled"
  | "cloudBackupTargets"
  | "imageBackupQuality";

const opacityOptions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
const cameraRatioOptions = ["Original", "1:1", "3:4", "4:5", "9:16", "16:9"] as const;


const storageModeLegend =
  "로컬 저장만 사용 / 로컬 저장 + 클라우드 백업 / 로컬 용량 절약 모드";
const storageSaverUpgradeMessage =
  "로컬 용량 절약 모드는 Pro 이상에서만 사용 가능합니다.";
const backupTargetOptions: {
  value: CloudBackupTarget;
  label: string;
  detail: string;
}[] = [
  { value: "photos", label: "사진", detail: "앱 사진 목록을 백업합니다." },
  { value: "imageBundles", label: "여러 사진 작업", detail: "편집/여행 클립 이미지 작업을 백업합니다." },
  { value: "videos", label: "영상", detail: "완성된 MP4 영상을 백업합니다." },
  { value: "music", label: "음악", detail: "사용자 음악 파일을 백업합니다." }
];

const getBackupTargetsSummary = (targets: AppSettings["cloudBackupTargets"]) => {
  const selectedLabels = backupTargetOptions
    .filter((option) => targets[option.value] !== false)
    .map((option) => option.label);

  if (selectedLabels.length === backupTargetOptions.length) {
    return "전체";
  }

  return selectedLabels.length > 0 ? selectedLabels.join(", ") : "선택 없음";
};

const cameraSaveScopeOptions: { value: CameraSaveScope; label: string; detail: string }[] = [
  { value: "app", label: "앱", detail: "앱 사진 목록에만 저장합니다." },
  { value: "device", label: "핸드폰", detail: "핸드폰 앨범에만 저장합니다." },
  { value: "both", label: "앱, 핸드폰", detail: "앱과 핸드폰 앨범에 함께 저장합니다." }
];
const tripClipExportFormatOptions: {
  value: TripClipExportFormat;
  label: string;
  detail: string;
}[] = [
  { value: "mp4", label: "MP4 영상", detail: "영상으로 저장하는 화면을 기본값으로 엽니다." },
  { value: "images", label: "이미지 저장", detail: "개별 이미지 저장 화면을 기본값으로 엽니다." }
];
const imageSaveFormatOptions: {
  value: AppImageSaveFormat;
  label: string;
  detail: string;
}[] = [
  { value: "original", label: "원본 형식", detail: "현재 앱에 저장된 이미지 형식을 유지합니다." },
  { value: "png", label: "PNG", detail: "무손실 PNG로 저장합니다." },
  { value: "jpeg", label: "JPG", detail: "호환성이 높은 JPG로 저장합니다." }
];

const guideSizeOptions = [
  { label: "작게", value: 34 },
  { label: "기본", value: 44 },
  { label: "크게", value: 56 }
] as const;

const guideStrokeWidthOptions = [1, 2, 3, 4, 5] as const;

const guideColorOptions = [
  { label: "흰색", value: DEFAULT_GUIDE_COLOR },
  { label: "노랑", value: "#F5D76E" },
  { label: "민트", value: "#8CECC1" },
  { label: "파랑", value: "#A9D7FF" },
  { label: "빨강", value: "#FF5A5F" },
  { label: "검정", value: "rgba(17, 17, 17, 0.78)" }
] as const;

const imageQualityLabel = IMAGE_QUALITY_OPTIONS.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<(typeof IMAGE_QUALITY_OPTIONS)[number]["value"], string>
);
const cameraSaveScopeLabel = cameraSaveScopeOptions.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<CameraSaveScope, string>
);
const tripClipExportFormatLabel = tripClipExportFormatOptions.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<TripClipExportFormat, string>
);
const imageSaveFormatLabel = imageSaveFormatOptions.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<AppImageSaveFormat, string>
);
const videoQualityLabel = VIDEO_QUALITY_OPTIONS.reduce(
  (labels, option) => ({
    ...labels,
    [option.id]: option.label
  }),
  {} as Record<(typeof VIDEO_QUALITY_OPTIONS)[number]["id"], string>
);

const themeOptions: {
  value: ThemeMode;
  label: string;
  detail: string;
}[] = [
  { value: "light", label: "라이트", detail: "밝은 흑백 화면으로 고정합니다." },
  { value: "dark", label: "다크", detail: "어두운 흑백 화면을 사용합니다." },
  { value: "system", label: "시스템", detail: "기기 화면 설정을 따릅니다." }
];

const themeLabel: Record<ThemeMode, string> = {
  light: "라이트",
  dark: "다크",
  system: "시스템"
};

const fontOptions: {
  value: FontStyle;
  label: string;
  detail: string;
}[] = [
  { value: "compact", label: "컴팩트", detail: "제목을 낮고 단정하게 표시합니다." },
  { value: "standard", label: "기본", detail: "읽기 편한 표준 크기로 표시합니다." },
  { value: "bold", label: "강조", detail: "큰 제목으로 화면 위계를 강하게 둡니다." }
];

const fontLabel: Record<FontStyle, string> = {
  compact: "컴팩트",
  standard: "기본",
  bold: "강조"
};

const fontSizeOptions: {
  value: FontSize;
  label: string;
  detail: string;
}[] = [
  { value: "small", label: "작게", detail: "정보가 많은 화면을 더 촘촘하게 봅니다." },
  { value: "medium", label: "기본", detail: "대부분의 화면에 맞는 표준 크기입니다." },
  { value: "large", label: "크게", detail: "제목과 설명을 더 크게 표시합니다." }
];

const fontSizeLabel: Record<FontSize, string> = {
  small: "작게",
  medium: "기본",
  large: "크게"
};

const screenLayoutOptions: {
  value: ScreenLayout;
  label: string;
  detail: string;
}[] = [
  { value: "compact", label: "간결", detail: "여백을 줄여 정보를 빠르게 확인합니다." },
  { value: "balanced", label: "기본", detail: "여백과 정보 밀도의 균형을 맞춥니다." },
  { value: "comfortable", label: "여유", detail: "화면 사이 간격을 넓혀 편하게 봅니다." }
];

const screenLayoutLabel: Record<ScreenLayout, string> = {
  compact: "간결",
  balanced: "기본",
  comfortable: "여유"
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const themed = useMemo(() => createThemedStyles(palette), [palette]);
  const modalSafeStyle = useMemo(
    () => ({
      paddingTop: Math.max(insets.top + 14, 24),
      paddingBottom: Math.max(insets.bottom + 14, 24)
    }),
    [insets.bottom, insets.top]
  );
  const {
    user,
    subscription,
    isLoggedIn,
    isAuthLoading,
    isFirebaseReady,
    signIn,
    signInWithGoogleIdToken,
    signUp,
    logOut,
    refreshUser
  } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [activeSetting, setActiveSetting] = useState<SettingKey | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [backupTargetStorageMode, setBackupTargetStorageMode] =
    useState<StorageMode>("local_backup");
  const [showDeleteRequestInfo, setShowDeleteRequestInfo] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [guideReplaySignal, setGuideReplaySignal] = useState(0);
  const [isBackupSubmitting, setIsBackupSubmitting] = useState(false);
  const [backupCheckMessage, setBackupCheckMessage] = useState<string | null>(null);
  const [backupProgress, setBackupProgress] =
    useState<BackupProgressUpdate | null>(null);
  const [backupFailures, setBackupFailures] = useState<BackupFailureRecord[]>([]);
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(emptyBackupOverview);
  const [usageStats, setUsageStats] = useState<UsageStats>(emptyUsageStats);
  const [musicTracks, setMusicTracks] = useState<UserMusicTrack[]>([]);
  const [weeklyVideoExportUsage, setWeeklyVideoExportUsage] =
    useState<WeeklyVideoExportUsage | null>(null);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const isGoogleReady = Boolean(googleWebClientId && googleAndroidClientId);
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const localImageUsage = usageStats.photos + usageStats.imageBundles;
  const effectiveStorageMode = getEffectiveStorageMode(
    settings.storageMode,
    planEntitlements.canBackupToCloud
  );

  const refreshBackupFailures = useCallback(async () => {
    setBackupFailures(await getBackupFailures());
  }, []);

  useEffect(() => {
    return subscribeCloudBackupOverview({
      user,
      onChange: setBackupOverview
    });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSettings = async () => {
        const [
          storedSettings,
          storedBackupFailures,
          storedPhotos,
          storedImageBundles,
          storedVideos,
          storedMusicTracks,
          storedWeeklyVideoExportUsage
        ] = await Promise.all([
          getAppSettings(),
          getBackupFailures(),
          getPhotos(),
          getImageBundleWorks(),
          getMadeVideos(),
          user ? syncUserMusicTracks(user) : Promise.resolve([]),
          getWeeklyVideoExportUsage(user, planEntitlements.weeklyVideoExportLimit)
        ]);
        await markBackupExpired({ user, subscription });
        if (isActive) {
          setSettings(storedSettings);
          setBackupFailures(storedBackupFailures);
          setUsageStats({
            photos: storedPhotos.length,
            imageBundles: storedImageBundles.length,
            videos: storedVideos.length
          });
          setMusicTracks(storedMusicTracks);
          setWeeklyVideoExportUsage(storedWeeklyVideoExportUsage);
        }
      };

      loadSettings();

      return () => {
        isActive = false;
      };
    }, [planEntitlements.weeklyVideoExportLimit, subscription, user])
  );

  useEffect(
    () =>
      subscribeAppSettings((nextSettings) => {
        setSettings(nextSettings);
      }),
    []
  );

  const modalTitle = useMemo(() => {
    if (activeSetting === "defaultGuide") {
      return "기본 가이드";
    }

    if (activeSetting === "guideVisible") {
      return "가이드 표시";
    }

    if (activeSetting === "guideSize") {
      return "가이드 크기";
    }

    if (activeSetting === "guideStrokeWidth") {
      return "가이드 선 두께";
    }

    if (activeSetting === "guideColor") {
      return "가이드 색상";
    }

    if (activeSetting === "overlayOpacity") {
      return "오버레이 투명도";
    }

    if (activeSetting === "defaultRatio") {
      return "기본 비율";
    }

    if (activeSetting === "cameraRatio") {
      return "카메라 비율";
    }

    if (activeSetting === "cameraSaveScope") {
      return "저장 범위";
    }

    if (activeSetting === "videoQuality") {
      return "영상 화질";
    }

    if (activeSetting === "tripClipExportFormat") {
      return "기본 저장 형식";
    }

    if (activeSetting === "imageSaveFormat") {
      return "이미지 형식";
    }

    if (activeSetting === "themeMode") {
      return "화면 모드";
    }

    if (activeSetting === "fontStyle") {
      return "폰트 스타일";
    }

    if (activeSetting === "fontSize") {
      return "폰트 크기";
    }

    if (activeSetting === "screenLayout") {
      return "화면 구성";
    }

    if (activeSetting === "storageMode") {
      return "저장 방식";
    }

    if (activeSetting === "cloudBackupEnabled") {
      return "클라우드 백업";
    }

    if (activeSetting === "cloudBackupTargets") {
      return "백업 대상";
    }

    if (activeSetting === "imageBackupQuality") {
      return "이미지 백업 화질";
    }

    return "";
  }, [activeSetting]);

  const updateSetting = async (updates: Partial<AppSettings>) => {
    const nextSettings = {
      ...settings,
      ...updates
    };
    setSettings(nextSettings);
    await saveAppSettings(nextSettings);
    setActiveSetting(null);
  };

  const previewGuideSize = (value: number) => {
    setSettings((current) => ({
      ...current,
      guideSize: clampSettingsGuideSize(value),
      guideVisible: true
    }));
  };

  const commitGuideSize = (value: number) => {
    void updateSetting({
      guideSize: clampSettingsGuideSize(value),
      guideVisible: true
    });
  };

  const toggleCloudBackupTarget = async (target: CloudBackupTarget) => {
    const nextTargets = {
      ...settings.cloudBackupTargets,
      [target]: settings.cloudBackupTargets[target] === false
    };
    const nextSettings = {
      ...settings,
      cloudBackupTargets: nextTargets
    };
    setSettings(nextSettings);
    await saveAppSettings(nextSettings);
  };

  const openDeleteRequestPage = () => {
    setShowDeleteRequestInfo(false);
    void Linking.openURL(DELETE_ACCOUNT_REQUEST_URL);
  };

  const handleResetGuideProgress = async () => {
    setAuthMessage(null);
    setGuideReplaySignal((value) => value + 1);
  };

  const handleEnableBackup = async (targetStorageMode: StorageMode = "local_backup") => {
    if (isBackupSubmitting) {
      return;
    }

    setBackupTargetStorageMode(targetStorageMode);

    if (!isLoggedIn || !user) {
      setAuthMessage("로그인 후 백업을 사용할 수 있습니다.");
      setActiveSetting(null);
      return;
    }

    try {
      setIsBackupSubmitting(true);
      setBackupCheckMessage("백업 상태를 확인하고 있습니다.");
      setAuthMessage(null);
      await refreshUser().catch(() => undefined);
      const latestSubscription = await getUserSubscription(user);

      if (!isCreatorSubscriptionActive(latestSubscription)) {
        if (targetStorageMode === "local_backup") {
          await updateSetting({
            storageMode: "local_backup",
            cloudBackupEnabled: true
          });
          setAuthMessage(
            "저장 방식은 로컬 저장 + 클라우드 백업으로 설정했습니다. 서버 업로드는 Pro 이상에서 자동으로 실행됩니다."
          );
          return;
        }

        await markBackupExpired({ user, subscription: latestSubscription });
        setAuthMessage(
          "구독 기간이 만료되었거나 활성화되지 않았습니다. 백업은 사용할 수 없고 기존 백업 데이터 삭제는 설정에서 직접 요청할 수 있습니다."
        );
        setActiveSetting(null);
        return;
      }

      const [localSummary, cloudOverview] = await Promise.all([
        getLocalWorkspaceSummary(),
        getCloudBackupOverview({ user })
      ]);
      const hasCloudBackup =
        cloudOverview.photoCount + cloudOverview.imageBundleCount + cloudOverview.videoCount > 0;

      setActiveSetting(null);

      if (!hasCloudBackup) {
        setShowBackupConfirm(true);
        return;
      }

      Alert.alert(
        "기존 백업 데이터",
        `이 계정에 기존 백업 데이터가 있습니다. 현재 기기의 데이터를 백업하거나 기존 백업 데이터를 불러올 수 있습니다.\n\n기존 백업: 사진 ${cloudOverview.photoCount}장 / 여러 사진 작업 ${cloudOverview.imageBundleCount}개 / 영상 ${cloudOverview.videoCount}개\n이미지 백업 용량: ${formatImageBackupUsage(cloudOverview.imageBackupBytes)}\n마지막 백업: ${formatBackupDateTime(cloudOverview.backedUpAt)}`,
        [
          {
            text: "현재 기기 데이터 백업",
            onPress: () => confirmCurrentDeviceBackup()
          },
          {
            text: "클라우드 데이터 불러오기",
            onPress: () => confirmCloudRestore(localSummary)
          },
          {
            text: "나중에 선택",
            style: "cancel",
            onPress: () => setAuthMessage("백업 선택을 나중에 다시 진행할 수 있습니다.")
          }
        ]
      );
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "백업 상태를 확인하지 못했습니다.");
    } finally {
      setIsBackupSubmitting(false);
      setBackupCheckMessage(null);
    }
  };

  const confirmBackup = async () => {
    if (isBackupSubmitting) {
      return;
    }

    try {
      setIsBackupSubmitting(true);
      setBackupProgress({
        percent: 0,
        detail: "백업할 데이터를 준비하고 있습니다."
      });
      setAuthMessage(null);
      await refreshUser().catch(() => undefined);
      const latestSubscription = await getUserSubscription(user);
      const summary = await backupCurrentWorkspace({
        user,
        subscription: latestSubscription,
        onProgress: setBackupProgress
      });
      await updateSetting({
        storageMode: backupTargetStorageMode,
        cloudBackupEnabled: true
      });
      setShowBackupConfirm(false);
      setAuthMessage(
        `백업을 완료했습니다. 사진 ${summary.photoCount}장, 여러 사진 작업 ${summary.imageBundleCount}개, 영상 ${summary.videoCount}개와 설정을 저장했습니다.`
      );
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "백업 중 문제가 발생했습니다.");
    } finally {
      setIsBackupSubmitting(false);
      setBackupProgress(null);
    }
  };

  const confirmCurrentDeviceBackup = () => {
    Alert.alert(
      "현재 기기 데이터 백업",
      "현재 기기의 데이터로 백업을 시작합니다. 기존 클라우드 백업과 중복될 수 있습니다. 계속하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "계속",
          onPress: () => {
            void confirmBackup();
          }
        }
      ]
    );
  };

  const restoreBackupData = async () => {
    if (isBackupSubmitting) {
      return;
    }

    try {
      setIsBackupSubmitting(true);
      setAuthMessage(null);
      const summary = await restoreCloudBackupToLocal({ user });
      await updateSetting({
        storageMode: "local_backup",
        cloudBackupEnabled: true
      });
      setAuthMessage(
        `클라우드 백업에서 현재 앱에 없는 항목만 불러왔습니다. 사진 ${summary.photoCount}장, 여러 사진 작업 ${summary.imageBundleCount}개, 영상 ${summary.videoCount}개를 추가했습니다.`
      );
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "클라우드 백업을 불러오지 못했습니다.");
    } finally {
      setIsBackupSubmitting(false);
    }
  };

  const confirmCloudRestore = (localSummary: LocalWorkspaceSummary) => {
    const showWarning = () =>
      Alert.alert(
        "클라우드 데이터 불러오기",
        "클라우드 백업 데이터 중 현재 앱에 없는 사진, 작업물, 영상만 불러옵니다. 이미 저장된 항목은 그대로 둡니다. 계속하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          {
            text: "불러오기",
            onPress: () => {
              void restoreBackupData();
            }
          }
        ]
      );

    if (localSummary.totalCount > 0) {
      showWarning();
      return;
    }

    void restoreBackupData();
  };

  const retryBackupFailures = async () => {
    if (isBackupSubmitting) {
      return;
    }

    if (!isLoggedIn || !user) {
      setAuthMessage("로그인 후 실패한 백업을 다시 시도할 수 있습니다.");
      return;
    }

    await refreshUser().catch(() => undefined);
    const latestSubscription = await getUserSubscription(user);

    if (!settings.cloudBackupEnabled || !isCreatorSubscriptionActive(latestSubscription)) {
      setAuthMessage("구독과 클라우드 백업 설정이 켜져 있을 때 다시 시도할 수 있습니다.");
      return;
    }

    try {
      setIsBackupSubmitting(true);
      setAuthMessage(null);
      const [failures, photos, imageBundles, videos] = await Promise.all([
        getBackupFailures(),
        getPhotos(),
        getImageBundleWorks(),
        getMadeVideos()
      ]);
      let successCount = 0;
      let failedCount = 0;

      for (const failure of failures) {
        try {
          if (failure.kind === "photo") {
            const photo = photos.find((item) => item.id === failure.id);
            if (!photo) {
              await clearBackupFailure(failure.id);
              continue;
            }

            await backupPhotoIfEnabled({ user, subscription: latestSubscription, photo });
          }

          if (failure.kind === "image-bundle") {
            const work = imageBundles.find((item) => item.id === failure.id);
            if (!work) {
              await clearBackupFailure(failure.id);
              continue;
            }

            await backupImageBundleWork({
              user,
              work,
              enabled: settings.cloudBackupEnabled
            });
          }

          if (failure.kind === "video") {
            const video = videos.find((item) => item.id === failure.id);
            if (!video) {
              await clearBackupFailure(failure.id);
              continue;
            }

            await backupMadeVideo({
              user,
              video,
              enabled: settings.cloudBackupEnabled
            });
          }

          await clearBackupFailure(failure.id);
          successCount += 1;
        } catch (retryError) {
          failedCount += 1;
          await recordBackupFailure({
            id: failure.id,
            kind: failure.kind,
            label: failure.label,
            message: getUserFacingErrorMessage(
              retryError,
              "클라우드 백업은 완료하지 못했습니다."
            )
          });
        }
      }

      await refreshBackupFailures();
      setAuthMessage(
        failedCount > 0
          ? `백업 재시도 ${successCount}개를 완료했고 ${failedCount}개는 다시 실패했습니다.`
          : `실패한 백업 ${successCount}개를 다시 완료했습니다.`
      );
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "백업을 다시 시도하지 못했습니다.");
    } finally {
      setIsBackupSubmitting(false);
    }
  };

  const handleDeleteBackupData = () => {
    if (!isLoggedIn || !user) {
      setAuthMessage("로그인 후 백업 데이터를 삭제할 수 있습니다.");
      return;
    }

    Alert.alert(
      "백업 데이터를 삭제할까요?",
      "계정에 백업된 사진, 여러 사진 작업, 영상 백업을 삭제합니다. 기기 안에 저장된 원본 작업물은 삭제하지 않습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              setIsBackupSubmitting(true);
              const summary = await deleteCloudBackupData({ user });
              await updateSetting({
                storageMode: "local_only",
                cloudBackupEnabled: false
              });
              setShowBackupConfirm(false);
              setActiveSetting(null);
              setAuthMessage(
                `백업 데이터를 삭제했습니다. 사진 ${summary.photoCount}장, 여러 사진 작업 ${summary.imageBundleCount}개, 영상 ${summary.videoCount}개가 정리되었습니다.`
              );
            } catch (error) {
              setAuthMessage(
                error instanceof Error
                  ? error.message
                  : "백업 데이터를 삭제하지 못했습니다."
              );
            } finally {
              setIsBackupSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleAuthAction = async (mode: "signIn" | "signUp" | "logOut") => {
    if (isAuthSubmitting) {
      return;
    }

    try {
      setIsAuthSubmitting(true);
      setAuthMessage(null);

      if (mode === "logOut") {
        await logOut();
        setAuthPassword("");
        setAuthMessage("로그아웃했습니다.");
        return;
      }

      if (!authEmail.trim() || authPassword.length < 6) {
        setAuthMessage("이메일과 6자리 이상 비밀번호를 입력해 주세요.");
        return;
      }

      if (mode === "signIn") {
        await signIn(authEmail, authPassword);
        setAuthMessage("로그인했습니다.");
      } else {
        await signUp(authEmail, authPassword);
        setAuthMessage("회원가입과 로그인을 완료했습니다.");
      }
      setAuthPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuthMessage(
        message.includes("auth/email-already-in-use")
          ? "이미 가입된 이메일입니다."
          : message.includes("auth/invalid-credential") ||
              message.includes("auth/wrong-password") ||
              message.includes("auth/user-not-found")
            ? "이메일 또는 비밀번호를 확인해 주세요."
            : message.includes("auth/invalid-email")
              ? "이메일 형식을 확인해 주세요."
              : message.includes("Firebase 연결 정보")
                ? "Firebase 연결 정보가 아직 설정되지 않았습니다."
                : "로그인 처리 중 문제가 발생했습니다."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!isGoogleReady) {
      setAuthMessage("Google 濡쒓렇???ㅼ젙媛믪쓣 ?뺤씤??二쇱꽭??");
      return;
    }

    const runGoogleLogin = async () => {
      setIsGoogleSubmitting(true);
      setAuthMessage(null);

      const AuthSession = await import("expo-auth-session");
      const clientId = Platform.OS === "android" ? googleAndroidClientId! : googleWebClientId!;
      const redirectUri =
        Platform.OS === "android"
          ? "com.haebi.photoguide:/oauthredirect"
          : AuthSession.makeRedirectUri({
              scheme: "photoguide",
              path: "oauthredirect"
            });
      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token"
      };
      const request = new AuthSession.AuthRequest({
        clientId,
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        scopes: ["openid", "profile", "email"],
        usePKCE: true,
        extraParams: {
          prompt: "select_account"
        }
      });
      const result = await request.promptAsync(discovery);

      if (result.type === "success") {
        if (result.params.error) {
          throw new Error(result.params.error_description ?? result.params.error);
        }

        const code = result.params.code;
        if (!code) {
          throw new Error("Google 濡쒓렇???뱀씤 肄붾뱶瑜?諛쏆? 紐삵뻽?듬땲??");
        }

        const token = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code,
            redirectUri,
            scopes: ["openid", "profile", "email"],
            extraParams: {
              code_verifier: request.codeVerifier ?? ""
            }
          },
          discovery
        );
        const idToken = token.idToken;
        if (!idToken) {
          throw new Error("Google 濡쒓렇???좏겙??諛쏆? 紐삵뻽?듬땲??");
        }

        await signInWithGoogleIdToken(idToken);
        setAuthMessage("Google 怨꾩젙?쇰줈 濡쒓렇?명뻽?듬땲??");
        return;
      }

      if (result.type === "cancel" || result.type === "dismiss") {
        setAuthMessage("Google 濡쒓렇?몄쓣 痍⑥냼?덉뒿?덈떎.");
        return;
      }

      throw new Error("Google 濡쒓렇??以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.");
    };

    runGoogleLogin().catch((error) => {
      setIsGoogleSubmitting(false);
      const message = error instanceof Error ? error.message : String(error);
      setAuthMessage(
        message.includes("ExpoWebBrowser") ||
          message.includes("native module") ||
          message.includes("Cannot find native module")
          ? "Google 濡쒓렇??紐⑤뱢???꾩옱 ??鍮뚮뱶???ы븿?섏? ?딆븯?듬땲?? Android 媛쒕컻 鍮뚮뱶瑜??ㅼ떆 留뚮뱺 ???쒕룄??二쇱꽭??"
          : message
      );
    }).finally(() => {
      setIsGoogleSubmitting(false);
    });
  };

  return (
    <>
      <ScreenShell
        eyebrow="설정"
        title="기본값 설정"
        description="가이드, 오버레이, 저장 품질과 화면 스타일을 관리합니다."
        safeTop
      >
        <SectionBlock title="계정">
          <View style={[styles.accountPanel, themed.panelStrong]}>
            <View style={styles.accountHeader}>
              <View style={styles.accountCopy}>
                <Text selectable style={[styles.accountTitle, themed.text]}>
                  {isLoggedIn ? "로그인됨" : "비로그인 사용 중"}
                </Text>
                <Text selectable style={[styles.accountDetail, themed.mutedText]}>
                  {isLoggedIn
                    ? `${user?.email ?? "계정"}으로 전체 기능을 사용할 수 있습니다.`
                    : "비로그인 상태에서는 무료 기능과 워터마크가 적용됩니다."}
                </Text>
              </View>
              <View
                style={[
                  styles.accountBadge,
                  themed.border,
                  isLoggedIn && styles.accountBadgeActive,
                  isLoggedIn && themed.activeFill
                ]}
              >
                <Text
                  selectable={false}
                  style={[
                    styles.accountBadgeText,
                    themed.text,
                    isLoggedIn && styles.accountBadgeTextActive,
                    isLoggedIn && themed.inverseText
                  ]}
                >
                  {isLoggedIn ? "전체" : "무료"}
                </Text>
              </View>
            </View>

            {!isFirebaseReady ? (
              <Text selectable style={[styles.accountNotice, themed.mutedText]}>
                Firebase 웹 앱 config를 .env에 넣으면 로그인 기능이 활성화됩니다.
              </Text>
            ) : null}

            {isFirebaseReady && !isLoggedIn ? (
              <View style={styles.authForm}>
                <TextInput
                  value={authEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="이메일"
                  placeholderTextColor={palette.faint}
                  style={[styles.authInput, themed.input]}
                  onChangeText={setAuthEmail}
                />
                <TextInput
                  value={authPassword}
                  secureTextEntry
                  placeholder="비밀번호 6자리 이상"
                  placeholderTextColor={palette.faint}
                  style={[styles.authInput, themed.input]}
                  onChangeText={setAuthPassword}
                />
                <View style={styles.authActions}>
                  <Pressable
                    disabled={isAuthLoading || isAuthSubmitting || isGoogleSubmitting}
                    style={[
                      styles.authPrimaryButton,
                      themed.activeFill,
                      (isAuthSubmitting || isGoogleSubmitting) && styles.disabledButton
                    ]}
                    onPress={() => handleAuthAction("signIn")}
                  >
                    <Text selectable={false} style={[styles.authPrimaryButtonText, themed.inverseText]}>
                      로그인
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isAuthLoading || isAuthSubmitting || isGoogleSubmitting}
                    style={[
                      styles.authSecondaryButton,
                      themed.secondaryButton,
                      (isAuthSubmitting || isGoogleSubmitting) && styles.disabledButton
                    ]}
                    onPress={() => handleAuthAction("signUp")}
                  >
                    <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                      회원가입
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  disabled={isAuthLoading || isAuthSubmitting || isGoogleSubmitting}
                  style={[
                    styles.authSecondaryButton,
                    styles.authGoogleButton,
                    themed.secondaryButton,
                    (isAuthSubmitting || isGoogleSubmitting) && styles.disabledButton
                  ]}
                  onPress={handleGoogleSignIn}
                >
                  <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                    {isGoogleSubmitting ? "Google 로그인 중" : "Google로 계속하기"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {isFirebaseReady && isLoggedIn ? (
              <View style={styles.loggedInActions}>
                <ActionRow
                  label="저장 방식"
                  detail={storageModeLegend}
                  mark={getStorageModeLabel(effectiveStorageMode)}
                  onPress={() => setActiveSetting("storageMode")}
                />
                <ActionRow
                  label="백업 대상"
                  detail="클라우드 백업에 포함할 데이터를 선택합니다."
                  mark={getBackupTargetsSummary(settings.cloudBackupTargets)}
                  onPress={() => setActiveSetting("cloudBackupTargets")}
                />
                <View style={[styles.backupStatusPanel, themed.border]}>
                  <Text selectable style={[styles.backupStatusTitle, themed.text]}>
                    백업 데이터
                  </Text>
                  <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
                    사진 {backupOverview.photoCount}장 / 여러 사진 작업{" "}
                    {backupOverview.imageBundleCount}개 / 영상 {backupOverview.videoCount}개
                  </Text>
                  <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
                    {formatImageBackupUsage(backupOverview.imageBackupBytes)}
                  </Text>
                  {backupFailures.length > 0 ? (
                    <Pressable
                      disabled={isBackupSubmitting}
                      style={[
                        styles.authSecondaryButton,
                        themed.secondaryButton,
                        isBackupSubmitting && styles.disabledButton
                      ]}
                      onPress={retryBackupFailures}
                    >
                      <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                        실패한 백업 다시 시도 ({backupFailures.length})
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={isBackupSubmitting}
                    style={[
                      styles.authSecondaryButton,
                      themed.secondaryButton,
                      isBackupSubmitting && styles.disabledButton
                    ]}
                    onPress={handleDeleteBackupData}
                  >
                    <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                      백업 데이터 삭제
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  disabled={isAuthSubmitting}
                  style={[
                    styles.authSecondaryButton,
                    themed.secondaryButton,
                    isAuthSubmitting && styles.disabledButton
                  ]}
                  onPress={() => handleAuthAction("logOut")}
                >
                  <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                    로그아웃
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {authMessage ? (
              <Text selectable style={[styles.authMessage, themed.mutedText]}>
                {authMessage}
              </Text>
            ) : null}
          </View>
        </SectionBlock>

        <SectionBlock title="플랜 한도">
          <View style={[styles.backupStatusPanel, themed.border]}>
            <Text selectable style={[styles.backupStatusTitle, themed.text]}>
              현재 플랜: {planEntitlements.label}
            </Text>
            <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
              영상 출력 (주간 한도):{" "}
              {formatQuotaValue(
                weeklyVideoExportUsage?.count ?? 0,
                planEntitlements.weeklyVideoExportLimit
              )}
            </Text>
            <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
              이미지 보관함:{" "}
              {formatQuotaValue(localImageUsage, planEntitlements.localImageLimit)}
            </Text>
            <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
              영상 보관함:{" "}
              {formatQuotaValue(usageStats.videos, planEntitlements.localVideoLimit)}
            </Text>
            <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
              음악 보관함:{" "}
              {formatQuotaValue(musicTracks.length, planEntitlements.musicTrackLimit)}
            </Text>
            <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
              서버 백업:{" "}
              {formatStorageQuotaValue(
                backupOverview.imageBackupBytes,
                planEntitlements.backupStorageBytes
              )}
            </Text>
          </View>
        </SectionBlock>

        <SectionBlock title="앱">
          <ActionRow
            label="화면 모드"
            detail="라이트, 다크, 시스템 설정"
            mark={themeLabel[settings.themeMode]}
            onPress={() => setActiveSetting("themeMode")}
          />
          <ActionRow
            label="폰트 스타일"
            detail="화면 제목의 크기와 밀도"
            mark={fontLabel[settings.fontStyle]}
            onPress={() => setActiveSetting("fontStyle")}
          />
          <ActionRow
            label="폰트 크기"
            detail="앱 화면의 글자 크기"
            mark={fontSizeLabel[settings.fontSize]}
            onPress={() => setActiveSetting("fontSize")}
          />
          <ActionRow
            label="화면 구성"
            detail="선, 여백, 타이포 중심의 정돈된 스타일"
            mark={screenLayoutLabel[settings.screenLayout]}
            onPress={() => setActiveSetting("screenLayout")}
          />
          <View style={[styles.guidePopupPanel, themed.panel]}>
            <View style={styles.guidePopupCopy}>
              <Text selectable style={[styles.guidePopupTitle, themed.text]}>
                사용 가이드
              </Text>
              <Text selectable style={[styles.guidePopupDetail, themed.mutedText]}>
                처음 사용하는 사람을 위한 화면별 안내 팝업을 다시 볼 수 있습니다.
              </Text>
            </View>
            <Pressable
              style={[styles.guidePopupButton, themed.activeFill]}
              onPress={handleResetGuideProgress}
            >
              <Text selectable={false} style={[styles.guidePopupButtonText, themed.inverseText]}>
                가이드 팝업 보기
              </Text>
            </Pressable>
          </View>
          <ActionRow
            label="개인정보처리방침"
            detail="권한 사용과 데이터 처리 안내"
            mark="열기"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          />
          <ActionRow
            label="계정 및 데이터 삭제 요청"
            detail="계정 삭제와 저장 데이터 삭제 요청 안내"
            mark="열기"
            onPress={() => setShowDeleteRequestInfo(true)}
          />
        </SectionBlock>

        <SectionBlock title="가이드">
          <View style={[styles.guidePanel, themed.panel]}>
            <View style={styles.guidePanelHeader}>
              <View style={styles.guidePanelCopy}>
                <Text selectable style={[styles.guidePanelTitle, themed.text]}>
                  전체 가이드 설정
                </Text>
                <Text selectable style={[styles.guidePanelDetail, themed.mutedText]}>
                  카메라, 사진 편집, 영상 만들기에 같은 가이드가 적용됩니다.
                </Text>
              </View>
              <Pressable
                style={[
                  styles.guideVisibleButton,
                  themed.secondaryButton,
                  settings.guideVisible && styles.guideVisibleButtonActive,
                  settings.guideVisible && themed.activeFill
                ]}
                onPress={() => updateSetting({ guideVisible: !settings.guideVisible })}
              >
                <Text
                  selectable={false}
                  style={[
                    styles.guideVisibleButtonText,
                    themed.text,
                    settings.guideVisible && styles.guideVisibleButtonTextActive,
                    settings.guideVisible && themed.inverseText
                  ]}
                >
                  {settings.guideVisible ? "켜짐" : "꺼짐"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.guideCollapsedRow}>
              <Text selectable style={[styles.guideSummary, themed.mutedText]}>
                {GUIDE_LABELS[settings.defaultGuide]} / {settings.guideSize} / {settings.guideStrokeWidth}px /{" "}
                {Math.round(settings.overlayOpacity * 100)}%
              </Text>
              <Pressable
                style={[styles.guideExpandButton, themed.secondaryButton]}
                onPress={() => setGuideExpanded((value) => !value)}
              >
                <Text selectable={false} style={[styles.guideExpandButtonText, themed.text]}>
                  {guideExpanded ? "접기" : "펼치기"}
                </Text>
              </Pressable>
            </View>

            {guideExpanded ? (
              <>
            <View style={styles.guidePreviewBlock}>
              <Text selectable style={[styles.compactGroupTitle, themed.text]}>
                예시 미리보기
              </Text>
              <View style={styles.guidePreviewFrame}>
                <View style={styles.guidePreviewSky} />
                <View style={styles.guidePreviewGround} />
                <View style={styles.guidePreviewSubject} />
                <CameraGuideOverlay
                  guide={settings.defaultGuide}
                  visible={settings.guideVisible}
                  color={settings.guideColor}
                  size={settings.guideSize}
                  strokeWidth={settings.guideStrokeWidth}
                  offsetX={settings.guideOffsetX}
                  offsetY={settings.guideOffsetY}
                />
                {!settings.guideVisible ? (
                  <View style={styles.guidePreviewDisabled}>
                    <Text selectable={false} style={styles.guidePreviewDisabledText}>
                      가이드 꺼짐
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.compactGroup}>
              <Text selectable style={[styles.compactGroupTitle, themed.text]}>
                선 두께
              </Text>
              <View style={styles.compactOptionRow}>
                {guideStrokeWidthOptions.map((strokeWidth) => {
                  const isActive = settings.guideStrokeWidth === strokeWidth;

                  return (
                    <Pressable
                      key={strokeWidth}
                      style={[
                        styles.compactOption,
                        themed.secondaryButton,
                        isActive && styles.compactOptionActive,
                        isActive && themed.activeFill
                      ]}
                      onPress={() =>
                        updateSetting({
                          guideStrokeWidth: strokeWidth,
                          guideVisible: true
                        })
                      }
                    >
                      <Text
                        selectable={false}
                        style={[
                          styles.compactOptionText,
                          themed.text,
                          isActive && styles.compactOptionTextActive,
                          isActive && themed.inverseText
                        ]}
                      >
                        {strokeWidth}px
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.compactGroup}>
              <Text selectable style={[styles.compactGroupTitle, themed.text]}>
                가이드라인
              </Text>
              <View style={styles.compactOptionRow}>
                {GUIDE_TYPES.map((guide) => (
                  <Pressable
                    key={guide}
                    style={[
                      styles.compactOption,
                      themed.secondaryButton,
                      settings.defaultGuide === guide && styles.compactOptionActive,
                      settings.defaultGuide === guide && themed.activeFill
                    ]}
                    onPress={() => updateSetting({ defaultGuide: guide, guideVisible: true })}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.compactOptionText,
                        themed.text,
                        settings.defaultGuide === guide && styles.compactOptionTextActive,
                        settings.defaultGuide === guide && themed.inverseText
                      ]}
                    >
                      {GUIDE_LABELS[guide]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.compactGroup}>
              <Text selectable style={[styles.compactGroupTitle, themed.text]}>
                크기
              </Text>
              <View style={styles.compactOptionRow}>
                {guideSizeOptions.map((size) => (
                  <Pressable
                    key={size.value}
                    style={[
                      styles.compactOption,
                      themed.secondaryButton,
                      settings.guideSize === size.value && styles.compactOptionActive,
                      settings.guideSize === size.value && themed.activeFill
                    ]}
                    onPress={() => updateSetting({ guideSize: size.value, guideVisible: true })}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.compactOptionText,
                        themed.text,
                        settings.guideSize === size.value && styles.compactOptionTextActive,
                        settings.guideSize === size.value && themed.inverseText
                      ]}
                    >
                      {size.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <SettingsGuideSizeSlider
                value={settings.guideSize}
                onChange={previewGuideSize}
                onCommit={commitGuideSize}
              />
            </View>

            <View style={styles.compactGroup}>
              <Text selectable style={[styles.compactGroupTitle, themed.text]}>
                색상
              </Text>
              <View style={styles.colorGrid}>
                {guideColorOptions.map((color) => {
                  const isActive = settings.guideColor === color.value;

                  return (
                    <Pressable
                      key={color.label}
                      style={[
                        styles.colorButton,
                        themed.colorButton,
                        isActive && styles.colorButtonActive,
                        isActive && themed.activeBorder
                      ]}
                      onPress={() =>
                        updateSetting({ guideColor: color.value, guideVisible: true })
                      }
                    >
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color.value },
                          color.label === "흰색" && styles.colorSwatchLight
                        ]}
                      />
                      <Text selectable={false} style={[styles.colorButtonText, themed.text]}>
                        {color.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.compactGroup}>
              <Text selectable style={[styles.compactGroupTitle, themed.text]}>
                오버레이 투명도
              </Text>
              <View style={styles.compactOptionRow}>
                {opacityOptions.map((opacity) => (
                  <Pressable
                    key={opacity}
                    style={[
                      styles.compactOption,
                      themed.secondaryButton,
                      settings.overlayOpacity === opacity && styles.compactOptionActive,
                      settings.overlayOpacity === opacity && themed.activeFill
                    ]}
                    onPress={() => updateSetting({ overlayOpacity: opacity })}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.compactOptionText,
                        themed.text,
                        settings.overlayOpacity === opacity && styles.compactOptionTextActive,
                        settings.overlayOpacity === opacity && themed.inverseText
                      ]}
                    >
                      {Math.round(opacity * 100)}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
              </>
            ) : null}
          </View>
        </SectionBlock>

        <SectionBlock title="내보내기">
          <ActionRow
            label="카메라 비율"
            detail="카메라 탭에서 촬영 후 저장할 기본 비율"
            mark={settings.cameraRatio}
            onPress={() => setActiveSetting("cameraRatio")}
          />
          <ActionRow
            label="저장 범위"
            detail="카메라 촬영 사진을 앱과 핸드폰 중 어디에 저장할지 선택"
            mark={cameraSaveScopeLabel[settings.cameraSaveScope]}
            onPress={() => setActiveSetting("cameraSaveScope")}
          />
          <ActionRow
            label="기본 비율"
            detail="여행 클립을 열 때 먼저 선택되는 화면 비율"
            mark={settings.defaultRatio}
            onPress={() => setActiveSetting("defaultRatio")}
          />
          <ActionRow
            label="기본 저장 형식"
            detail="동영상 만들기 내보내기 탭에서 먼저 보여줄 저장 방식"
            mark={tripClipExportFormatLabel[settings.tripClipExportFormat]}
            onPress={() => setActiveSetting("tripClipExportFormat")}
          />
          <ActionRow
            label="영상 화질"
            detail="동영상 만들기 MP4 저장 화질"
            mark={videoQualityLabel[settings.videoQuality]}
            onPress={() => setActiveSetting("videoQuality")}
          />
          <ActionRow
            label="이미지 화질"
            detail="이미지 저장과 백업에 함께 적용할 화질"
            mark={imageQualityLabel[settings.imageBackupQuality]}
            onPress={() => setActiveSetting("imageBackupQuality")}
          />
          <ActionRow
            label="이미지 형식"
            detail="동영상 만들기 이미지 저장 형식"
            mark={imageSaveFormatLabel[settings.imageSaveFormat]}
            onPress={() => setActiveSetting("imageSaveFormat")}
          />
        </SectionBlock>
      </ScreenShell>

      <Modal
        animationType="fade"
        transparent
        visible={showDeleteRequestInfo}
        onRequestClose={() => setShowDeleteRequestInfo(false)}
      >
        <View style={[styles.modalBackdrop, modalSafeStyle]}>
          <View style={[styles.modalPanel, themed.modalPanel]}>
            <View style={styles.modalHeader}>
              <Text selectable style={[styles.modalTitle, themed.text]}>
                계정 및 데이터 삭제 요청
              </Text>
              <Pressable
                style={[styles.closeButton, themed.secondaryButton]}
                onPress={() => setShowDeleteRequestInfo(false)}
              >
                <Text selectable={false} style={[styles.closeButtonText, themed.text]}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <Text selectable style={[styles.optionDetail, themed.mutedText]}>
              백업 데이터는 설정 화면의 클라우드 백업에서 백업 데이터 삭제를 누르면 계정에서 제거됩니다.
            </Text>
            <Text selectable style={[styles.optionDetail, themed.mutedText]}>
              계정 삭제 요청과 추가 데이터 삭제 안내는 별도 안내 페이지에서 확인하실 수 있습니다. 관련 안내 페이지로 이동하시겠습니까?
            </Text>

            <Pressable
              style={[styles.deleteRequestPrimaryButton, themed.activeFill]}
              onPress={openDeleteRequestPage}
            >
              <Text selectable={false} style={[styles.authPrimaryButtonText, themed.inverseText]}>
                안내 페이지로 이동
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(activeSetting)}
        onRequestClose={() => setActiveSetting(null)}
      >
        <View style={[styles.modalBackdrop, modalSafeStyle]}>
          <View style={[styles.modalPanel, themed.modalPanel]}>
            <View style={styles.modalHeader}>
              <Text selectable style={[styles.modalTitle, themed.text]}>
                {modalTitle}
              </Text>
              <Pressable
                style={[styles.closeButton, themed.secondaryButton]}
                onPress={() => setActiveSetting(null)}
              >
                <Text selectable={false} style={[styles.closeButtonText, themed.text]}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.optionList}
              showsVerticalScrollIndicator={false}
            >
              {activeSetting === "defaultGuide"
                ? GUIDE_TYPES.map((guide) => (
                    <OptionButton
                      key={guide}
                      label={GUIDE_LABELS[guide]}
                      detail="카메라 구도 가이드"
                      active={settings.defaultGuide === guide}
                      onPress={() => updateSetting({ defaultGuide: guide })}
                    />
                  ))
                : null}

              {activeSetting === "guideVisible" ? (
                <>
                  <OptionButton
                    label="켜짐"
                    detail="모든 구도 보조 화면에 가이드를 표시합니다."
                    active={settings.guideVisible}
                    onPress={() => updateSetting({ guideVisible: true })}
                  />
                  <OptionButton
                    label="꺼짐"
                    detail="구도 가이드를 숨긴 상태로 시작합니다."
                    active={!settings.guideVisible}
                    onPress={() => updateSetting({ guideVisible: false })}
                  />
                </>
              ) : null}

              {activeSetting === "guideSize"
                ? guideSizeOptions.map((size) => (
                    <OptionButton
                      key={size.value}
                      label={size.label}
                      detail={`${GUIDE_SIZE_MIN}-${GUIDE_SIZE_MAX} 범위의 공통 가이드 크기`}
                      active={settings.guideSize === size.value}
                      onPress={() => updateSetting({ guideSize: size.value, guideVisible: true })}
                    />
                  ))
                : null}

              {activeSetting === "guideStrokeWidth"
                ? guideStrokeWidthOptions.map((strokeWidth) => (
                    <OptionButton
                      key={strokeWidth}
                      label={`${strokeWidth}px`}
                      detail={`${GUIDE_STROKE_WIDTH_MIN}-${GUIDE_STROKE_WIDTH_MAX}px 범위의 공통 가이드 선 두께`}
                      active={settings.guideStrokeWidth === strokeWidth}
                      onPress={() =>
                        updateSetting({
                          guideStrokeWidth: strokeWidth,
                          guideVisible: true
                        })
                      }
                    />
                  ))
                : null}

              {activeSetting === "guideColor"
                ? guideColorOptions.map((color) => (
                    <OptionButton
                      key={color.label}
                      label={color.label}
                      detail="카메라, 사진 편집, 여행 클립에 공통 적용"
                      active={settings.guideColor === color.value}
                      onPress={() => updateSetting({ guideColor: color.value, guideVisible: true })}
                    />
                  ))
                : null}

              {activeSetting === "overlayOpacity"
                ? opacityOptions.map((opacity) => (
                    <OptionButton
                      key={opacity}
                      label={`${Math.round(opacity * 100)}%`}
                      detail="이전 사진 오버레이 기본 투명도"
                      active={settings.overlayOpacity === opacity}
                      onPress={() => updateSetting({ overlayOpacity: opacity })}
                    />
                  ))
                : null}

              {activeSetting === "cameraRatio"
                ? cameraRatioOptions.map((ratio) => (
                    <OptionButton
                      key={ratio}
                      label={ratio}
                      detail="카메라 촬영 사진 저장 비율"
                      active={settings.cameraRatio === ratio}
                      onPress={() => updateSetting({ cameraRatio: ratio })}
                    />
                  ))
                : null}

              {activeSetting === "cameraSaveScope"
                ? cameraSaveScopeOptions.map((scope) => (
                    <OptionButton
                      key={scope.value}
                      label={scope.label}
                      detail={scope.detail}
                      active={settings.cameraSaveScope === scope.value}
                      onPress={() => updateSetting({ cameraSaveScope: scope.value })}
                    />
                  ))
                : null}

              {activeSetting === "defaultRatio"
                ? TRIP_CLIP_RATIOS.map((ratio) => (
                    <OptionButton
                      key={ratio}
                      label={ratio}
                      detail="여행 클립 기본 화면 비율"
                      active={settings.defaultRatio === ratio}
                      onPress={() => updateSetting({ defaultRatio: ratio as TripClipRatio })}
                    />
                  ))
                : null}

              {activeSetting === "tripClipExportFormat"
                ? tripClipExportFormatOptions.map((format) => (
                    <OptionButton
                      key={format.value}
                      label={format.label}
                      detail={format.detail}
                      active={settings.tripClipExportFormat === format.value}
                      onPress={() => updateSetting({ tripClipExportFormat: format.value })}
                    />
                  ))
                : null}

              {activeSetting === "videoQuality"
                ? VIDEO_QUALITY_OPTIONS.map((quality) => (
                    <OptionButton
                      key={quality.id}
                      label={quality.label}
                      detail="동영상 만들기 MP4 저장 화질"
                      active={settings.videoQuality === quality.id}
                      onPress={() => updateSetting({ videoQuality: quality.id })}
                    />
                  ))
                : null}

              {activeSetting === "imageBackupQuality" ? (
                <>
                  <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                    {IMAGE_BACKUP_OPTIMIZATION_MESSAGE}
                  </Text>
                  <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                    {IMAGE_QUALITY_DESCRIPTION}
                  </Text>
                  {IMAGE_QUALITY_OPTIONS.map((quality) => (
                    <OptionButton
                      key={quality.value}
                      label={quality.label}
                      detail={quality.detail}
                      active={settings.imageBackupQuality === quality.value}
                      onPress={() => updateSetting({ imageBackupQuality: quality.value })}
                    />
                  ))}
                </>
              ) : null}

              {activeSetting === "imageSaveFormat"
                ? imageSaveFormatOptions.map((format) => (
                    <OptionButton
                      key={format.value}
                      label={format.label}
                      detail={format.detail}
                      active={settings.imageSaveFormat === format.value}
                      onPress={() => updateSetting({ imageSaveFormat: format.value })}
                    />
                  ))
                : null}

              {activeSetting === "themeMode"
                ? themeOptions.map((theme) => (
                    <OptionButton
                      key={theme.value}
                      label={theme.label}
                      detail={theme.detail}
                      active={settings.themeMode === theme.value}
                      activeMarkFill="transparent"
                      onPress={() => updateSetting({ themeMode: theme.value })}
                    />
                  ))
                : null}

              {activeSetting === "fontStyle"
                ? fontOptions.map((font) => (
                    <OptionButton
                      key={font.value}
                      label={font.label}
                      detail={font.detail}
                      active={settings.fontStyle === font.value}
                      fontStylePreview={font.value}
                      onPress={() => updateSetting({ fontStyle: font.value })}
                    />
                  ))
                : null}

              {activeSetting === "fontSize"
                ? fontSizeOptions.map((fontSize) => (
                    <OptionButton
                      key={fontSize.value}
                      label={fontSize.label}
                      detail={fontSize.detail}
                      active={settings.fontSize === fontSize.value}
                      fontSizePreview={fontSize.value}
                      onPress={() => updateSetting({ fontSize: fontSize.value })}
                    />
                  ))
                : null}

              {activeSetting === "screenLayout"
                ? screenLayoutOptions.map((layout) => (
                    <OptionButton
                      key={layout.value}
                      label={layout.label}
                      detail={layout.detail}
                      active={settings.screenLayout === layout.value}
                      onPress={() => updateSetting({ screenLayout: layout.value })}
                    />
                  ))
                : null}

              {activeSetting === "cloudBackupTargets"
                ? backupTargetOptions.map((option) => (
                    <OptionButton
                      key={option.value}
                      label={option.label}
                      detail={option.detail}
                      active={settings.cloudBackupTargets[option.value] !== false}
                      onPress={() => toggleCloudBackupTarget(option.value)}
                    />
                  ))
                : null}

              {activeSetting === "storageMode" ? (
                <>
                  <View style={[styles.backupStatusPanel, themed.border]}>
                    <Text selectable style={[styles.backupStatusTitle, themed.text]}>
                      현재 저장 방식
                    </Text>
                    <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
                      {getStorageModeLabel(effectiveStorageMode)}
                    </Text>
                    <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
                      사진 {backupOverview.photoCount}장 / 여러 사진 작업{" "}
                      {backupOverview.imageBundleCount}개 / 영상 {backupOverview.videoCount}개
                    </Text>
                    <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
                      {formatImageBackupUsage(backupOverview.imageBackupBytes)}
                    </Text>
                    <Text selectable style={[styles.backupStatusDetail, themed.mutedText]}>
                      {IMAGE_BACKUP_OPTIMIZATION_MESSAGE}
                    </Text>
                    {backupFailures.length > 0 ? (
                      <Pressable
                        disabled={isBackupSubmitting}
                        style={[
                          styles.authSecondaryButton,
                          themed.secondaryButton,
                          isBackupSubmitting && styles.disabledButton
                        ]}
                        onPress={retryBackupFailures}
                      >
                        <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                          실패한 백업 다시 시도 ({backupFailures.length})
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {STORAGE_MODE_OPTIONS.map((option) => {
                    const isSaverOption = option.value === "local_saver";
                    const isDisabled =
                      isBackupSubmitting ||
                      (isSaverOption && !planEntitlements.canBackupToCloud);
                    const detail =
                      isSaverOption && !planEntitlements.canBackupToCloud
                        ? storageSaverUpgradeMessage
                        : option.detail;
                    const onPress = () => {
                      if (option.value === "local_only") {
                        void updateSetting({
                          storageMode: "local_only",
                          cloudBackupEnabled: false
                        });
                        return;
                      }

                      void handleEnableBackup(option.value);
                    };

                    return (
                      <OptionButton
                        key={option.value}
                        label={option.label}
                        detail={detail}
                        active={settings.storageMode === option.value}
                        disabled={isDisabled}
                        onPress={onPress}
                      />
                    );
                  })}
                  <Pressable
                    disabled={isBackupSubmitting}
                    style={[
                      styles.deleteBackupButton,
                      themed.secondaryButton,
                      isBackupSubmitting && styles.disabledButton
                    ]}
                    onPress={handleDeleteBackupData}
                  >
                    <Text selectable={false} style={[styles.deleteBackupButtonText, themed.text]}>
                      백업 데이터 삭제
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isBackupSubmitting && Boolean(backupCheckMessage)}
        onRequestClose={() => undefined}
      >
        <View style={[styles.modalBackdrop, modalSafeStyle]}>
          <View style={[styles.modalPanel, styles.backupProgressPanel, themed.modalPanel]}>
            <View style={styles.backupProgressHeader}>
              <ActivityIndicator color={palette.text} />
              <View style={styles.backupProgressCopy}>
                <Text selectable={false} style={[styles.modalTitle, themed.text]}>
                  백업 상태 확인 중
                </Text>
                <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                  {backupCheckMessage}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showBackupConfirm}
        onRequestClose={() => setShowBackupConfirm(false)}
      >
        <View style={[styles.modalBackdrop, modalSafeStyle]}>
          <View style={[styles.modalPanel, themed.modalPanel]}>
            <View style={styles.modalHeader}>
              <Text selectable style={[styles.modalTitle, themed.text]}>
                기존 작업을 백업할까요?
              </Text>
              <Pressable
                style={[styles.closeButton, themed.secondaryButton]}
                onPress={() => setShowBackupConfirm(false)}
              >
                <Text selectable={false} style={[styles.closeButtonText, themed.text]}>
                  닫기
                </Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.optionList}
              showsVerticalScrollIndicator={false}
            >
              <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                현재 기기에 저장된 사진, 편집 결과, 영상 만들기 작업, 만든 영상 기록과 앱 설정을 계정 백업으로 저장합니다.
              </Text>
              <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                {IMAGE_BACKUP_OPTIMIZATION_MESSAGE} {IMAGE_QUALITY_DESCRIPTION}
              </Text>
              <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                구독 기간이 끝나면 새 백업은 중단됩니다. 기존 백업 데이터 삭제는 이 화면에서 직접 요청할 수 있습니다.
              </Text>
              <Pressable
                disabled={isBackupSubmitting}
                style={[
                  styles.authPrimaryButton,
                  themed.activeFill,
                  isBackupSubmitting && styles.disabledButton
                ]}
                onPress={confirmBackup}
              >
                {isBackupSubmitting ? (
                  <ActivityIndicator color={palette.inverse} />
                ) : (
                  <Text selectable={false} style={[styles.authPrimaryButtonText, themed.inverseText]}>
                    모두 백업하기
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={isBackupSubmitting && Boolean(backupProgress)}
        onRequestClose={() => undefined}
      >
        <View style={[styles.modalBackdrop, modalSafeStyle]}>
          <View style={[styles.modalPanel, styles.backupProgressPanel, themed.modalPanel]}>
            {backupProgress ? (
              <>
                <View style={styles.backupProgressHeader}>
                  <ActivityIndicator color={palette.text} />
                  <View style={styles.backupProgressCopy}>
                    <Text selectable style={[styles.modalTitle, themed.text]}>
                      백업 중
                    </Text>
                    <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                      백업 중입니다. 앱을 닫지 말고 잠시만 기다려 주세요.
                    </Text>
                  </View>
                </View>
                <Text selectable style={[styles.optionDetail, themed.mutedText]}>
                  {backupProgress.detail}
                </Text>
                <View style={styles.backupProgressTrack}>
                  <View
                    style={[
                      styles.backupProgressFill,
                      { width: `${Math.max(0, Math.min(100, backupProgress.percent))}%` }
                    ]}
                  />
                </View>
                <Text selectable style={[styles.backupProgressText, themed.text]}>
                  {Math.round(backupProgress.percent)}%
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <AppGuideOverlay tabKey="settings" replaySignal={guideReplaySignal} />
    </>
  );
}

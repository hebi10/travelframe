import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { ActionRow } from "@/components/action-row";
import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { colors, controls, spacing, typography } from "@/constants/app-theme";
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
import {
  DEFAULT_GUIDE_COLOR,
  GUIDE_SIZE_MAX,
  GUIDE_SIZE_MIN,
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  type ExportQuality,
  type FontSize,
  type FontStyle,
  type ScreenLayout,
  type ThemeMode
} from "@/lib/app-settings";
import { type AppPalette, useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
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
import { formatImageBackupUsage } from "@/lib/image-backup-utils";
import { resetAppGuideProgress } from "@/lib/guide-progress";
import { getPhotos } from "@/lib/photo-library";
import { isCreatorSubscriptionActive } from "@/lib/subscription";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { getMadeVideos } from "@/lib/video-library";
import { getImageBundleWorks } from "@/lib/work-library";

type SettingKey =
  | "defaultGuide"
  | "guideVisible"
  | "guideSize"
  | "guideStrokeWidth"
  | "guideColor"
  | "overlayOpacity"
  | "defaultRatio"
  | "exportQuality"
  | "themeMode"
  | "fontStyle"
  | "fontSize"
  | "screenLayout"
  | "cloudBackupEnabled"
  | "imageBackupQuality";

const opacityOptions = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

const emptyBackupOverview: CloudBackupOverview = {
  photoCount: 0,
  imageBundleCount: 0,
  videoCount: 0,
  imageBackupBytes: 0,
  deleteAfter: null,
  status: "none",
  backedUpAt: null,
  deletedAt: null
};

const formatBackupDateTime = (value?: string | null) => {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};

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

const qualityOptions: {
  value: ExportQuality;
  label: string;
  detail: string;
}[] = [
  { value: "standard", label: "표준", detail: "가볍게 저장하고 빠르게 내보냅니다." },
  { value: "high", label: "높음", detail: "화질과 용량의 균형을 맞춥니다." },
  { value: "max", label: "최대", detail: "가장 높은 품질로 저장합니다." }
];

const qualityLabel: Record<ExportQuality, string> = {
  standard: "표준",
  high: "높음",
  max: "최대"
};

const imageQualityLabel = IMAGE_QUALITY_OPTIONS.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label
  }),
  {} as Record<(typeof IMAGE_QUALITY_OPTIONS)[number]["value"], string>
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
    signUp,
    logOut
  } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [activeSetting, setActiveSetting] = useState<SettingKey | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [showDeleteRequestInfo, setShowDeleteRequestInfo] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [isBackupSubmitting, setIsBackupSubmitting] = useState(false);
  const [backupProgress, setBackupProgress] =
    useState<BackupProgressUpdate | null>(null);
  const [backupFailures, setBackupFailures] = useState<BackupFailureRecord[]>([]);
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(emptyBackupOverview);

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
        const [storedSettings, storedBackupFailures] = await Promise.all([
          getAppSettings(),
          getBackupFailures()
        ]);
        await markBackupExpired({ user, subscription });
        if (isActive) {
          setSettings(storedSettings);
          setBackupFailures(storedBackupFailures);
        }
      };

      loadSettings();

      return () => {
        isActive = false;
      };
    }, [subscription, user])
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

    if (activeSetting === "exportQuality") {
      return "저장 품질";
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

    if (activeSetting === "cloudBackupEnabled") {
      return "클라우드 백업";
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

  const openDeleteRequestPage = () => {
    setShowDeleteRequestInfo(false);
    void Linking.openURL(DELETE_ACCOUNT_REQUEST_URL);
  };

  const handleResetGuideProgress = async () => {
    await resetAppGuideProgress();
    setAuthMessage("사용 가이드를 다시 볼 수 있도록 초기화했습니다. 각 탭에 들어가면 안내가 다시 표시됩니다.");
  };

  const handleEnableBackup = async () => {
    if (isBackupSubmitting) {
      return;
    }

    if (!isLoggedIn || !user) {
      setAuthMessage("로그인 후 백업을 사용할 수 있습니다.");
      setActiveSetting(null);
      return;
    }

    if (!isCreatorSubscriptionActive(subscription)) {
      await markBackupExpired({ user, subscription });
      setAuthMessage(
        "구독 기간이 만료되었거나 활성화되지 않았습니다. 백업은 사용할 수 없고 기존 백업 데이터 삭제는 설정에서 직접 요청할 수 있습니다."
      );
      setActiveSetting(null);
      return;
    }

    try {
      setIsBackupSubmitting(true);
      setAuthMessage(null);
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
      const summary = await backupCurrentWorkspace({
        user,
        subscription,
        onProgress: setBackupProgress
      });
      await updateSetting({ cloudBackupEnabled: true });
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
      await updateSetting({ cloudBackupEnabled: true });
      setAuthMessage(
        `클라우드 백업을 불러왔습니다. 사진 ${summary.photoCount}장, 여러 사진 작업 ${summary.imageBundleCount}개, 영상 ${summary.videoCount}개를 현재 기기 목록에 반영했습니다.`
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
        "클라우드 백업 데이터를 불러오면 현재 기기의 사진, 작업물, 영상 목록이 클라우드 백업 기준으로 변경됩니다. 자동 병합하지 않습니다. 계속하시겠습니까?",
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

    if (!settings.cloudBackupEnabled || !isCreatorSubscriptionActive(subscription)) {
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

            await backupPhotoIfEnabled({ user, subscription, photo });
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
              await updateSetting({ cloudBackupEnabled: false });
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
                    disabled={isAuthLoading || isAuthSubmitting}
                    style={[
                      styles.authPrimaryButton,
                      themed.activeFill,
                      isAuthSubmitting && styles.disabledButton
                    ]}
                    onPress={() => handleAuthAction("signIn")}
                  >
                    <Text selectable={false} style={[styles.authPrimaryButtonText, themed.inverseText]}>
                      로그인
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isAuthLoading || isAuthSubmitting}
                    style={[
                      styles.authSecondaryButton,
                      themed.secondaryButton,
                      isAuthSubmitting && styles.disabledButton
                    ]}
                    onPress={() => handleAuthAction("signUp")}
                  >
                    <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                      회원가입
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isFirebaseReady && isLoggedIn ? (
              <View style={styles.loggedInActions}>
                <ActionRow
                  label="클라우드 백업"
                  detail="켜면 저장한 영상과 여러 사진 작업을 계정에 백업합니다."
                  mark={settings.cloudBackupEnabled ? "켜짐" : "꺼짐"}
                  onPress={() => setActiveSetting("cloudBackupEnabled")}
                />
                <View style={[styles.backupStatusPanel, themed.panel]}>
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
          <ActionRow
            label="사용 가이드 다시 보기"
            detail="처음 사용하는 사람을 위한 화면별 안내를 다시 표시합니다."
            mark="초기화"
            onPress={handleResetGuideProgress}
          />
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
            label="기본 비율"
            detail="여행 클립을 열 때 먼저 선택되는 화면 비율"
            mark={settings.defaultRatio}
            onPress={() => setActiveSetting("defaultRatio")}
          />
          <ActionRow
            label="저장 품질"
            detail="편집 사진과 영상 업로드 이미지 압축 품질"
            mark={qualityLabel[settings.exportQuality]}
            onPress={() => setActiveSetting("exportQuality")}
          />
          <ActionRow
            label="이미지 백업 화질"
            detail={IMAGE_BACKUP_OPTIMIZATION_MESSAGE}
            mark={imageQualityLabel[settings.imageBackupQuality]}
            onPress={() => setActiveSetting("imageBackupQuality")}
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

              {activeSetting === "exportQuality"
                ? qualityOptions.map((quality) => (
                    <OptionButton
                      key={quality.value}
                      label={quality.label}
                      detail={quality.detail}
                      active={settings.exportQuality === quality.value}
                      onPress={() => updateSetting({ exportQuality: quality.value })}
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

              {activeSetting === "themeMode"
                ? themeOptions.map((theme) => (
                    <OptionButton
                      key={theme.value}
                      label={theme.label}
                      detail={theme.detail}
                      active={settings.themeMode === theme.value}
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

              {activeSetting === "cloudBackupEnabled" ? (
                <>
                  <View style={[styles.backupStatusPanel, themed.panel]}>
                    <Text selectable style={[styles.backupStatusTitle, themed.text]}>
                      현재 백업
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
                  <OptionButton
                    label="켜짐"
                    detail="저장한 영상과 여러 사진 작업을 Firebase에 백업합니다."
                    active={settings.cloudBackupEnabled}
                    onPress={handleEnableBackup}
                  />
                  <OptionButton
                    label="꺼짐"
                    detail="사진과 영상은 기기 안에만 저장합니다."
                    active={!settings.cloudBackupEnabled}
                    onPress={() => updateSetting({ cloudBackupEnabled: false })}
                  />
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
      <AppGuideOverlay tabKey="settings" />
    </>
  );
}

function OptionButton({
  label,
  detail,
  active,
  onPress
}: {
  label: string;
  detail: string;
  active: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppAppearance();
  const themed = useMemo(() => createThemedStyles(palette), [palette]);

  return (
    <Pressable
      style={[
        styles.option,
        themed.panel,
        active && styles.optionActive,
        active && themed.activeFill
      ]}
      onPress={onPress}
    >
      <View style={styles.optionCopy}>
        <Text
          selectable
          style={[
            styles.optionLabel,
            themed.text,
            active && styles.optionLabelActive,
            active && themed.inverseText
          ]}
        >
          {label}
        </Text>
        <Text
          selectable
          style={[
            styles.optionDetail,
            themed.mutedText,
            active && styles.optionDetailActive,
            active && themed.inverseMutedText
          ]}
        >
          {detail}
        </Text>
      </View>
      <View style={[styles.optionMark, themed.optionMark, active && themed.optionMarkActive]} />
    </Pressable>
  );
}

const createThemedStyles = (palette: AppPalette) => {
  const isDark = palette.background !== colors.background;

  return StyleSheet.create({
    panel: {
      borderColor: palette.line,
      backgroundColor: palette.surface
    },
    panelStrong: {
      borderColor: palette.line,
      backgroundColor: palette.surface
    },
    modalPanel: {
      borderTopColor: palette.line,
      backgroundColor: palette.background
    },
    border: {
      borderColor: palette.line
    },
    activeBorder: {
      borderColor: palette.text
    },
    activeFill: {
      borderColor: palette.text,
      backgroundColor: isDark ? "transparent" : palette.text
    },
    secondaryButton: {
      borderColor: palette.line,
      backgroundColor: palette.background
    },
    colorButton: {
      borderColor: palette.line,
      backgroundColor: palette.background
    },
    input: {
      borderColor: palette.line,
      color: palette.text,
      backgroundColor: palette.background
    },
    text: {
      color: palette.text
    },
    mutedText: {
      color: palette.muted
    },
    inverseText: {
      color: isDark ? palette.text : palette.inverse
    },
    inverseMutedText: {
      color: isDark ? palette.text : palette.inverse
    },
    optionMark: {
      borderColor: palette.faint,
      backgroundColor: "transparent"
    },
    optionMarkActive: {
      borderColor: isDark ? palette.text : palette.inverse,
      backgroundColor: isDark ? "transparent" : palette.inverse
    }
  });
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.42)"
  },
  modalPanel: {
    gap: 18,
    flexGrow: 0,
    maxHeight: "86%",
    padding: spacing.screen,
    paddingBottom: spacing.section,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    backgroundColor: colors.background
  },
  modalScroll: {
    flexGrow: 0
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    letterSpacing: 0
  },
  closeButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  closeButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  optionList: {
    gap: 8
  },
  option: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  optionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  optionCopy: {
    flex: 1,
    gap: 4
  },
  optionLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 0
  },
  optionLabelActive: {
    color: colors.inverse
  },
  optionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
    letterSpacing: 0
  },
  optionDetailActive: {
    color: "rgba(255, 255, 255, 0.74)"
  },
  optionMark: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 999
  },
  optionMarkActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.inverse
  },
  guidePanel: {
    gap: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guidePanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  guidePanelCopy: {
    flex: 1,
    gap: 5
  },
  guidePanelTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 21,
    letterSpacing: 0
  },
  guidePanelDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  guideCollapsedRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  guideSummary: {
    flex: 1,
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "800",
    lineHeight: 18,
    letterSpacing: 0
  },
  guideExpandButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideExpandButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  guideVisibleButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  guideVisibleButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  guideVisibleButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  guideVisibleButtonTextActive: {
    color: colors.inverse
  },
  compactGroup: {
    gap: 9
  },
  guidePreviewBlock: {
    gap: 9
  },
  guidePreviewFrame: {
    height: 172,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: colors.darkLine,
    backgroundColor: colors.ink
  },
  guidePreviewSky: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "58%",
    backgroundColor: "#26343A"
  },
  guidePreviewGround: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "48%",
    backgroundColor: "#161817"
  },
  guidePreviewSubject: {
    position: "absolute",
    left: "38%",
    bottom: 30,
    width: "24%",
    height: "42%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.38)",
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  guidePreviewDisabled: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.38)"
  },
  guidePreviewDisabledText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  compactGroupTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900",
    letterSpacing: 0
  },
  compactOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  compactOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  compactOptionActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  compactOptionText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  compactOptionTextActive: {
    color: colors.inverse
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6
  },
  colorButton: {
    width: "15.8%",
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  colorButtonActive: {
    borderColor: colors.text
  },
  colorSwatch: {
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: "transparent"
  },
  colorSwatchLight: {
    borderColor: colors.faint
  },
  colorButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0
  },
  accountPanel: {
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  accountCopy: {
    flex: 1,
    gap: 5
  },
  accountTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "900",
    lineHeight: 21,
    letterSpacing: 0
  },
  accountDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  accountBadge: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  accountBadgeActive: {
    borderColor: colors.text,
    backgroundColor: colors.text
  },
  accountBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  },
  accountBadgeTextActive: {
    color: colors.inverse
  },
  accountNotice: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  authForm: {
    gap: 8
  },
  authInput: {
    minHeight: controls.height,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0,
    backgroundColor: colors.background
  },
  authActions: {
    flexDirection: "row",
    gap: 8
  },
  loggedInActions: {
    gap: 10
  },
  backupStatusPanel: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background
  },
  backupStatusTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "900",
    letterSpacing: 0
  },
  backupStatusDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  backupProgressPanel: {
    gap: 14
  },
  backupProgressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  backupProgressCopy: {
    flex: 1,
    gap: 6
  },
  backupProgressTrack: {
    height: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(0, 0, 0, 0.08)"
  },
  backupProgressFill: {
    height: "100%",
    backgroundColor: colors.text
  },
  backupProgressText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    textAlign: "right",
    letterSpacing: 0
  },
  deleteBackupButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  deleteBackupButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  deleteRequestPrimaryButton: {
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  authPrimaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text
  },
  authPrimaryButtonText: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  authSecondaryButton: {
    flex: 1,
    minHeight: controls.height,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background
  },
  authSecondaryButtonText: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  },
  disabledButton: {
    opacity: 0.45
  },
  authMessage: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  }
});

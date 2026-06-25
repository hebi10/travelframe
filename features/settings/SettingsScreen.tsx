import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
  GUIDE_STROKE_WIDTH_MAX,
  GUIDE_STROKE_WIDTH_MIN,
  defaultAppSettings,
  createCameraSaveScope,
  getAppSettings,
  getCameraSaveScopeTargets,
  getGuideSizeBounds,
  saveAppSettings,
  subscribeAppSettings,
  type AppSettings,
  type CameraSaveTarget,
  type CloudBackupTarget,
  type StorageMode,
} from "@/lib/app-settings";
import {
  useAppAppearance
} from "@/lib/app-appearance";
import {
  GOOGLE_SIGN_IN_MESSAGES,
  getGoogleSignInErrorMessage,
  isGoogleSignInConfigured,
  signInWithGoogleAuthSession
} from "@/lib/google-auth";
import { APP_FONT_OPTIONS, getFontOptionLabel } from "@/lib/app-fonts";
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
import { GuideSizeSlider } from "@/features/camera/camera-screen.components";
import { OptionButton } from "@/features/settings/settings-screen.components";
import { emptyBackupOverview, emptyUsageStats, type UsageStats } from "@/features/settings/settings-screen.constants";
import {
  clampSettingsGuideSizeInRange,
  formatBackupDateTime,
  formatQuotaValue,
  formatStorageQuotaValue
} from "@/features/settings/settings-screen.helpers";
import { createThemedStyles, styles } from "@/features/settings/settings-screen.styles";
import { backupTargetOptions, cameraRatioOptions, cameraSaveScopeOptions, fontSizeLabel, fontSizeOptions, getBackupTargetsSummary, getCameraSaveScopeLabel, guideColorOptions, guideLineOpacityOptions, guideSizeOptions, guideStrokeWidthOptions, imageQualityLabel, imageSaveFormatLabel, imageSaveFormatOptions, storageModeLegend, themeLabel, themeOptions, tripClipExportFormatLabel, tripClipExportFormatOptions, videoQualityLabel, type SettingKey } from "@/features/settings/settings-screen.model";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { palette, fontFamily } = useAppAppearance();
  const themed = useMemo(
    () => createThemedStyles(palette, fontFamily),
    [palette, fontFamily]
  );
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
  const guideSizeBounds = useMemo(
    () => getGuideSizeBounds(settings.defaultGuide),
    [settings.defaultGuide]
  );
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
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const isGoogleReady = isGoogleSignInConfigured({
    androidClientId: googleAndroidClientId
  });
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const canSelectCloudSaveTarget = planEntitlements.canBackupToCloud;
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

    if (activeSetting === "guideLineOpacity") {
      return "가이드 라인 투명도";
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

  const toggleCameraSaveTarget = async (target: CameraSaveTarget) => {
    if (target === "cloud" && !canSelectCloudSaveTarget) {
      return;
    }

    const targets = getCameraSaveScopeTargets(settings.cameraSaveScope);
    const nextTargets = {
      ...targets,
      [target]: !targets[target]
    };
    if (!nextTargets.app && !nextTargets.device && !nextTargets.cloud) {
      return;
    }

    const nextSettings = {
      ...settings,
      cameraSaveScope: createCameraSaveScope(nextTargets),
      ...(target === "cloud" && nextTargets.cloud
        ? { storageMode: "local_backup" as const, cloudBackupEnabled: true }
        : {})
    };
    setSettings(nextSettings);
    await saveAppSettings(nextSettings);
  };

  const previewGuideSize = (value: number) => {
    setSettings((current) => ({
      ...current,
      guideSize: clampSettingsGuideSizeInRange(
        value,
        guideSizeBounds.min,
        guideSizeBounds.max
      ),
      guideVisible: true
    }));
  };

  const commitGuideSize = (value: number) => {
    void updateSetting({
      guideSize: clampSettingsGuideSizeInRange(
        value,
        guideSizeBounds.min,
        guideSizeBounds.max
      ),
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

      if (targetStorageMode !== "local_only" && !canSelectCloudSaveTarget) {
        setAuthMessage("Pro 결제 후 클라우드 백업을 사용할 수 있습니다. 현재는 앱 보관함에만 저장됩니다.");
        setActiveSetting(null);
        return;
      }

      if (!isCreatorSubscriptionActive(latestSubscription)) {
        if (targetStorageMode === "local_backup") {
          setAuthMessage(
            "저장 방식은 클라우드 백업으로 설정했습니다. 클라우드 업로드는 Pro 이상에서 자동으로 실행됩니다."
          );
          setActiveSetting(null);
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
      setAuthMessage(getUserFacingErrorMessage(error, "백업 상태를 확인하지 못했습니다."));
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
      setAuthMessage(getUserFacingErrorMessage(error, "백업 중 문제가 발생했습니다."));
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
      setAuthMessage(getUserFacingErrorMessage(error, "클라우드 백업을 불러오지 못했습니다."));
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

  const handleRestoreBackupPress = async () => {
    if (isBackupSubmitting) {
      return;
    }

    if (!isLoggedIn || !user) {
      setAuthMessage("로그인 후 백업 데이터를 불러올 수 있습니다.");
      return;
    }

    let localSummary: LocalWorkspaceSummary;

    try {
      setIsBackupSubmitting(true);
      setBackupCheckMessage("백업 데이터를 확인하고 있습니다.");
      setAuthMessage(null);
      localSummary = await getLocalWorkspaceSummary();
    } catch (error) {
      setAuthMessage(getUserFacingErrorMessage(error, "백업 데이터를 확인하지 못했습니다."));
      return;
    } finally {
      setIsBackupSubmitting(false);
      setBackupCheckMessage(null);
    }

    confirmCloudRestore(localSummary);
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
              enabled: settings.cloudBackupEnabled,
              subscription: latestSubscription
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
              enabled: settings.cloudBackupEnabled,
              subscription: latestSubscription
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
      setAuthMessage(getUserFacingErrorMessage(error, "백업을 다시 시도하지 못했습니다."));
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
              setAuthMessage(getUserFacingErrorMessage(error, "백업 데이터를 삭제하지 못했습니다."));
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
                ? "로그인 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
                : "로그인 처리 중 문제가 발생했습니다."
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (isGoogleSubmitting) {
      return;
    }

    if (!isGoogleReady) {
      setAuthMessage(GOOGLE_SIGN_IN_MESSAGES.missingConfig);
      return;
    }

    const runGoogleLogin = async () => {
      setIsGoogleSubmitting(true);
      setAuthMessage(null);
      const result = await signInWithGoogleAuthSession({
        androidClientId: googleAndroidClientId,
        signInWithGoogleIdToken
      });
      setAuthMessage(
        result === "success"
          ? GOOGLE_SIGN_IN_MESSAGES.success
          : GOOGLE_SIGN_IN_MESSAGES.cancelled
      );
    };

    runGoogleLogin().catch((error) => {
      setAuthMessage(
        getGoogleSignInErrorMessage(error, (fallbackError) =>
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        )
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
                    ? planEntitlements.canBackupToCloud
                      ? `${user?.email ?? "계정"}으로 Pro 기능과 클라우드 백업을 사용할 수 있습니다.`
                      : `${user?.email ?? "계정"}으로 로그인하면 사진 편집과 MP4 영상 주 1회 기능을 사용할 수 있습니다.`
                    : "비로그인 상태에서는 촬영과 앱 보관함 저장만 사용할 수 있습니다."}
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
                로그인 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.
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
                  onPress={planEntitlements.canBackupToCloud ? () => setActiveSetting("cloudBackupTargets") : undefined}
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
                    disabled={isBackupSubmitting || !planEntitlements.canBackupToCloud}
                    style={[
                      styles.authSecondaryButton,
                      themed.secondaryButton,
                      (isBackupSubmitting || !planEntitlements.canBackupToCloud) && styles.disabledButton
                    ]}
                    onPress={planEntitlements.canBackupToCloud ? handleRestoreBackupPress : undefined}
                  >
                    <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                      백업 데이터 불러오기
                    </Text>
                  </Pressable>
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
              클라우드 백업:{" "}
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
            detail="앱에서 사용할 글꼴"
            mark={getFontOptionLabel(settings.fontStyle)}
            onPress={() => setActiveSetting("fontStyle")}
          />
          <ActionRow
            label="폰트 크기"
            detail="앱 화면의 글자 크기"
            mark={fontSizeLabel[settings.fontSize]}
            onPress={() => setActiveSetting("fontSize")}
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
            </View>

            <View style={styles.guideCollapsedRow}>
              <Text selectable style={[styles.guideSummary, themed.mutedText]}>
                {GUIDE_LABELS[settings.defaultGuide]} / {settings.guideSize} / {settings.guideStrokeWidth}px /{" "}
                {Math.round(settings.guideLineOpacity * 100)}%
              </Text>
              {guideExpanded ? (
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
              ) : null}
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
                  offsetFrameWidth={settings.guideOffsetFrameWidth}
                  offsetFrameHeight={settings.guideOffsetFrameHeight}
                  gridLinePositions={settings.gridGuideLinePositions}
                  shapePoints={settings.guideShapePoints}
                  opacity={settings.guideLineOpacity}
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
                    onPress={() => {
                      const nextGuideSizeBounds = getGuideSizeBounds(guide);
                      updateSetting({
                        defaultGuide: guide,
                        guideSize: clampSettingsGuideSizeInRange(
                          settings.guideSize,
                          nextGuideSizeBounds.min,
                          nextGuideSizeBounds.max
                        ),
                        guideVisible: true
                      });
                    }}
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
              <GuideSizeSlider
                compact
                value={settings.guideSize}
                min={guideSizeBounds.min}
                max={guideSizeBounds.max}
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
                가이드 라인 투명도
              </Text>
              <View style={styles.compactOptionRow}>
                {guideLineOpacityOptions.map((opacity) => (
                  <Pressable
                    key={opacity}
                    style={[
                      styles.compactOption,
                      themed.secondaryButton,
                      settings.guideLineOpacity === opacity && styles.compactOptionActive,
                      settings.guideLineOpacity === opacity && themed.activeFill
                    ]}
                    onPress={() => updateSetting({ guideLineOpacity: opacity })}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.compactOptionText,
                        themed.text,
                        settings.guideLineOpacity === opacity && styles.compactOptionTextActive,
                        settings.guideLineOpacity === opacity && themed.inverseText
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
            detail="카메라 촬영 사진을 앱 보관함, 핸드폰 앨범, 클라우드 중 어디에 저장할지 선택"
            mark={getCameraSaveScopeLabel(settings.cameraSaveScope)}
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
              <Text selectable={false} style={[styles.modalTitle, themed.text]}>
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
              <Text selectable={false} style={[styles.modalTitle, themed.text]}>
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
                      onPress={() => {
                        const nextGuideSizeBounds = getGuideSizeBounds(guide);
                        updateSetting({
                          defaultGuide: guide,
                          guideSize: clampSettingsGuideSizeInRange(
                            settings.guideSize,
                            nextGuideSizeBounds.min,
                            nextGuideSizeBounds.max
                          )
                        });
                      }}
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
                      detail={`${guideSizeBounds.min}-${guideSizeBounds.max} 범위의 공통 가이드 크기`}
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

              {activeSetting === "guideLineOpacity"
                ? guideLineOpacityOptions.map((opacity) => (
                    <OptionButton
                      key={opacity}
                      label={`${Math.round(opacity * 100)}%`}
                      detail="카메라, 사진 편집, 영상 만들기에 적용되는 가이드 라인 투명도"
                      active={settings.guideLineOpacity === opacity}
                      onPress={() => updateSetting({ guideLineOpacity: opacity })}
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
                ? cameraSaveScopeOptions.map((scope) => {
                    const isCloudSaveTargetDisabled = scope.value === "cloud" && !canSelectCloudSaveTarget;

                    return (
                      <OptionButton
                        key={scope.value}
                        label={scope.label}
                        detail={scope.detail}
                        active={getCameraSaveScopeTargets(settings.cameraSaveScope)[scope.value] && !isCloudSaveTargetDisabled}
                        disabled={isCloudSaveTargetDisabled}
                        onPress={() => toggleCameraSaveTarget(scope.value)}
                      />
                    );
                  })
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
                ? APP_FONT_OPTIONS.map((font) => (
                    <OptionButton
                      key={font.value}
                      label={font.label}
                      detail={font.detail}
                      active={settings.fontStyle === font.value}
                      fontFamilyPreview={font.value}
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

              {activeSetting === "cloudBackupTargets"
                ? backupTargetOptions.map((option) => (
                    <OptionButton
                      key={option.value}
                      label={option.label}
                      detail={option.detail}
                      active={settings.cloudBackupTargets[option.value] !== false}
                      disabled={!canSelectCloudSaveTarget}
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
                    <Pressable
                      disabled={isBackupSubmitting || !planEntitlements.canBackupToCloud}
                      style={[
                        styles.authSecondaryButton,
                        themed.secondaryButton,
                        (isBackupSubmitting || !planEntitlements.canBackupToCloud) && styles.disabledButton
                      ]}
                      onPress={planEntitlements.canBackupToCloud ? handleRestoreBackupPress : undefined}
                    >
                      <Text selectable={false} style={[styles.authSecondaryButtonText, themed.text]}>
                        백업 데이터 불러오기
                      </Text>
                    </Pressable>
                  </View>
                  {STORAGE_MODE_OPTIONS.map((option) => {
                    const isCloudBackupOptionDisabled =
                      option.value !== "local_only" && !canSelectCloudSaveTarget;
                    const isDisabled = isBackupSubmitting || isCloudBackupOptionDisabled;
                    const detail = option.detail;
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
              <Text selectable={false} style={[styles.modalTitle, themed.text]}>
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
                    <Text selectable={false} style={[styles.modalTitle, themed.text]}>
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

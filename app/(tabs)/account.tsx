import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import {
  DELETE_ACCOUNT_REQUEST_URL,
  PRIVACY_POLICY_URL
} from "@/constants/legal-links";
import { useAuth } from "@/lib/auth-context";
import {
  getUserSubscriptionProducts,
  isPremiumSubscription,
  type UserSubscriptionProducts
} from "@/lib/subscription";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import {
  getEffectiveStorageMode,
  getStorageModeLabel
} from "@/lib/storage-mode";
import { getPhotos } from "@/lib/photo-library";
import { getMadeVideos } from "@/lib/video-library";
import { getImageBundleWorks } from "@/lib/work-library";
import {
  deleteUserMusicTrack,
  pickAndUploadUserMusicTrack,
  syncUserMusicTracks,
  type UserMusicTrack
} from "@/lib/user-music";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  GOOGLE_SIGN_IN_MESSAGES,
  getGoogleSignInErrorMessage,
  isGoogleSignInConfigured,
  signInWithGoogleAuthSession
} from "@/lib/google-auth";
import {
  getAppSettings,
  isCloudBackupTargetEnabled,
  type StorageMode
} from "@/lib/app-settings";
import {
  subscribeCloudBackupOverview,
  type CloudBackupOverview
} from "@/lib/cloud-backup";
import {
  formatImageBackupUsage
} from "@/lib/image-backup-utils";
import {
  getWeeklyVideoExportUsage,
  type WeeklyVideoExportUsage
} from "@/lib/video-export-quota";
import { InfoRow, StatCard, StatusBadge } from "@/features/account/account-screen.components";
import {
  initialBackupOverview,
  initialStats,
  initialSubscriptionProducts,
  paymentPlans,
  signedInBenefits,
  type AuthMode,
  type PaymentPlan,
  type UsageStats
} from "@/features/account/account-screen.constants";
import {
  formatDateTime,
  formatQuotaValue,
  formatStorageQuotaValue,
  getAuthErrorMessage
} from "@/features/account/account-screen.helpers";
import { createAccountThemedStyles, styles } from "@/features/account/account-screen.styles";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { palette, fontFamily } = useAppAppearance();
  const themed = useMemo(
    () => createAccountThemedStyles(palette, fontFamily),
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
    cachedSubscription,
    subscriptionStatus,
    isLoggedIn,
    hasFullAccess,
    isAuthLoading,
    isFirebaseReady,
    signIn,
    signInWithGoogleIdToken,
    signUp,
    logOut,
    sendVerificationEmail,
    resetPassword,
    refreshUser
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isMusicSubmitting, setIsMusicSubmitting] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<PaymentPlan | null>(null);
  const [showDeleteRequestInfo, setShowDeleteRequestInfo] = useState(false);
  const [stats, setStats] = useState<UsageStats>(initialStats);
  const [storageMode, setStorageMode] = useState<StorageMode>("local_only");
  const [backupOverview, setBackupOverview] =
    useState<CloudBackupOverview>(initialBackupOverview);
  const [isSubscriptionProductsLoading, setIsSubscriptionProductsLoading] =
    useState(true);
  const [subscriptionProducts, setSubscriptionProducts] = useState<UserSubscriptionProducts>(
    initialSubscriptionProducts
  );
  const [musicTracks, setMusicTracks] = useState<UserMusicTrack[]>([]);
  const [weeklyVideoExportUsage, setWeeklyVideoExportUsage] =
    useState<WeeklyVideoExportUsage | null>(null);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const isGoogleReady = isGoogleSignInConfigured({
    webClientId: googleWebClientId,
    androidClientId: googleAndroidClientId
  });
  const isSubscriptionCheckFailed = subscriptionStatus === "failed";
  const displaySubscription = isSubscriptionCheckFailed ? cachedSubscription : subscription;
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const effectiveStorageMode = getEffectiveStorageMode(
    storageMode,
    planEntitlements.canBackupToCloud
  );
  const localImageUsage =
    stats.originalPhotos + stats.editedPhotos + stats.imageBundles;
  const weeklyVideoUsed =
    weeklyVideoExportUsage?.count ?? 0;
  const subscriptionDisplayName = isSubscriptionCheckFailed
    ? isPremiumSubscription(cachedSubscription)
      ? `확인 불가 (최근 캐시: ${cachedSubscription.productName})`
      : "확인 불가"
    : subscription.status === "active"
      ? subscription.productName
      : "무료 플랜";

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsSubscriptionProductsLoading(true);

      const loadStats = async () => {
        const [
          photos,
          videos,
          imageBundles,
          userMusicTracks,
          appSettings,
          nextSubscriptionProducts,
          nextWeeklyVideoExportUsage
        ] = await Promise.all([
          getPhotos(),
          getMadeVideos(),
          getImageBundleWorks(),
          user ? syncUserMusicTracks(user) : Promise.resolve([]),
          getAppSettings(),
          getUserSubscriptionProducts(user),
          getWeeklyVideoExportUsage(user, planEntitlements.weeklyVideoExportLimit)
        ]);

        if (!isActive) {
          return;
        }

        setStats({
          originalPhotos: photos.filter((photo) => photo.kind === "original").length,
          editedPhotos: photos.filter((photo) => photo.kind === "edited").length,
          imageBundles: imageBundles.length,
          videos: videos.length
        });
        setStorageMode(appSettings.storageMode);
        setMusicTracks(userMusicTracks);
        setSubscriptionProducts(nextSubscriptionProducts);
        setWeeklyVideoExportUsage(nextWeeklyVideoExportUsage);
        setIsSubscriptionProductsLoading(false);
      };

      loadStats().catch(() => {
        if (isActive) {
          setIsSubscriptionProductsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [planEntitlements.weeklyVideoExportLimit, user])
  );

  useEffect(
    () =>
      subscribeCloudBackupOverview({
        user,
        onChange: setBackupOverview
      }),
    [user]
  );

  const providerText = useMemo(() => {
    if (!user) {
      return "없음";
    }

    const providers = user.providerData.map((provider) => provider.providerId);
    if (providers.includes("google.com")) {
      return "Google";
    }

    return "이메일";
  }, [user]);

  const accountEmail = user?.email ?? email;

  const openDeleteRequestPage = () => {
    setShowDeleteRequestInfo(false);
    void Linking.openURL(DELETE_ACCOUNT_REQUEST_URL);
  };

  const runAuthAction = async (action: () => Promise<void>, successMessage: string) => {
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrimaryAuth = () => {
    if (mode === "recover") {
      runAuthAction(
        () => resetPassword(email),
        "입력한 이메일로 비밀번호 재설정 메일을 보냈습니다."
      );
      return;
    }

    if (!email.trim() || password.length < 6) {
      setMessage("이메일과 6자리 이상 비밀번호를 입력해 주세요.");
      return;
    }

    if (mode === "signUp") {
      runAuthAction(async () => {
        await signUp(email, password);
        setPassword("");
      }, "회원가입을 완료했습니다. 이메일 인증 메일을 확인해 주세요.");
      return;
    }

    runAuthAction(async () => {
      await signIn(email, password);
      setPassword("");
    }, "로그인했습니다.");
  };

  const handleGoogleSignIn = () => {
    if (isGoogleSubmitting) {
      return;
    }

    if (!isGoogleReady) {
      setMessage(GOOGLE_SIGN_IN_MESSAGES.missingConfig);
      return;
    }

    const runGoogleLogin = async () => {
      setIsGoogleSubmitting(true);
      setMessage(null);
      const result = await signInWithGoogleAuthSession({
        webClientId: googleWebClientId,
        androidClientId: googleAndroidClientId,
        signInWithGoogleIdToken
      });
      setMessage(
        result === "success"
          ? GOOGLE_SIGN_IN_MESSAGES.success
          : GOOGLE_SIGN_IN_MESSAGES.cancelled
      );
    };

    runGoogleLogin().catch((error) => {
      setMessage(getGoogleSignInErrorMessage(error, getAuthErrorMessage));
    }).finally(() => {
      setIsGoogleSubmitting(false);
    });
  };

  const handlePaymentUnavailable = () => {
    setSelectedPaymentPlan(null);
    setMessage("유료 기능은 Google Play 결제 검증 연동 후 사용할 수 있습니다.");
  };

  const getPaymentPlanStatus = (plan: PaymentPlan) => {
    if (isSubscriptionProductsLoading) {
      return {
        active: false,
        label: "확인 중..."
      };
    }

    if (plan.id === "adRemove") {
      return {
        active: Boolean(
          subscriptionProducts.adRemove ||
          subscriptionProducts.creatorMonthly ||
          subscriptionProducts.expertMonthly
        ),
        label: subscriptionProducts.adRemove
          ? "구매 완료"
          : subscriptionProducts.creatorMonthly || subscriptionProducts.expertMonthly
            ? "구독 포함"
            : "준비 중"
      };
    }

    return {
      active: Boolean(subscriptionProducts.creatorMonthly || subscriptionProducts.expertMonthly),
      label: subscriptionProducts.creatorMonthly || subscriptionProducts.expertMonthly ? "구독 중" : "준비 중"
    };
  };

  const handleUploadMusic = async () => {
    if (isMusicSubmitting) {
      return;
    }

    try {
      setIsMusicSubmitting(true);
      setMessage(null);
      const appSettings = await getAppSettings();
      const nextTracks = await pickAndUploadUserMusicTrack(
        user,
        planEntitlements.musicTrackLimit,
        {
          uploadToCloud: isCloudBackupTargetEnabled(appSettings, "music")
        }
      );
      setMusicTracks(nextTracks);
      setMessage("내 음악을 저장했습니다. 영상 만들기에서 선택할 수 있습니다.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsMusicSubmitting(false);
    }
  };

  const handleDeleteMusic = async (track: UserMusicTrack) => {
    if (isMusicSubmitting) {
      return;
    }

    try {
      setIsMusicSubmitting(true);
      setMessage(null);
      const nextTracks = await deleteUserMusicTrack({ user, track });
      setMusicTracks(nextTracks);
      setMessage("내 음악을 삭제했습니다.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setIsMusicSubmitting(false);
    }
  };

  return (
    <>
      <ScreenShell
        eyebrow="계정"
        title={isLoggedIn ? "내 계정과 사용 기록" : "로그인하고 작업을 보관하세요."}
        description={
          isLoggedIn
            ? "이메일 인증, 구독 상태, 저장한 작업 기록을 한곳에서 확인합니다."
            : "무료 로그인하면 사진 편집과 MP4 영상 주 1회 저장을 사용할 수 있습니다. Pro부터 워터마크 제거와 클라우드 백업이 제공됩니다."
        }
        safeTop
      >
      {!isFirebaseReady ? (
        <SectionBlock title="연결 필요">
          <View style={[styles.noticePanel, themed.panel]}>
            <Text selectable style={[styles.noticeTitle, themed.text]}>
              로그인 기능을 사용할 수 없습니다.
            </Text>
            <Text selectable style={[styles.noticeText, themed.mutedText]}>
              잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요.
            </Text>
          </View>
        </SectionBlock>
      ) : null}

      {isFirebaseReady && !isLoggedIn ? (
        <SectionBlock title="로그인">
          <View style={styles.segment}>
            {[
              { label: "로그인", value: "signIn" },
              { label: "회원가입", value: "signUp" },
              { label: "찾기", value: "recover" }
            ].map((item) => {
              const isActive = mode === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={[
                    styles.segmentButton,
                    themed.secondaryButton,
                    isActive && styles.segmentButtonActive,
                    isActive && themed.activeFill
                  ]}
                  onPress={() => {
                    setMode(item.value as AuthMode);
                    setMessage(null);
                  }}
                >
                  <Text
                    selectable={false}
                    style={[
                      styles.segmentText,
                      themed.text,
                      isActive && styles.segmentTextActive,
                      isActive && themed.inverseText
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>
            <TextInput
              value={email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="이메일"
              placeholderTextColor={palette.faint}
              style={[styles.input, themed.input]}
              onChangeText={setEmail}
            />
            {mode !== "recover" ? (
              <TextInput
                value={password}
                secureTextEntry
                placeholder="비밀번호 6자리 이상"
                placeholderTextColor={palette.faint}
                style={[styles.input, themed.input]}
                onChangeText={setPassword}
              />
            ) : (
              <Text selectable style={[styles.helpText, themed.mutedText]}>
                트래블프레임의 아이디는 이메일입니다. 보안상 가입 여부는 직접 표시하지 않고,
                입력한 이메일로 비밀번호 재설정 메일을 보냅니다.
              </Text>
            )}
            <Pressable
              disabled={isSubmitting || isAuthLoading}
              style={[
                styles.primaryButton,
                themed.activeFill,
                (isSubmitting || isAuthLoading) && styles.disabledButton
              ]}
              onPress={handlePrimaryAuth}
            >
              <Text selectable={false} style={[styles.primaryButtonText, themed.inverseText]}>
                {mode === "signIn"
                  ? "이메일로 로그인"
                  : mode === "signUp"
                    ? "인증 메일 받고 가입"
                    : "재설정 메일 보내기"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isSubmitting || isAuthLoading || isGoogleSubmitting}
              style={[
                styles.secondaryButton,
                themed.secondaryButton,
                (isSubmitting || isAuthLoading || isGoogleSubmitting) && styles.disabledButton
              ]}
              onPress={handleGoogleSignIn}
            >
              <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                {isGoogleSubmitting ? "Google 로그인 중" : "Google로 계속하기"}
              </Text>
            </Pressable>
          </View>
        </SectionBlock>
      ) : null}

      {isFirebaseReady && isLoggedIn ? (
        <>
          <SectionBlock title="내 정보">
            <View style={[styles.profilePanel, themed.panel]}>
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  <Text selectable={false} style={styles.avatarText}>
                    {(user?.displayName ?? user?.email ?? "계정").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileCopy}>
                  <Text selectable style={[styles.profileName, themed.text]}>
                    {user?.displayName || "이름 없음"}
                  </Text>
                  <Text selectable style={[styles.profileEmail, themed.mutedText]}>
                    {accountEmail}
                  </Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <StatusBadge label={hasFullAccess ? "인증 완료" : "인증 대기"} active={hasFullAccess} />
                <StatusBadge label={providerText} active />
              </View>
              {!hasFullAccess ? (
                <View style={styles.verifyPanel}>
                  <Text selectable style={[styles.helpText, themed.mutedText]}>
                    이메일 인증과 Pro 활성화가 완료되면 워터마크 제거, 클라우드 백업, 고급 출력 기능을 사용할 수 있습니다.
                  </Text>
                  <View style={styles.inlineActions}>
                    <Pressable
                      disabled={isSubmitting}
                      style={[styles.secondaryButton, themed.secondaryButton]}
                      onPress={() =>
                        runAuthAction(
                          sendVerificationEmail,
                          "인증 메일을 다시 보냈습니다. 메일함을 확인해 주세요."
                        )
                      }
                    >
                      <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                        인증 메일 재발송
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isSubmitting}
                      style={[styles.secondaryButton, themed.secondaryButton]}
                      onPress={() =>
                        runAuthAction(refreshUser, "인증 상태를 새로 확인했습니다.")
                      }
                    >
                      <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                        상태 새로고침
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <View style={styles.form}>
                <Pressable
                  disabled={isSubmitting}
                  style={[styles.primaryButton, themed.activeFill, isSubmitting && styles.disabledButton]}
                  onPress={() => runAuthAction(logOut, "로그아웃했습니다.")}
                >
                  <Text selectable={false} style={[styles.primaryButtonText, themed.inverseText]}>
                    로그아웃
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, themed.secondaryButton]}
                  onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                >
                  <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                    개인정보처리방침
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, themed.secondaryButton]}
                  onPress={() => setShowDeleteRequestInfo(true)}
                >
                  <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                    계정 및 데이터 삭제 요청
                  </Text>
                </Pressable>
              </View>
            </View>
          </SectionBlock>

          <SectionBlock title="계정 기록">
            <View style={styles.infoList}>
              <InfoRow label="가입일" value={formatDateTime(user?.metadata.creationTime)} />
              <InfoRow label="마지막 로그인" value={formatDateTime(user?.metadata.lastSignInTime)} />
              <InfoRow
                label="구독 상태"
                value={subscriptionDisplayName}
              />
              <InfoRow
                label="광고 제거"
                value={
                  isSubscriptionCheckFailed
                    ? "확인 불가"
                    : isSubscriptionProductsLoading
                    ? "확인 중..."
                    : subscriptionProducts.adRemove
                    ? "구매 완료"
                    : subscriptionProducts.creatorMonthly
                      ? "구독 포함"
                      : "미구매"
                }
              />
              <InfoRow
                label="구독"
                value={
                  isSubscriptionCheckFailed
                    ? "확인 불가"
                    : isSubscriptionProductsLoading
                    ? "확인 중..."
                    : subscriptionProducts.creatorMonthly
                      ? "구독 중"
                      : "미구독"
                }
              />
              <InfoRow
                label="구독 시작일"
                value={displaySubscription.startedAt ? formatDateTime(displaySubscription.startedAt) : "아직 구독 전"}
              />
              <InfoRow
                label="다음 갱신일"
                value={displaySubscription.expiresAt ? formatDateTime(displaySubscription.expiresAt) : "없음"}
              />
              <InfoRow
                label="클라우드 백업"
                value={
                  isSubscriptionCheckFailed
                    ? "확인 불가"
                    : hasFullAccess
                      ? "사용 가능"
                      : "프리미엄 활성 후 사용 권장"
                }
              />
            </View>
          </SectionBlock>

          <SectionBlock title="플랜 한도">
            <View style={styles.infoList}>
              <InfoRow
                label="현재 플랜"
                value={planEntitlements.label}
              />
              <InfoRow
                label="영상 출력 (주간 한도)"
                value={formatQuotaValue(
                  weeklyVideoUsed,
                  planEntitlements.weeklyVideoExportLimit
                )}
              />
              <InfoRow
                label="이미지 보관함"
                value={formatQuotaValue(localImageUsage, planEntitlements.localImageLimit)}
              />
              <InfoRow
                label="영상 보관함"
                value={formatQuotaValue(stats.videos, planEntitlements.localVideoLimit)}
              />
              <InfoRow
                label="음악 보관함"
                value={formatQuotaValue(
                  musicTracks.length,
                  planEntitlements.musicTrackLimit
                )}
              />
              <InfoRow
                label="클라우드 백업"
                value={formatStorageQuotaValue(
                  backupOverview.imageBackupBytes,
                  planEntitlements.backupStorageBytes
                )}
              />
            </View>
          </SectionBlock>

          <SectionBlock title="클라우드 백업">
            <View style={[styles.backupSummaryPanel, themed.panel]}>
              <View style={styles.infoList}>
                <InfoRow
                  label="백업 설정"
                  value={effectiveStorageMode === "local_only" ? "꺼짐" : "켜짐"}
                />
                <InfoRow
                  label="저장 방식"
                  value={getStorageModeLabel(effectiveStorageMode)}
                />
                <InfoRow
                  label="백업 권한"
                  value={
                    isSubscriptionCheckFailed
                      ? "확인 불가"
                      : subscriptionProducts.creatorMonthly
                      ? "사용 가능"
                      : isLoggedIn
                        ? "구독 후 사용 가능"
                        : "로그인 필요"
                  }
                />
                <InfoRow
                  label="백업 데이터"
                  value={`사진 ${backupOverview.photoCount}장 / 여러 사진 작업 ${backupOverview.imageBundleCount}개 / 영상 ${backupOverview.videoCount}개`}
                />
                <InfoRow
                  label="이미지 용량"
                  value={formatImageBackupUsage(backupOverview.imageBackupBytes)}
                />
                <InfoRow
                  label="마지막 백업"
                  value={backupOverview.backedUpAt ? formatDateTime(backupOverview.backedUpAt) : "기록 없음"}
                />
                <InfoRow
                  label="삭제 방식"
                  value="설정에서 직접 요청"
                />
              </View>
              <Text selectable style={[styles.helpText, themed.mutedText]}>
                설정의 클라우드 백업에서 켜거나 끌 수 있습니다. 구독 기간이 끝나면 새 백업은 중단됩니다. 기존 백업 데이터 삭제는 설정에서 직접 요청할 수 있습니다.
              </Text>
            </View>
          </SectionBlock>

          <SectionBlock title="결제">
            <View style={[styles.planCard, themed.panelStrong]}>
              <View style={styles.planHeader}>
                <View style={styles.planCopy}>
                  <Text selectable style={[styles.planTitle, themed.text]}>
                    로그인 혜택
                  </Text>
                  <Text selectable style={[styles.planPrice, themed.text]}>
                    무료
                  </Text>
                </View>
                <StatusBadge label={isLoggedIn ? "사용 중" : "로그인 필요"} active={isLoggedIn} />
              </View>
              <View style={styles.benefitList}>
                {signedInBenefits.map((benefit) => (
                  <Text key={benefit} selectable style={[styles.benefitText, themed.mutedText]}>
                    {benefit}
                  </Text>
                ))}
              </View>
            </View>

            <View style={styles.paymentGrid}>
              {paymentPlans.map((plan) => (
                <Pressable
                  key={plan.id}
                  style={[styles.paymentPlan, themed.panel]}
                  onPress={() => setSelectedPaymentPlan(plan)}
                >
                  <View style={styles.planHeader}>
                    <View style={styles.planCopy}>
                      <Text selectable style={[styles.planTitle, themed.text]}>
                        {plan.title}
                      </Text>
                      <Text selectable style={[styles.planPrice, themed.text]}>
                        {plan.price}
                      </Text>
                    </View>
                    <StatusBadge
                      label={getPaymentPlanStatus(plan).label}
                      active={getPaymentPlanStatus(plan).active}
                    />
                  </View>
                  <Text selectable style={[styles.benefitText, themed.mutedText]}>
                    {plan.summary}
                  </Text>
                  <View style={[styles.paymentOpenButton, themed.activeFill]}>
                    <Text selectable={false} style={[styles.primaryButtonText, themed.inverseText]}>
                      안내 보기
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </SectionBlock>

          <SectionBlock title="사용 기록">
            <View style={styles.statsGrid}>
              <StatCard label="원본 사진" value={stats.originalPhotos} />
              <StatCard label="편집 사진" value={stats.editedPhotos} />
              <StatCard label="여러 사진 작업" value={stats.imageBundles} />
              <StatCard label="만든 영상" value={stats.videos} />
            </View>
          </SectionBlock>

          <SectionBlock title="내 음악 관리">
            <View style={styles.musicPanel}>
              <Text selectable style={[styles.helpText, themed.mutedText]}>
                Pro 구독 중에는 핸드폰에 있는 음악을 최대 {planEntitlements.musicTrackLimit}개까지 저장하고 영상 만들기에서 사용할 수 있습니다.
              </Text>
              <View style={styles.musicHeader}>
                <Text selectable style={[styles.musicCount, themed.text]}>
                  {musicTracks.length} / {planEntitlements.musicTrackLimit}
                </Text>
                <Pressable
                  disabled={
                    isMusicSubmitting ||
                    planEntitlements.musicTrackLimit <= 0 ||
                    musicTracks.length >= planEntitlements.musicTrackLimit
                  }
                  style={[
                    styles.secondaryButton,
                    themed.secondaryButton,
                    styles.musicUploadButton,
                    (isMusicSubmitting ||
                      planEntitlements.musicTrackLimit <= 0 ||
                      musicTracks.length >= planEntitlements.musicTrackLimit) &&
                      styles.disabledButton
                  ]}
                  onPress={handleUploadMusic}
                >
                  <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                    음악 추가
                  </Text>
                </Pressable>
              </View>
              <View style={styles.musicList}>
                {musicTracks.length > 0 ? (
                  musicTracks.map((track) => (
                    <View key={track.id} style={[styles.musicItem, themed.panel]}>
                      <View style={styles.musicCopy}>
                        <Text selectable style={[styles.musicTitle, themed.text]}>
                          {track.name}
                        </Text>
                        <Text selectable style={[styles.musicDetail, themed.mutedText]}>
                          {formatDateTime(track.createdAt)}
                        </Text>
                      </View>
                      <Pressable
                        disabled={isMusicSubmitting}
                        style={[
                          styles.musicDeleteButton,
                          themed.secondaryButton,
                          isMusicSubmitting && styles.disabledButton
                        ]}
                        onPress={() => handleDeleteMusic(track)}
                      >
                        <Text selectable={false} style={[styles.musicDeleteText, themed.text]}>
                          삭제
                        </Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text selectable style={[styles.helpText, themed.mutedText]}>
                    아직 저장한 음악이 없습니다.
                  </Text>
                )}
              </View>
            </View>
          </SectionBlock>

        </>
      ) : null}

      {message ? (
        <View style={[styles.messagePanel, themed.panel]}>
          {isSubmitting ? <ActivityIndicator color={palette.text} /> : null}
          <Text selectable style={[styles.messageText, themed.text]}>
            {message}
          </Text>
        </View>
      ) : null}
      </ScreenShell>

      <Modal
        animationType="fade"
        transparent
        visible={showDeleteRequestInfo}
        onRequestClose={() => setShowDeleteRequestInfo(false)}
      >
        <View style={[styles.paymentModalBackdrop, modalSafeStyle]}>
          <View style={[styles.paymentModalPanel, themed.panelStrong]}>
            <View style={styles.modalHeader}>
              <View style={styles.planCopy}>
                <Text selectable style={[styles.planTitle, themed.text]}>
                  계정 및 데이터 삭제 요청
                </Text>
                <Text selectable style={[styles.benefitText, themed.mutedText]}>
                  관련 안내 페이지로 이동하시겠습니까?
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseButton, themed.secondaryButton]}
                onPress={() => setShowDeleteRequestInfo(false)}
              >
                <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <Text selectable style={[styles.helpText, themed.mutedText]}>
              백업 데이터는 설정 화면의 클라우드 백업에서 백업 데이터 삭제를 누르면 계정에서 제거됩니다.
            </Text>
            <Text selectable style={[styles.helpText, themed.mutedText]}>
              계정 삭제 요청과 추가 데이터 삭제 안내는 별도 안내 페이지에서 확인하실 수 있습니다.
            </Text>

            <Pressable
              style={[styles.primaryButton, themed.activeFill]}
              onPress={openDeleteRequestPage}
            >
              <Text selectable={false} style={[styles.primaryButtonText, themed.inverseText]}>
                안내 페이지로 이동
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(selectedPaymentPlan)}
        onRequestClose={() => setSelectedPaymentPlan(null)}
      >
        <View style={[styles.paymentModalBackdrop, modalSafeStyle]}>
          <View style={[styles.paymentModalPanel, themed.panelStrong]}>
            <View style={styles.modalHeader}>
              <View style={styles.planCopy}>
                <Text selectable style={[styles.planTitle, themed.text]}>
                  {selectedPaymentPlan?.title}
                </Text>
                <Text selectable style={[styles.planPrice, themed.text]}>
                  {selectedPaymentPlan?.price}
                </Text>
                <Text selectable style={[styles.benefitText, themed.mutedText]}>
                  {selectedPaymentPlan?.billing}
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseButton, themed.secondaryButton]}
                onPress={() => setSelectedPaymentPlan(null)}
              >
                <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                  닫기
                </Text>
              </Pressable>
            </View>

            <Text selectable style={[styles.helpText, themed.mutedText]}>
              {selectedPaymentPlan?.summary}
            </Text>

            <View style={styles.benefitList}>
              {selectedPaymentPlan?.benefits.map((benefit) => (
                <Text key={benefit} selectable style={[styles.benefitText, themed.text]}>
                  {benefit}
                </Text>
              ))}
            </View>

            <Pressable
              disabled={isSubmitting || !selectedPaymentPlan}
              style={[styles.primaryButton, themed.activeFill, isSubmitting && styles.disabledButton]}
              onPress={handlePaymentUnavailable}
            >
              <Text selectable={false} style={[styles.primaryButtonText, themed.inverseText]}>
                준비 중
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <AppGuideOverlay tabKey="account" />
    </>
  );
}

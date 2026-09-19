import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import {
  DELETE_ACCOUNT_REQUEST_URL,
  PRIVACY_POLICY_URL
} from "@/constants/legal-links";
import { useAuth } from "@/lib/auth-context";
import {
  isPremiumSubscription,
  type SubscriptionProductId
} from "@/lib/subscription";
import { getSubscriptionProductsFromSubscription } from "@/lib/subscription-products";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import {
  getEffectiveStorageMode,
  getStorageModeLabel
} from "@/lib/storage-mode";
import { useAppAppearance } from "@/lib/app-appearance";
import {
  GOOGLE_SIGN_IN_MESSAGES,
  getGoogleSignInErrorMessage,
  isGoogleSignInConfigured,
  signInWithGoogleAuthSession
} from "@/lib/google-auth";
import { restoreCloudBackupToLocal } from "@/lib/cloud-backup";
import {
  formatImageBackupUsage
} from "@/lib/image-backup-utils";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { InfoRow, StatusBadge } from "@/features/account/account-screen.components";
import {
  paymentPlans,
  signedInBenefits,
  type AuthMode,
  type PaymentPlan
} from "@/features/account/account-screen.constants";
import {
  formatDateTime,
  getAuthErrorMessage
} from "@/features/account/account-screen.helpers";
import { createAccountThemedStyles, styles } from "@/features/account/account-screen.styles";
import { useAccountBackupOverview } from "@/features/account/hooks/useAccountBackup";
import { useAccountStats } from "@/features/account/hooks/useAccountStats";
import { useGooglePlayBilling } from "@/features/account/hooks/useGooglePlayBilling";
import {
  getBodyProjectProgressSummary,
  selectActiveBodyProject
} from "@/lib/body-frame-camera-project";
import { getBodyProjects } from "@/lib/body-project-library";
import { getLastActiveProjectId } from "@/lib/body-project-preferences";
import { getPhotos } from "@/lib/photo-library";

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
  const [isBackupRestoreSubmitting, setIsBackupRestoreSubmitting] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<PaymentPlan | null>(null);
  const [showDeleteRequestInfo, setShowDeleteRequestInfo] = useState(false);
  const {
    connected: billingConnected,
    billingMessage,
    isRestoring: isPurchaseRestoring,
    purchaseProduct,
    restorePurchases,
    getStorePrice
  } = useGooglePlayBilling({
    user,
    refreshUser
  });

  useEffect(() => {
    if (isLoggedIn && billingMessage) {
      setMessage(billingMessage);
    }
  }, [billingMessage, isLoggedIn]);
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const isGoogleReady = isGoogleSignInConfigured({
    androidClientId: googleAndroidClientId
  });
  const isSubscriptionCheckFailed = subscriptionStatus === "failed";
  const displaySubscription = isSubscriptionCheckFailed ? cachedSubscription : subscription;
  const planEntitlements = useMemo(
    () => getPlanEntitlements({ isLoggedIn, subscription }),
    [isLoggedIn, subscription]
  );
  const {
    storageMode,
    isSubscriptionProductsLoading,
    subscriptionProducts
  } = useAccountStats({ user });
  const backupOverview = useAccountBackupOverview(user);
  const [currentProjectSummary, setCurrentProjectSummary] = useState<{
    name: string;
    photoCount: number;
    targetPhotoCount: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadCurrentProject = async () => {
        const [projects, photos, lastActiveProjectId] = await Promise.all([
          getBodyProjects(),
          getPhotos(),
          getLastActiveProjectId()
        ]);
        const selectedProject = selectActiveBodyProject(projects, lastActiveProjectId);

        if (!isActive) {
          return;
        }

        if (!selectedProject) {
          setCurrentProjectSummary(null);
          return;
        }

        const summary = getBodyProjectProgressSummary(photos, selectedProject);
        setCurrentProjectSummary({
          name: selectedProject.name,
          photoCount: summary.photoCount,
          targetPhotoCount: summary.targetPhotoCount
        });
      };

      void loadCurrentProject().catch(() => {
        if (isActive) {
          setCurrentProjectSummary(null);
        }
      });

      return () => {
        isActive = false;
      };
    }, [])
  );
  const derivedSubscriptionProducts = useMemo(
    () => getSubscriptionProductsFromSubscription(subscription),
    [subscription]
  );
  const effectiveSubscriptionProducts = useMemo(
    () => ({
      adRemove: subscriptionProducts.adRemove ?? derivedSubscriptionProducts.adRemove,
      creatorMonthly:
        subscriptionProducts.creatorMonthly ?? derivedSubscriptionProducts.creatorMonthly,
      expertMonthly: subscriptionProducts.expertMonthly ?? derivedSubscriptionProducts.expertMonthly
    }),
    [derivedSubscriptionProducts, subscriptionProducts]
  );
  const effectiveStorageMode = getEffectiveStorageMode(
    storageMode,
    planEntitlements.canBackupToCloud
  );
  const subscriptionDisplayName = isSubscriptionCheckFailed
    ? isPremiumSubscription(cachedSubscription)
      ? `확인 불가 (최근 캐시: ${cachedSubscription.productName})`
      : "확인 불가"
    : subscription.status === "active"
      ? subscription.productName
      : "무료 플랜";

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

  const restoreBackupData = async () => {
    if (isBackupRestoreSubmitting) {
      return;
    }

    if (!user) {
      setMessage("로그인 후 백업 데이터를 불러올 수 있습니다.");
      return;
    }

    try {
      setIsBackupRestoreSubmitting(true);
      setMessage(null);
      const summary = await restoreCloudBackupToLocal({ user });
      setMessage(
        `클라우드 백업에서 현재 앱에 없는 항목만 불러왔습니다. 사진 ${summary.photoCount}장, 영상 ${summary.videoCount}개를 추가했습니다.`
      );
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "클라우드 백업을 불러오지 못했습니다."));
    } finally {
      setIsBackupRestoreSubmitting(false);
    }
  };

  const confirmCloudRestore = () => {
    Alert.alert(
      "백업 데이터 불러오기",
      "클라우드 백업 데이터 중 현재 앱에 없는 사진과 영상만 불러옵니다. 이미 저장된 항목은 그대로 둡니다. 계속하시겠습니까?",
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
  };

  const getPaymentProductId = (
    plan: PaymentPlan
  ): Exclude<SubscriptionProductId, "free"> =>
    plan.id === "adRemove"
      ? "ad_remove"
      : plan.id === "expert"
        ? "expert_monthly"
        : "creator_monthly";

  const getPaymentActionLabel = (plan: PaymentPlan) =>
    getPaymentPlanStatus(plan).active
      ? "사용 중"
      : !billingConnected
        ? "Google Play 연결 중..."
        : plan.id === "adRemove"
          ? "구매하기"
          : "구독하기";

  const handlePaymentPurchase = async () => {
    if (isSubmitting || !selectedPaymentPlan) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);
      await purchaseProduct(getPaymentProductId(selectedPaymentPlan));
      setMessage(`${selectedPaymentPlan.title} 결제가 완료되었습니다.`);
      setSelectedPaymentPlan(null);
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "결제를 완료하지 못했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (isPurchaseRestoring || isSubmitting) {
      return;
    }

    try {
      setMessage(null);
      const restoredCount = await restorePurchases();
      setMessage(
        restoredCount > 0
          ? `Google Play 구매 ${restoredCount}건을 확인하고 복원했습니다.`
          : "복원할 활성 Google Play 구매를 찾지 못했습니다."
      );
    } catch (error) {
      setMessage(getUserFacingErrorMessage(error, "구매를 복원하지 못했습니다."));
    }
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
          effectiveSubscriptionProducts.adRemove ||
          effectiveSubscriptionProducts.creatorMonthly ||
          effectiveSubscriptionProducts.expertMonthly
        ),
        label: effectiveSubscriptionProducts.adRemove
          ? "구매 완료"
          : effectiveSubscriptionProducts.creatorMonthly || effectiveSubscriptionProducts.expertMonthly
            ? "구독 포함"
            : "미구매"
      };
    }

    if (plan.id === "expert") {
      return {
        active: Boolean(effectiveSubscriptionProducts.expertMonthly),
        label: effectiveSubscriptionProducts.expertMonthly ? "구독 중" : "미구독"
      };
    }

    return {
      active: Boolean(
        effectiveSubscriptionProducts.creatorMonthly ||
          effectiveSubscriptionProducts.expertMonthly
      ),
      label:
        effectiveSubscriptionProducts.creatorMonthly ||
        effectiveSubscriptionProducts.expertMonthly
          ? "구독 중"
          : "미구독"
    };
  };

  return (
    <>
      <ScreenShell
        eyebrow="계정"
        title={isLoggedIn ? "내 계정과 플랜" : "로그인하고 기록을 보호하세요."}
        description={
          isLoggedIn
            ? "계정, 현재 기록, 백업 상태와 Google Play 플랜을 관리합니다."
            : "로그인하면 Google Play 구매·복원과 계정 기능을 사용할 수 있습니다. 무료 플랜은 프로젝트당 100장과 최대 10초 변화 영상을 지원합니다."
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
                바디 프레임의 아이디는 이메일입니다. 보안상 가입 여부는 직접 표시하지 않고,
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
                    이메일 인증과 Pro 활성화가 완료되면 워터마크 제거와 클라우드 백업을 사용할 수 있습니다.
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

          <SectionBlock title="현재 상태">
            <View style={styles.infoList}>
              <InfoRow
                label="현재 플랜"
                value={planEntitlements.label}
              />
              <InfoRow
                label="구독 상태"
                value={subscriptionDisplayName}
              />
              <InfoRow
                label="현재 프로젝트"
                value={currentProjectSummary?.name ?? "프로젝트 없음"}
              />
              <InfoRow
                label="현재 기록"
                value={
                  currentProjectSummary
                    ? `${currentProjectSummary.photoCount} / ${currentProjectSummary.targetPhotoCount}장`
                    : "기록 없음"
                }
              />
              <InfoRow
                label="클라우드 백업"
                value={
                  effectiveStorageMode === "local_only"
                    ? "꺼짐"
                    : planEntitlements.canBackupToCloud
                      ? "켜짐"
                      : "플랜 확인 필요"
                }
              />
              <InfoRow
                label="다음 갱신일"
                value={
                  displaySubscription.expiresAt
                    ? formatDateTime(displaySubscription.expiresAt)
                    : "없음"
                }
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
                    : planEntitlements.canBackupToCloud
                      ? "사용 가능"
                      : isLoggedIn
                        ? "구독 후 사용 가능"
                        : "로그인 필요"
                  }
                />
                <InfoRow
                  label="백업 데이터"
                  value={`사진 ${backupOverview.photoCount}장 / 영상 ${backupOverview.videoCount}개`}
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
              <Pressable
                disabled={isBackupRestoreSubmitting || !isLoggedIn}
                style={[
                  styles.secondaryButton,
                  themed.secondaryButton,
                  (isBackupRestoreSubmitting || !isLoggedIn) && styles.disabledButton
                ]}
                onPress={confirmCloudRestore}
              >
                <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                  백업 데이터 불러오기
                </Text>
              </Pressable>
            </View>
          </SectionBlock>

          <SectionBlock title="플랜 및 결제">
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
                        {getStorePrice(getPaymentProductId(plan)) ?? plan.price}
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
            <Pressable
              accessibilityRole="button"
              disabled={!billingConnected || isPurchaseRestoring || isSubmitting}
              style={[
                styles.secondaryButton,
                themed.secondaryButton,
                (!billingConnected || isPurchaseRestoring || isSubmitting) &&
                  styles.disabledButton
              ]}
              onPress={() => void handleRestorePurchases()}
            >
              <Text selectable={false} style={[styles.secondaryButtonText, themed.text]}>
                {isPurchaseRestoring ? "구매 복원 중..." : "구매 복원"}
              </Text>
            </Pressable>
            <Text selectable style={[styles.helpText, themed.mutedText]}>
              같은 Google Play 계정으로 구매한 광고 제거와 활성 구독을 다시 확인합니다.
            </Text>
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
                  {selectedPaymentPlan
                    ? getStorePrice(getPaymentProductId(selectedPaymentPlan)) ??
                      selectedPaymentPlan.price
                    : ""}
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
              disabled={
                isSubmitting ||
                !billingConnected ||
                !selectedPaymentPlan ||
                (selectedPaymentPlan ? getPaymentPlanStatus(selectedPaymentPlan).active : false)
              }
              style={[
                styles.primaryButton,
                themed.activeFill,
                (isSubmitting ||
                  !billingConnected ||
                  (selectedPaymentPlan ? getPaymentPlanStatus(selectedPaymentPlan).active : false)) &&
                  styles.disabledButton
              ]}
              onPress={handlePaymentPurchase}
            >
              <Text selectable={false} style={[styles.primaryButtonText, themed.inverseText]}>
                {selectedPaymentPlan ? getPaymentActionLabel(selectedPaymentPlan) : "결제하기"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

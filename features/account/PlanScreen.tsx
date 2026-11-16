import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/app-text";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { paymentPlans, type PaymentPlanId } from "@/features/account/account-screen.constants";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { GIB, getPlanTier, PLAN_ENTITLEMENTS, type PlanTier } from "@/lib/plan-entitlements";

const planTierFor = {
  creator: "pro",
  plus: "plus",
  expert: "expert"
} as const satisfies Record<PaymentPlanId, PlanTier>;

const describePlan = (tier: "pro" | "plus" | "expert") => {
  const entitlement = PLAN_ENTITLEMENTS[tier];
  return [
    "프로젝트 무제한 · 프로젝트당 사진 365장",
    "클라우드 프로젝트 " + entitlement.maxCloudBackupProjects + "개 · " +
      entitlement.backupStorageBytes / GIB + "GB",
    "광고 및 워터마크 제거 · 고급 영상 옵션"
  ];
};

const entryMessages: Record<string, string> = {
  camera: "현재 사진 기록 한도보다 더 많이 촬영하려면 Pro 이상 플랜을 확인하세요.",
  records: "프로젝트를 추가하거나 더 많은 사진을 기록하려면 유료 플랜의 혜택을 비교하세요.",
  project: "프로젝트별 사진을 최대 365장까지 기록할 수 있는 플랜을 확인하세요.",
  video: "워터마크 없는 영상과 고급 출력 옵션은 Pro 이상에서 지원합니다.",
  backup: "클라우드 백업은 Pro 1개, Plus 3개, Expert 5개 프로젝트를 지원합니다.",
  settings: "현재 플랜의 혜택과 Google Play 구독 관리 기능을 확인하세요."
};

export default function PlanScreen() {
  const { palette } = useAppAppearance();
  const { source, plan } = useLocalSearchParams<{ source?: string; plan?: string }>();
  const contextMessage = typeof source === "string" ? entryMessages[source] : undefined;
  const suggestedPlan = typeof plan === "string" && ["pro", "plus", "expert"].includes(plan)
    ? plan
    : null;
  const { isLoggedIn, isAuthLoading, subscription, subscriptionStatus } = useAuth();
  const isUnverified = isAuthLoading || (isLoggedIn && subscriptionStatus !== "verified");
  const currentTier = isUnverified ? null : getPlanTier({ isLoggedIn, subscription });
  const currentLabel = isUnverified
    ? subscriptionStatus === "failed" ? "구독 확인 불가" : "구독 확인 중"
    : PLAN_ENTITLEMENTS[currentTier ?? "guest"].label;

  return (
    <ScreenShell
      eyebrow="멤버십"
      title="플랜"
      description={contextMessage ?? "기록을 더 오래 보관하고 변화 영상을 더 자유롭게 만드세요."}
      safeTop
    >
      {contextMessage ? (
        <SectionBlock title="필요한 유료 혜택">
          <Text style={[styles.description, { color: palette.text }]}>{contextMessage}</Text>
        </SectionBlock>
      ) : null}
      <SectionBlock title="내 멤버십">
        <View style={[styles.panel, { borderColor: palette.line, backgroundColor: palette.surface }]}>
          <Text style={[styles.status, { color: palette.text }]}>{currentLabel}</Text>
          <Text style={[styles.description, { color: palette.muted }]}>
            {isUnverified
              ? "구독을 확인할 수 있을 때까지 유료 권한을 임의로 표시하지 않습니다."
              : currentTier === "guest"
                ? "로그인하지 않아도 요금제 혜택을 미리 살펴볼 수 있습니다."
                : "현재 이용 권한은 서버에서 검증된 구독 정보를 기준으로 합니다."}
          </Text>
        </View>
      </SectionBlock>

      <SectionBlock title="무료 플랜">
        <View style={[styles.panel, { borderColor: palette.line, backgroundColor: palette.surface }]}>
          <Text style={[styles.planTitle, { color: palette.text }]}>무료로 시작하기</Text>
          <Text style={[styles.description, { color: palette.muted }]}>
            로그인 시 프로젝트 1개, 프로젝트당 사진 100장까지 기록하고 변화 영상도 만들 수 있습니다.
            광고와 워터마크가 포함됩니다.
          </Text>
        </View>
      </SectionBlock>

      <SectionBlock title="Pro · Plus · Expert 비교">
        {paymentPlans.map((plan) => {
          const tier = planTierFor[plan.id];
          const active = currentTier === tier;
          return (
            <View
              key={plan.id}
              style={[styles.panel, { borderColor: palette.line, backgroundColor: palette.surface }]}
            >
              <View style={styles.planHeading}>
                <Text style={[styles.planTitle, { color: palette.text }]}>
                  {plan.title}{suggestedPlan === tier ? " · 현재 기능 추천" : ""}
                </Text>
                <Text style={[styles.price, { color: palette.text }]}>
                  월 {plan.price}
                </Text>
              </View>
              <Text style={[styles.caption, { color: palette.muted }]}>
                코드에 등록된 참고 가격 · 실제 청구 금액은 Google Play 확인
              </Text>
              {describePlan(tier).map((benefit) => (
                <Text key={benefit} style={[styles.description, { color: palette.muted }]}>
                  {benefit}
                </Text>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={active ? plan.title + " 현재 이용 중" : plan.title + " 구독 안내"}
                accessibilityState={{ disabled: active }}
                disabled={active}
                onPress={() => router.push("/account")}
                style={[
                  styles.action,
                  { backgroundColor: active ? palette.surfaceStrong : palette.text }
                ]}
              >
                <Text
                  style={[styles.actionText, { color: active ? palette.muted : palette.inverse }]}
                >
                  {active ? "현재 이용 중" : isLoggedIn ? "구독 안내 보기" : "로그인 후 구독하기"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </SectionBlock>

      <SectionBlock title="구독 안내">
        <Text style={[styles.description, { color: palette.muted }]}>
          유료 상품은 Google Play 월 구독이며 취소 전까지 자동 갱신됩니다.
          플랜 변경·구매 복원은 계정에서 관리할 수 있습니다.
          구독이 끝나더라도 기기에 저장된 기존 기록은 자동 삭제되지 않습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계정 및 구매 복원 관리"
          onPress={() => router.push("/account")}
          style={[styles.secondaryAction, { borderColor: palette.line }]}
        >
          <Text style={[styles.actionText, { color: palette.text }]}>계정 및 구매 복원</Text>
        </Pressable>
      </SectionBlock>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: bodyFrameDesign.borderWidth,
    padding: bodyFrameDesign.horizontalPadding,
    gap: 10
  },
  status: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "700"
  },
  planHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  planTitle: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "700"
  },
  price: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "700"
  },
  description: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 21
  },
  caption: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18
  },
  action: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryAction: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    borderWidth: bodyFrameDesign.borderWidth,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  actionText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700",
    textAlign: "center"
  }
});

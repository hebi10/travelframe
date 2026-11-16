import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "@/components/app-text";
import { ScreenShell } from "@/components/screen-shell";
import { SectionBlock } from "@/components/section-block";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";

export default function PlanScreen() {
  const { palette } = useAppAppearance();
  const { isLoggedIn, isAuthLoading, subscription, subscriptionStatus } = useAuth();
  const status = isAuthLoading || (isLoggedIn && subscriptionStatus !== "verified")
    ? "플랜 확인 중"
    : isLoggedIn
      ? getPlanEntitlements({ isLoggedIn, subscription }).label
      : "비로그인";

  return (
    <ScreenShell
      eyebrow="멤버십"
      title="플랜"
      description="유료 플랜의 혜택과 현재 이용 상태를 확인하세요."
      safeTop
    >
      <SectionBlock title="현재 이용 중인 플랜">
        <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Text style={[styles.statusText, { color: palette.text }]}>{status}</Text>
          <Text style={[styles.description, { color: palette.muted }]}>
            구독 상태는 Google Play 결제와 서버에서 확인된 권한을 기준으로 표시됩니다.
          </Text>
        </View>
      </SectionBlock>

      <SectionBlock title="요금제 및 결제">
        <Text style={[styles.description, { color: palette.muted }]}>
          Pro, Plus, Expert 플랜의 상세 혜택과 구매·복원 기능을 확인할 수 있습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="요금제 및 Google Play 결제 보기"
          onPress={() => router.push("/account")}
          style={[styles.button, { backgroundColor: palette.text }]}
        >
          <Text style={[styles.buttonText, { color: palette.inverse }]}>요금제 및 결제 보기</Text>
        </Pressable>
      </SectionBlock>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: bodyFrameDesign.borderWidth,
    padding: bodyFrameDesign.horizontalPadding,
    gap: 8
  },
  statusText: {
    fontSize: bodyFrameTypography.sectionTitle,
    fontWeight: "700"
  },
  description: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 21
  },
  button: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  buttonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  }
});

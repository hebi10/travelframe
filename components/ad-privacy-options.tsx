import { useEffect } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text } from "@/components/app-text";
import { bodyFrameDesign, bodyFrameTypography } from "@/constants/app-theme";
import { adConsent } from "@/lib/ad-consent";
import { canUseNativeAdMob } from "@/lib/admob-config";
import { useAppAppearance } from "@/lib/app-appearance";
import { useAdConsent } from "@/lib/use-ad-consent";

export function AdPrivacyOptions() {
  const { palette } = useAppAppearance();
  const consent = useAdConsent(false);
  useEffect(() => {
    if (canUseNativeAdMob()) void adConsent.inspectPrivacyOptions();
  }, []);

  if (!canUseNativeAdMob() || !consent.privacyOptionsRequired) return null;

  return (
    <View style={{ paddingHorizontal: bodyFrameDesign.horizontalPadding, paddingVertical: 8, backgroundColor: palette.background }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: consent.isBusy }}
        disabled={consent.isBusy}
        onPress={() => {
          void adConsent.showPrivacyOptions().catch(() => {
            Alert.alert("광고 개인정보 설정", "설정을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.");
          });
        }}
        style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: palette.line }}
      >
        <Text style={{ fontSize: bodyFrameTypography.button, color: palette.text }}>
          {consent.isBusy ? "광고 개인정보 설정 확인 중" : "광고 개인정보 설정"}
        </Text>
      </Pressable>
    </View>
  );
}

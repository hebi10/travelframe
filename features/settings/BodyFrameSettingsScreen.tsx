import Constants from "expo-constants";
import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideOverlay } from "@/components/app-guide-overlay";
import { SectionBlock } from "@/components/section-block";
import { PRIVACY_POLICY_URL } from "@/constants/legal-links";
import { useAppAppearance } from "@/lib/app-appearance";
import { getFontOptionLabel } from "@/lib/app-fonts";
import { useAuth } from "@/lib/auth-context";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { getStorageModeLabel } from "@/lib/storage-mode";

const themeLabel = {
  light: "라이트",
  dark: "다크",
  system: "시스템"
} as const;

function BodyFrameSettingRow({
  label,
  detail,
  mark = "›",
  onPress
}: {
  label: string;
  detail?: string;
  mark?: string;
  onPress?: () => void;
}) {
  const { palette } = useAppAppearance();

  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        {
          borderColor: palette.line,
          backgroundColor: palette.surface,
          opacity: pressed && onPress ? 0.82 : 1
        }
      ]}
    >
      <View style={styles.settingRowCopy}>
        <Text numberOfLines={1} style={[styles.settingRowLabel, { color: palette.text }]}>
          {label}
        </Text>
        {detail ? (
          <Text
            numberOfLines={2}
            style={[styles.settingRowDetail, { color: palette.muted }]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.settingRowMark,
          { color: onPress ? palette.text : palette.muted }
        ]}
      >
        {mark}
      </Text>
    </Pressable>
  );
}

export default function BodyFrameSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, palette } = useAppAppearance();
  const { isLoggedIn, subscription, user } = useAuth();
  const planEntitlements = getPlanEntitlements({ isLoggedIn, subscription });
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 20, 28),
            paddingBottom: insets.bottom + 36
          }
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>설정</Text>
          <Text style={[styles.pageDetail, { color: palette.muted }]}>
            바디 프레임의 촬영, 저장, 영상과 계정 설정을 관리합니다.
          </Text>
        </View>

        <SectionBlock title="촬영">
          <BodyFrameSettingRow
            label="기준 사진 투명도"
            detail="촬영 화면에 겹쳐 보이는 기준 사진의 투명도"
            mark={`${Math.round(settings.overlayOpacity * 100)}%`}
            onPress={() => router.push("/advanced-settings")}
          />
          <BodyFrameSettingRow
            label="촬영 비율"
            detail="몸의 변화를 기록할 기본 카메라 비율"
            mark={settings.cameraRatio}
            onPress={() => router.push("/advanced-settings")}
          />
          <BodyFrameSettingRow
            label="촬영 세부 설정"
            detail="가이드, 줌, 저장 범위와 카메라 옵션"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>

        <SectionBlock title="저장 및 백업">
          <BodyFrameSettingRow
            label="저장 방식"
            detail="앱 로컬 저장과 클라우드 백업 방식"
            mark={getStorageModeLabel(settings.storageMode)}
            onPress={() => router.push("/advanced-settings")}
          />
          <BodyFrameSettingRow
            label="클라우드 백업"
            detail={
              planEntitlements.canBackupToCloud
                ? "현재 플랜에서 백업을 사용할 수 있습니다."
                : "Pro 이상에서 클라우드 백업을 사용할 수 있습니다."
            }
            mark={settings.cloudBackupEnabled ? "켜짐" : "꺼짐"}
            onPress={() => router.push("/advanced-settings")}
          />
          <BodyFrameSettingRow
            label="저장·백업 세부 설정"
            detail="사진 화질, 저장 범위, 백업 대상과 복원"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>

        <SectionBlock title="변화 영상">
          <BodyFrameSettingRow
            label="기본 영상"
            detail="프로젝트 사진 1장당 0.1초 · 30fps"
            mark="0.1초"
            onPress={() => router.push("/trip-clip")}
          />
          <BodyFrameSettingRow
            label="영상 규격"
            detail="세로 기록 영상 기본 규격"
            mark="9:16 · 1080p"
            onPress={() => router.push("/trip-clip")}
          />
          <BodyFrameSettingRow
            label="영상 세부 설정"
            detail="저장 화질과 기존 고급 영상 옵션"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>

        <SectionBlock title="화면">
          <BodyFrameSettingRow
            label="화면 모드"
            detail="다크를 기본으로 라이트/시스템 모드도 지원합니다."
            mark={themeLabel[settings.themeMode]}
            onPress={() => router.push("/advanced-settings")}
          />
          <BodyFrameSettingRow
            label="글꼴"
            detail="앱 전체에 적용할 글꼴"
            mark={getFontOptionLabel(settings.fontStyle)}
            onPress={() => router.push("/advanced-settings")}
          />
          <BodyFrameSettingRow
            label="화면 세부 설정"
            detail="글자 크기와 화면 밀도"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>

        <SectionBlock title="계정 및 플랜">
          <BodyFrameSettingRow
            label={isLoggedIn ? "내 계정" : "로그인"}
            detail={isLoggedIn ? user?.email ?? "로그인된 계정" : "Google 또는 이메일로 로그인"}
            mark={isLoggedIn ? planEntitlements.label : "무료"}
            onPress={() => router.push("/account")}
          />
          <BodyFrameSettingRow
            label="플랜 및 Google Play 결제"
            detail="Pro/Expert, 광고 제거, 구매 복원과 구독 상태"
            mark={planEntitlements.label}
            onPress={() => router.push("/account")}
          />
        </SectionBlock>

        <SectionBlock title="정보 및 개인정보">
          <BodyFrameSettingRow
            label="바디 프레임"
            detail="현재 설치된 앱 버전"
            mark={`v${version}`}
          />
          <BodyFrameSettingRow
            label="개인정보처리방침"
            detail="권한 사용과 데이터 처리 안내"
            mark="열기"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          />
          <BodyFrameSettingRow
            label="고급 설정"
            detail="기존 촬영·편집·백업의 전체 세부 설정"
            mark="열기"
            onPress={() => router.push("/advanced-settings")}
          />
        </SectionBlock>
      </ScrollView>

      <AppGuideOverlay tabKey="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingHorizontal: 16
  },
  header: {
    gap: 6,
    marginBottom: 24
  },
  settingRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8
  },
  settingRowCopy: {
    flex: 1,
    gap: 3
  },
  settingRowLabel: {
    fontSize: 14,
    fontWeight: "600"
  },
  settingRowDetail: {
    fontSize: 12,
    lineHeight: 17
  },
  settingRowMark: {
    maxWidth: 118,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right"
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "600"
  },
  pageDetail: {
    fontSize: 14,
    lineHeight: 20
  }
});

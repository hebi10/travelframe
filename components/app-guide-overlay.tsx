import { Text, Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideCard } from "@/components/app-guide-card";
import { AppGuideHighlight } from "@/components/app-guide-highlight";
import type { AppGuideTabKey } from "@/constants/app-guide-steps";
import { useAppGuide } from "@/hooks/use-app-guide";
import { useAppAppearance } from "@/lib/app-appearance";

type AppGuideOverlayProps = {
  tabKey: AppGuideTabKey;
  transparentBackdrop?: boolean;
  replaySignal?: number;
};

export function AppGuideOverlay({
  tabKey,
  transparentBackdrop = false,
  replaySignal = 0
}: AppGuideOverlayProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const {
    visible,
    step,
    stepIndex,
    totalSteps,
    canGoBack,
    goBack,
    goNext,
    skip
  } = useAppGuide(tabKey, replaySignal);

  if (!step) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={skip}
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: Math.max(insets.top + 20, 28),
            paddingBottom: Math.max(insets.bottom + 20, 28),
            backgroundColor: transparentBackdrop
              ? "transparent"
              : "rgba(0,0,0,0.68)"
          }
        ]}
      >
        <View
          style={[
            styles.modal,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line
            }
          ]}
        >
          <View style={styles.brandBlock}>
            <Text style={[styles.eyebrow, { color: palette.muted }]}>BODY FRAME</Text>
            <Text style={[styles.brandTitle, { color: palette.text }]}>바디 프레임</Text>
            <Text style={[styles.brandDetail, { color: palette.muted }]}>
              같은 위치와 자세로 몸의 변화를 기록합니다.
            </Text>
          </View>

          <View style={styles.highlightWrap}>
            <AppGuideHighlight label={step.targetLabel ?? "현재 기능"} />
          </View>

          <AppGuideCard
            step={step}
            current={stepIndex + 1}
            total={totalSteps}
            canGoBack={canGoBack}
            onBack={goBack}
            onNext={goNext}
            onSkip={skip}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 10
  },
  brandBlock: {
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "600"
  },
  brandDetail: {
    fontSize: 14,
    lineHeight: 20
  },
  highlightWrap: {
    paddingHorizontal: 18,
    paddingBottom: 10
  }
});

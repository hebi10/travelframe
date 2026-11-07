import { AppText as Text } from "@/components/app-text";
import { Image } from "expo-image";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideCard } from "@/components/app-guide-card";
import { AppGuideHighlight } from "@/components/app-guide-highlight";
import { bodyFrameDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import type { AppGuideTabKey } from "@/constants/app-guide-steps";
import { useAppGuide } from "@/hooks/use-app-guide";
import { useAppAppearance } from "@/lib/app-appearance";

type AppGuideOverlayProps = {
  tabKey: AppGuideTabKey;
  transparentBackdrop?: boolean;
  replaySignal?: number;
  autoShowFirstRun?: boolean;
};

export function AppGuideOverlay({
  tabKey,
  transparentBackdrop = false,
  replaySignal = 0,
  autoShowFirstRun = true
}: AppGuideOverlayProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useAppAppearance();
  const { primaryBackground: actionColor, primaryText: actionTextColor } = getBodyFrameControlColors(palette);
  const {
    visible,
    step,
    stepIndex,
    totalSteps,
    canGoBack,
    goBack,
    goNext,
    skip
  } = useAppGuide(tabKey, replaySignal, autoShowFirstRun);

  if (!step) {
    return null;
  }

  const isWelcome = tabKey === "camera" && step.id === "body-frame-welcome" && replaySignal === 0;

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
          isWelcome && styles.welcomeBackdrop,
          {
            paddingTop: isWelcome ? Math.max(insets.top, 16) : Math.max(insets.top + 20, 28),
            paddingBottom: isWelcome ? Math.max(insets.bottom, 16) : Math.max(insets.bottom + 20, 28),
            backgroundColor: isWelcome
              ? palette.background
              : transparentBackdrop
                ? "transparent"
                : "rgba(0,0,0,0.68)"
          }
        ]}
      >
        <View
          style={[
            styles.modal,
            isWelcome && styles.welcomeModal,
            {
              backgroundColor: isWelcome ? palette.background : palette.surface,
              borderColor: palette.line
            }
          ]}
          accessibilityViewIsModal
        >
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentScrollContainer, isWelcome && styles.welcomeScrollContainer]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
          {isWelcome ? (
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeTopRow}>
                <Text style={[styles.eyebrow, { color: palette.muted }]}>BODY FRAME</Text>
                <Text style={[styles.welcomeProgress, { color: palette.muted }]}>
                  {stepIndex + 1} / {totalSteps}
                </Text>
              </View>
              <Image
                source={require("../assets/ui/illustrations/feature-capture.png")}
                style={styles.welcomeArtwork}
                contentFit="contain"
                accessible={false}
              />
              <Text style={[styles.welcomeTitle, { color: palette.text }]}>
                {step.title}
              </Text>
              <Text style={[styles.welcomeDescription, { color: palette.muted }]}>
                {step.description}
              </Text>
              <View style={styles.welcomeActions}>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.welcomeButton, { backgroundColor: actionColor }]}
                  onPress={goNext}
                >
                  <Text style={[styles.welcomeButtonText, { color: actionTextColor }]}>
                    시작하기
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.welcomeSkipButton} onPress={skip}>
                  <Text style={[styles.welcomeSkipText, { color: palette.muted }]}>
                    나중에 보기
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
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
            </>
          )}
          </ScrollView>
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
  welcomeBackdrop: {
    paddingHorizontal: 0
  },
  modal: {
    width: "100%",
    maxHeight: "100%",
    maxWidth: 520,
    alignSelf: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: bodyFrameDesign.modalRadius
  },
  welcomeModal: {
    flex: 1,
    maxWidth: "100%",
    borderWidth: 0,
    borderRadius: 0
  },
  contentScroll: { flexShrink: 1, minHeight: 0 },
  contentScrollContainer: { flexGrow: 1 },
  welcomeScrollContainer: { flexGrow: 1 },
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
    fontSize: bodyFrameTypography.pageTitle,
    fontWeight: "600"
  },
  brandDetail: {
    fontSize: 14,
    lineHeight: 20
  },
  highlightWrap: {
    paddingHorizontal: 18,
    paddingBottom: 10
  },
  welcomeContent: {
    flexGrow: 1,
    gap: 16,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28
  },
  welcomeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: bodyFrameDesign.minTouchSize
  },
  welcomeProgress: {
    fontSize: bodyFrameTypography.caption,
    fontVariant: ["tabular-nums"]
  },
  welcomeArtwork: {
    width: "100%",
    height: 220,
    alignSelf: "center"
  },
  welcomeTitle: {
    fontSize: bodyFrameTypography.projectTitle,
    lineHeight: 31,
    fontWeight: "600"
  },
  welcomeDescription: {
    fontSize: 14,
    lineHeight: 21
  },
  welcomeActions: { gap: 8, marginTop: 12 },
  welcomeSkipButton: {
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center"
  },
  welcomeSkipText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  welcomeButton: {
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  welcomeButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "700"
  }
});

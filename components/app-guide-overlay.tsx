import { AppText as Text } from "@/components/app-text";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppGuideCard, AppGuideNavigation } from "@/components/app-guide-card";
import { bodyFrameDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import type { AppGuideTabKey } from "@/constants/app-guide-steps";
import { getAppGuideArtwork } from "@/constants/app-guide-artwork";
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
  const { height: windowHeight, fontScale: systemFontScale } = useWindowDimensions();
  const { palette, fontSizeScale } = useAppAppearance();
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
  const compactWelcome = windowHeight < 720 || fontSizeScale * systemFontScale >= 1.3;

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
          testID={isWelcome ? "app-guide-welcome" : "app-guide-popup"}
        >
          {!isWelcome ? (
            <View>
            <View style={styles.guideHeader}>
              <Text style={[styles.guideLabel, { color: palette.text }]}>사용 가이드</Text>
              <Text
                accessibilityLabel={`${totalSteps}단계 중 ${stepIndex + 1}단계`}
                accessibilityLiveRegion="polite"
                style={[styles.guideProgress, { color: palette.text }]}
              >
                {stepIndex + 1} / {totalSteps}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="닫기"
                accessibilityHint="사용 가이드를 닫습니다."
                style={styles.guideClose}
                onPress={skip}
              >
                <Feather name="x" size={bodyFrameDesign.iconSize} color={palette.text} accessible={false} />
              </Pressable>
            </View>
            <View style={styles.progressTrack} importantForAccessibility="no-hide-descendants">
              {Array.from({ length: totalSteps }, (_, index) => (
                <View
                  key={index}
                  style={[styles.progressSegment, { backgroundColor: index <= stepIndex ? palette.text : palette.muted }]}
                />
              ))}
            </View>
            </View>
          ) : null}
          <ScrollView
            key={step.id}
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentScrollContainer, isWelcome && styles.welcomeScrollContainer]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
          {isWelcome ? (
            <View style={[styles.welcomeContent, compactWelcome && styles.welcomeContentCompact]}>
              <View style={styles.welcomeTopRow}>
                <Text style={[styles.eyebrow, { color: palette.muted }]}>BODY FRAME</Text>
                <Text style={[styles.welcomeProgress, { color: palette.muted }]}>
                  {stepIndex + 1} / {totalSteps}
                </Text>
              </View>
              <Image
                source={getAppGuideArtwork(step.id)}
                recyclingKey={step.id}
                style={[styles.welcomeArtwork, compactWelcome && styles.welcomeArtworkCompact]}
                contentFit="contain"
                accessible={false}
              />
              <Text accessibilityRole="header" style={[styles.welcomeTitle, { color: palette.text }]}>
                {step.title}
              </Text>
              <Text style={[styles.welcomeDescription, { color: palette.muted }]}>
                {step.description}
              </Text>
              <View style={[styles.welcomeSummary, { backgroundColor: palette.surface, borderColor: palette.line }]}>
                <Text style={[styles.welcomeSummaryTitle, { color: palette.text }]}>
                  기록 시작 순서
                </Text>
                <Text style={[styles.welcomeSummaryItem, { color: palette.muted }]}>
                  01  프로젝트 만들기
                </Text>
                <Text style={[styles.welcomeSummaryItem, { color: palette.muted }]}>
                  02  첫 사진 촬영하기
                </Text>
                <Text style={[styles.welcomeSummaryItem, { color: palette.muted }]}>
                  03  같은 구도로 변화 기록하기
                </Text>
              </View>
            </View>
          ) : (
            <AppGuideCard step={step} />
          )}
          </ScrollView>
          {isWelcome ? (
            <View style={[styles.welcomeActions, { backgroundColor: palette.background }]}>
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
          ) : (
            <AppGuideNavigation
              current={stepIndex + 1}
              total={totalSteps}
              canGoBack={canGoBack}
              onBack={goBack}
              onNext={goNext}
            />
          )}
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
  guideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 12,
    paddingBottom: 4
  },
  guideClose: {
    width: bodyFrameDesign.minTouchSize,
    height: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center"
  },
  progressTrack: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2
  },
  guideLabel: {
    flex: 1,
    fontSize: bodyFrameTypography.caption,
    fontWeight: "700",
    lineHeight: 18,
    includeFontPadding: false
  },
  guideProgress: {
    fontSize: bodyFrameTypography.caption,
    fontWeight: "700",
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false
  },
  welcomeContent: {
    flexGrow: 1,
    gap: 16,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28
  },
  welcomeContentCompact: {
    justifyContent: "flex-start",
    gap: 10,
    paddingVertical: 16
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
    height: 192,
    alignSelf: "center"
  },
  welcomeArtworkCompact: {
    height: 116
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
  welcomeSummary: {
    gap: 8,
    borderWidth: 1,
    borderRadius: bodyFrameDesign.cardRadius,
    padding: 14
  },
  welcomeSummaryTitle: {
    fontSize: bodyFrameTypography.rowTitle,
    fontWeight: "600",
    marginBottom: 4
  },
  welcomeSummaryItem: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 21
  },
  welcomeActions: {
    flexShrink: 0,
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8
  },
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
    paddingVertical: 8,
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

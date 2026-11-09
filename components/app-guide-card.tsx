import { AppText as Text } from "@/components/app-text";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  View
} from "react-native";

import { bodyFrameDesign, bodyFrameTypography, getBodyFrameControlColors } from "@/constants/app-theme";
import type { AppGuideStep } from "@/constants/app-guide-steps";
import { getAppGuideArtwork } from "@/constants/app-guide-artwork";
import { useAppAppearance } from "@/lib/app-appearance";

type AppGuideCardProps = {
  step: AppGuideStep;
};

type AppGuideNavigationProps = {
  current: number;
  total: number;
  canGoBack: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function AppGuideCard({ step }: AppGuideCardProps) {
  const { palette } = useAppAppearance();
  const artwork = getAppGuideArtwork(step.id);
  const isCaptureIntro = step.id === "body-frame-welcome";

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" textBreakStrategy="balanced" selectable={false} style={[styles.textBase, styles.title, { color: palette.text }]}>
        {step.title}
      </Text>

      {artwork ? (
        <Image
          testID="app-guide-artwork"
          source={artwork}
          recyclingKey={step.id}
          style={[
            styles.artwork,
            isCaptureIntro && styles.captureArtwork,
            { borderColor: palette.line, backgroundColor: palette.background }
          ]}
          contentFit={isCaptureIntro ? "cover" : "contain"}
          accessible={false}
        />
      ) : null}

      <Text selectable={false} style={[styles.textBase, styles.description, isCaptureIntro && styles.captureDescription, { color: palette.muted }]}>
        {step.description}
      </Text>
    </View>
  );
}

export function AppGuideNavigation({
  current,
  total,
  canGoBack,
  onBack,
  onNext
}: AppGuideNavigationProps) {
  const { palette } = useAppAppearance();
  const isLast = current === total;
  const { primaryBackground: activeColor, primaryText: activeTextColor } = getBodyFrameControlColors(palette);

  return (
    <View style={[styles.actions, { backgroundColor: palette.surface }]}>
      {canGoBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전"
          style={[styles.secondaryButton, { borderColor: palette.line }]}
          onPress={onBack}
        >
          <Feather name="chevron-left" size={bodyFrameDesign.iconSize} color={palette.text} accessible={false} />
          <Text selectable={false} style={[styles.textBase, styles.secondaryButtonLabel, { color: palette.text }]}>
            이전
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isLast ? "완료" : "다음"}
        style={[styles.primaryButton, { borderColor: activeColor, backgroundColor: activeColor }]}
        onPress={onNext}
      >
        <Text selectable={false} style={[styles.textBase, styles.primaryButtonLabel, { color: activeTextColor }]}>
          {isLast ? "완료" : "다음"}
        </Text>
        <Feather name={isLast ? "check" : "arrow-right"} size={bodyFrameDesign.iconSize} color={activeTextColor} accessible={false} />
      </Pressable>
      </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20
  },
  textBase: {
    backgroundColor: "transparent",
    includeFontPadding: false
  },
  artwork: {
    width: "100%",
    aspectRatio: 1.5,
    maxHeight: 280,
    borderRadius: bodyFrameDesign.cardRadius,
    borderWidth: 1,
    alignSelf: "center"
  },
  captureArtwork: {
    aspectRatio: 1.95
  },
  captureDescription: {
    fontWeight: "700"
  },
  title: {
    fontSize: bodyFrameTypography.projectTitle,
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: 0
  },
  description: {
    fontSize: bodyFrameTypography.body,
    lineHeight: 22,
    letterSpacing: 0
  },
  actions: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12
  },
  secondaryButton: {
    minWidth: 72,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  secondaryButtonLabel: {
    fontSize: bodyFrameTypography.button,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0
  },
  primaryButton: {
    flex: 1,
    minWidth: 96,
    minHeight: bodyFrameDesign.primaryButtonHeight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: bodyFrameDesign.buttonRadius
  },
  primaryButtonLabel: {
    fontSize: bodyFrameTypography.button,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 0
  }
});

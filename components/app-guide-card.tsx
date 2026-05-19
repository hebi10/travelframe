import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, controls, typography } from "@/constants/app-theme";
import type { AppGuideStep } from "@/constants/app-guide-steps";
import { useAppAppearance } from "@/lib/app-appearance";

type AppGuideCardProps = {
  step: AppGuideStep;
  current: number;
  total: number;
  canGoBack: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

export function AppGuideCard({
  step,
  current,
  total,
  canGoBack,
  onBack,
  onNext,
  onSkip
}: AppGuideCardProps) {
  const { palette } = useAppAppearance();
  const isLast = current === total;

  return (
    <View style={[styles.card, { borderColor: palette.text, backgroundColor: palette.background }]}>
      <View style={styles.metaRow}>
        <Text selectable={false} style={[styles.textBase, styles.meta, { color: palette.muted }]}>
          {current} / {total}
        </Text>
        {step.targetLabel ? (
          <View style={[styles.targetPill, { borderColor: palette.line }]}>
            <Text selectable={false} style={[styles.textBase, styles.targetText, { color: palette.text }]}>
              {step.targetLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text selectable={false} style={[styles.textBase, styles.title, { color: palette.text }]}>
          {step.title}
        </Text>
        <Text selectable={false} style={[styles.textBase, styles.description, { color: palette.muted }]}>
          {step.description}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={[styles.textButton, { borderColor: palette.line }]}
          onPress={onSkip}
        >
          <Text selectable={false} style={[styles.textBase, styles.textButtonLabel, { color: palette.muted }]}>
            스킵
          </Text>
        </Pressable>
        <View style={styles.stepActions}>
          {canGoBack ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.secondaryButton, { borderColor: palette.line }]}
              onPress={onBack}
            >
              <Text selectable={false} style={[styles.textBase, styles.secondaryButtonLabel, { color: palette.text }]}>
                이전
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={[styles.primaryButton, { borderColor: palette.text, backgroundColor: palette.text }]}
            onPress={onNext}
          >
            <Text selectable={false} style={[styles.textBase, styles.primaryButtonLabel, { color: palette.inverse }]}>
              {isLast ? "완료" : "다음"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    gap: 16,
    padding: 18,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    backgroundColor: colors.background
  },
  textBase: {
    backgroundColor: "transparent"
  },
  metaRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0
  },
  targetPill: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1
  },
  targetText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  },
  copy: {
    gap: 8
  },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29,
    letterSpacing: 0
  },
  description: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
    letterSpacing: 0
  },
  actions: {
    minHeight: controls.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  stepActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  textButton: {
    minHeight: controls.compactHeight,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1
  },
  textButtonLabel: {
    color: colors.muted,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  secondaryButton: {
    minWidth: 58,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: typography.button,
    fontWeight: "800",
    letterSpacing: 0
  },
  primaryButton: {
    minWidth: 64,
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1
  },
  primaryButtonLabel: {
    color: colors.inverse,
    fontSize: typography.button,
    fontWeight: "900",
    letterSpacing: 0
  }
});

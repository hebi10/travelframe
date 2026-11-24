import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyFrameDesign, bodyFrameTypography, spacing, typography } from "@/constants/app-theme";
import { type FontStyle } from "@/lib/app-settings";
import { getFontWeightForStyle, useAppAppearance } from "@/lib/app-appearance";

const TAB_BAR_BASE_HEIGHT = 58;
const TAB_BAR_CONTENT_RESERVE_HEIGHT = TAB_BAR_BASE_HEIGHT;
const TAB_BAR_MIN_BOTTOM_PADDING = 16;

type ScreenShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  safeTop?: boolean;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
};

export function ScreenShell({
  eyebrow,
  title,
  description,
  safeTop = false,
  onBack,
  backLabel = "뒤로가기",
  children
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const { fontScale: systemFontScale } = useWindowDimensions();
  const { settings, palette, fontSizeScale, layoutScale, fontFamily } = useAppAppearance();
  const screenPadding = Math.round(bodyFrameDesign.horizontalPadding * layoutScale);
  const sectionGap = Math.round(bodyFrameDesign.sectionGap * layoutScale);
  const extraTabLabelHeight = Math.max(0, Math.ceil(16 * fontSizeScale * systemFontScale) - 16);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        {
          padding: screenPadding,
          gap: sectionGap,
          paddingTop: safeTop ? insets.top + screenPadding : screenPadding,
          paddingBottom:
            TAB_BAR_CONTENT_RESERVE_HEIGHT +
            extraTabLabelHeight +
            Math.max(insets.bottom + 8, TAB_BAR_MIN_BOTTOM_PADDING)
        }
      ]}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={onBack}
            style={styles.backButton}
          >
            <Feather name="chevron-left" size={24} color={palette.text} />
            <Text style={[styles.backButtonText, { color: palette.text, fontFamily, fontSize: Math.round(bodyFrameTypography.button * fontSizeScale) }]}>
              {backLabel}
            </Text>
          </Pressable>
        ) : null}
        {eyebrow ? (
          <Text selectable style={[styles.eyebrow, { color: palette.muted, fontFamily }]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          selectable
          style={[
            styles.title,
            { color: palette.text },
            getTitleStyle(settings.fontStyle, fontSizeScale, fontFamily)
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            selectable
            style={[
              styles.description,
              {
                color: palette.muted,
                fontSize: Math.round(typography.body * fontSizeScale),
                lineHeight: Math.round(21 * fontSizeScale),
                fontFamily,
                fontWeight: settings.fontStyle === "noto_sans_kr" ? "700" : "400"
              }
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    width: "100%",
    maxWidth: bodyFrameDesign.contentMaxWidth,
    alignSelf: "center",
    paddingBottom: spacing.section * 2
  },
  header: {
    gap: 8
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: bodyFrameDesign.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12
  },
  backButtonText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600"
  },
  eyebrow: {
    fontSize: typography.eyebrow,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    fontSize: bodyFrameTypography.pageTitle,
    fontWeight: "600",
    lineHeight: 32,
    letterSpacing: 0
  },
  description: {
    fontSize: typography.body,
    lineHeight: 21,
    fontWeight: "700",
    letterSpacing: 0
  }
});

const getTitleStyle = (
  fontStyle: FontStyle,
  scale: number,
  fontFamily?: string
): TextStyle => {
  return {
    fontSize: Math.round(bodyFrameTypography.pageTitle * scale),
    lineHeight: Math.round(32 * scale),
    fontFamily,
    fontWeight: fontStyle === "noto_sans_kr" ? "600" : getFontWeightForStyle(fontStyle)
  };
};

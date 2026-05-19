import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, typography } from "@/constants/app-theme";
import { type FontStyle } from "@/lib/app-settings";
import { useAppAppearance } from "@/lib/app-appearance";

const TAB_BAR_BASE_HEIGHT = 58;
const TAB_BAR_CONTENT_RESERVE_HEIGHT = TAB_BAR_BASE_HEIGHT / 2;
const TAB_BAR_MIN_BOTTOM_PADDING = 16;
const MAX_CONTENT_WIDTH = 750;

type ScreenShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  safeTop?: boolean;
  children: ReactNode;
};

export function ScreenShell({
  eyebrow,
  title,
  description,
  safeTop = false,
  children
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const { settings, palette, fontSizeScale, layoutScale } = useAppAppearance();
  const screenPadding = Math.round(spacing.screen * layoutScale);
  const sectionGap = Math.round(spacing.section * layoutScale);

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
            Math.max(insets.bottom + 8, TAB_BAR_MIN_BOTTOM_PADDING)
        }
      ]}
    >
      <View style={styles.header}>
        {eyebrow ? (
          <Text selectable style={[styles.eyebrow, { color: palette.muted }]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          selectable
          style={[
            styles.title,
            { color: palette.text },
            getTitleStyle(settings.fontStyle, fontSizeScale)
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
                lineHeight: Math.round(21 * fontSizeScale)
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
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    paddingBottom: spacing.section * 2
  },
  header: {
    gap: 12
  },
  eyebrow: {
    fontSize: typography.eyebrow,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: 0
  },
  description: {
    fontSize: typography.body,
    lineHeight: 21,
    letterSpacing: 0
  }
});

const titleStyleByFont: Record<FontStyle, { fontSize: number; lineHeight: number }> = {
  standard: {
    fontSize: 28,
    lineHeight: 34
  },
  compact: {
    fontSize: 26,
    lineHeight: 32
  },
  bold: {
    fontSize: typography.title,
    lineHeight: 36
  }
};

const getTitleStyle = (fontStyle: FontStyle, scale: number): TextStyle => {
  const style = titleStyleByFont[fontStyle];
  return {
    fontSize: Math.round(style.fontSize * scale),
    lineHeight: Math.round(style.lineHeight * scale),
    fontWeight: fontStyle === "bold" ? "900" : "800"
  };
};

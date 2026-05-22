import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronIcon } from "@/components/chevron-icon";
import { colors, controls, typography } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type ActionRowProps = {
  href?: Href;
  label: string;
  detail?: string;
  mark?: string;
  onPress?: () => void;
};

export function ActionRow({ href, label, detail, mark = ">", onPress }: ActionRowProps) {
  const { palette, fontSizeScale, layoutScale, emphasisWeight, fontFamily } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const content = (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: Math.round(96 * layoutScale),
          paddingVertical: Math.round(15 * layoutScale),
          paddingHorizontal: Math.round(14 * layoutScale),
          borderColor: palette.line,
          backgroundColor: palette.background
        },
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      <View style={styles.copy}>
        <Text
          selectable
          style={[
            styles.label,
            {
              color: palette.text,
              fontSize: Math.round(typography.body * fontSizeScale),
              lineHeight: Math.round(21 * fontSizeScale),
              fontFamily,
              fontWeight: emphasisWeight
            }
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            selectable
            style={[
              styles.detail,
              {
                color: palette.muted,
                fontSize: Math.round(typography.small * fontSizeScale),
                lineHeight: Math.round(18 * fontSizeScale),
                fontFamily
              }
            ]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.markBox,
          {
            minHeight: Math.round(controls.compactHeight * layoutScale),
            borderColor: palette.text,
            backgroundColor: isDark ? "transparent" : palette.text
          }
        ]}
      >
        {mark === ">" ? (
          <ChevronIcon color={isDark ? palette.text : palette.inverse} size={10} />
        ) : (
          <Text
            selectable={false}
            style={[
              styles.markText,
              {
                color: isDark ? palette.text : palette.inverse,
                fontSize: Math.round(typography.button * fontSizeScale),
                lineHeight: Math.round(18 * fontSizeScale),
                fontFamily,
                fontWeight: emphasisWeight
              }
            ]}
          >
            {mark}
          </Text>
        )}
      </View>
    </Pressable>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} asChild>
      {content}
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 12,
    borderWidth: 1
  },
  pressed: {
    opacity: 0.55
  },
  copy: {
    gap: 4
  },
  label: {
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 21,
    letterSpacing: 0
  },
  detail: {
    fontSize: typography.small,
    lineHeight: 18,
    letterSpacing: 0
  },
  markBox: {
    minHeight: controls.compactHeight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  markText: {
    fontSize: typography.button,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0
  }
});

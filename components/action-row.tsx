import { Feather } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { typography } from "@/constants/app-theme";
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
  const content = (
    <Pressable
      style={[
        styles.row,
        {
          minHeight: Math.round(54 * layoutScale),
          paddingVertical: Math.round(10 * layoutScale),
          borderColor: palette.line,
          backgroundColor: palette.background
        }
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
      <View style={styles.markBox}>
        {mark === ">" ? (
          <Feather name="chevron-right" color={palette.muted} size={18} />
        ) : (
          <Text
            selectable={false}
            style={[
              styles.markText,
              {
                color: palette.muted,
                fontSize: Math.round(typography.small * fontSizeScale),
                lineHeight: Math.round(18 * fontSizeScale),
                fontFamily,
                fontWeight: "700"
              }
            ]}
            numberOfLines={1}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1
  },
  copy: {
    flex: 1,
    minWidth: 0
  },
  label: {
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 21,
    letterSpacing: 0
  },
  detail: {
    fontSize: typography.small,
    fontWeight: "400",
    lineHeight: 18,
    letterSpacing: 0
  },
  markBox: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "56%"
  },
  markText: {
    fontSize: typography.small,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 18,
    letterSpacing: 0
  }
});

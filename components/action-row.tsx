import { AppText as Text } from "@/components/app-text";
import {
  Feather } from "@expo/vector-icons";
import { Link,
  type Href } from "expo-router";
import { Pressable,
  StyleSheet,
  View
} from "react-native";

import { bodyFrameDesign, bodyFrameTypography, colors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type ActionRowProps = {
  href?: Href;
  label: string;
  detail?: string;
  mark?: string;
  onPress?: () => void;
};

export function ActionRow({ href, label, detail, mark = ">", onPress }: ActionRowProps) {
  const { palette, layoutScale } = useAppAppearance();
  const isDark = palette.background !== colors.background;
  const content = (
    <Pressable
      style={[
        styles.row,
        {
          minHeight: Math.round(96 * layoutScale),
          paddingVertical: Math.round(15 * layoutScale),
          paddingHorizontal: Math.round(14 * layoutScale),
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
            { color: palette.text }
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            selectable
            style={[
              styles.detail,
              { color: palette.muted }
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
            borderColor: palette.text,
            backgroundColor: isDark ? "transparent" : palette.text
          }
        ]}
      >
        {mark === ">" ? (
          <Feather name="chevron-right" color={isDark ? palette.text : palette.inverse} size={16} />
        ) : (
          <Text
            selectable={false}
            style={[
              styles.markText,
              { color: isDark ? palette.text : palette.inverse }
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
    borderWidth: bodyFrameDesign.borderWidth
  },
  copy: {
    gap: 4
  },
  label: {
    fontSize: bodyFrameTypography.body,
    fontWeight: "600",
    lineHeight: 21,
    letterSpacing: 0
  },
  detail: {
    fontSize: bodyFrameTypography.caption,
    lineHeight: 18,
    letterSpacing: 0
  },
  markBox: {
    minWidth: bodyFrameDesign.minTouchSize,
    minHeight: bodyFrameDesign.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  markText: {
    fontSize: bodyFrameTypography.button,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 0
  }
});

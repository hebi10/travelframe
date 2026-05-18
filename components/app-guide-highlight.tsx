import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type AppGuideHighlightProps = {
  label?: string;
};

export function AppGuideHighlight({ label }: AppGuideHighlightProps) {
  const { palette } = useAppAppearance();

  if (!label) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.highlight, { borderColor: palette.text, backgroundColor: palette.background }]}
    >
      <View style={[styles.dot, { backgroundColor: palette.text }]} />
      <Text selectable={false} style={[styles.label, { color: palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    alignSelf: "flex-start",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    backgroundColor: colors.background
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text
  },
  label: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  }
});

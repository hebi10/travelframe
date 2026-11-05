import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { bodyFrameDesign, getBodyFrameControlColors } from "@/constants/app-theme";
import { useAppAppearance } from "@/lib/app-appearance";

type TabGlyphProps = {
  kind: "camera" | "studio" | "video" | "settings";
  focused: boolean;
};

const iconNames = {
  camera: "camera",
  studio: "grid",
  video: "film",
  settings: "settings"
} as const;

export function TabGlyph({ kind, focused }: TabGlyphProps) {
  const { palette } = useAppAppearance();
  const { selected, unselected } = getBodyFrameControlColors(palette);
  const color = focused ? selected : unselected;

  return (
    <View style={styles.glyph}>
      <Feather name={iconNames[kind]} size={bodyFrameDesign.iconSize} color={color} />
      {focused ? <View style={[styles.activeIndicator, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 30,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  activeIndicator: {
    position: "absolute",
    bottom: -2,
    width: 12,
    height: 2
  }
});

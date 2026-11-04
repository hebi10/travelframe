import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { bodyFrameAccent } from "@/constants/app-theme";
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
  const { palette, effectiveThemeMode } = useAppAppearance();
  const color = focused
    ? effectiveThemeMode === "dark" ? bodyFrameAccent : palette.text
    : palette.faint;

  return (
    <View style={styles.glyph}>
      <Feather name={iconNames[kind]} size={20} color={color} />
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

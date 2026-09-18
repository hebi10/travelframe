import { StyleSheet, View } from "react-native";

import { useAppAppearance } from "@/lib/app-appearance";

type TabGlyphProps = {
  kind: "camera" | "studio" | "video" | "settings";
  focused: boolean;
};

export function TabGlyph({ kind, focused }: TabGlyphProps) {
  const { palette } = useAppAppearance();
  const color = focused ? palette.text : palette.faint;
  const strokeStyle = {
    borderColor: color,
    backgroundColor: color
  };

  return (
    <View style={styles.glyph}>
      {kind === "camera" ? (
        <View style={[styles.cameraRing, { borderColor: color }]}>
          <View style={[styles.cameraDot, { backgroundColor: color }]} />
        </View>
      ) : null}
      {kind === "studio" ? (
        <View style={styles.recordsIcon}>
          <View style={[styles.recordLine, { backgroundColor: color }]} />
          <View style={[styles.recordLine, { backgroundColor: color }]} />
          <View style={[styles.recordLine, { backgroundColor: color }]} />
        </View>
      ) : null}
      {kind === "video" ? (
        <View style={[styles.videoFrame, { borderColor: color }]}>
          <View
            style={[
              styles.playTriangle,
              {
                borderLeftColor: color
              }
            ]}
          />
        </View>
      ) : null}
      {kind === "settings" ? (
        <View style={styles.settingsIcon}>
          <View style={[styles.settingLine, strokeStyle]} />
          <View style={[styles.settingLine, styles.settingLineShort, strokeStyle]} />
          <View style={[styles.settingLine, strokeStyle]} />
        </View>
      ) : null}
      {focused ? <View style={[styles.activeIndicator, { backgroundColor: palette.text }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 30,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  activeIndicator: {
    position: "absolute",
    bottom: -2,
    width: 12,
    height: 2,
    borderRadius: 1
  },
  cameraRing: {
    width: 15,
    height: 15,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraDot: {
    width: 4,
    height: 4,
    borderRadius: 999
  },
  recordsIcon: {
    width: 16,
    gap: 3
  },
  recordLine: {
    width: 16,
    height: 2,
    borderRadius: 1
  },
  videoFrame: {
    width: 17,
    height: 13,
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 2,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 5,
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  settingsIcon: {
    width: 15,
    gap: 3
  },
  settingLine: {
    height: 2,
    width: 15,
    borderWidth: 0
  },
  settingLineShort: {
    width: 10,
    alignSelf: "flex-end"
  }
});

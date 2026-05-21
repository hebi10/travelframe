import { StyleSheet, View } from "react-native";

import { useAppAppearance } from "@/lib/app-appearance";

type TabGlyphProps = {
  kind: "camera" | "studio" | "account" | "settings";
  focused: boolean;
};

export function TabGlyph({ kind, focused }: TabGlyphProps) {
  const { palette } = useAppAppearance();
  const strokeStyle = {
    borderColor: focused ? palette.inverse : palette.text,
    backgroundColor: focused ? palette.inverse : palette.text
  };

  return (
    <View
      style={[
        styles.glyph,
        {
          backgroundColor: focused ? palette.ink : palette.background
        }
      ]}
    >
      {kind === "camera" ? (
        <View style={[styles.cameraRing, strokeStyle]}>
          <View
            style={[
              styles.cameraDot,
              {
                backgroundColor: focused ? palette.inverse : palette.text
              }
            ]}
          />
        </View>
      ) : null}
      {kind === "studio" ? (
        <View style={styles.gridIcon}>
          <View style={[styles.gridCell, strokeStyle]} />
          <View style={[styles.gridCell, strokeStyle]} />
          <View style={[styles.gridCell, strokeStyle]} />
          <View style={[styles.gridCell, strokeStyle]} />
        </View>
      ) : null}
      {kind === "settings" ? (
        <View style={styles.settingsIcon}>
          <View style={[styles.settingLine, strokeStyle]} />
          <View style={[styles.settingLine, styles.settingLineShort, strokeStyle]} />
          <View style={[styles.settingLine, strokeStyle]} />
        </View>
      ) : null}
      {kind === "account" ? (
        <View style={styles.accountIcon}>
          <View style={[styles.accountHead, strokeStyle]} />
          <View style={[styles.accountBody, strokeStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  cameraRing: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  cameraDot: {
    width: 4,
    height: 4,
    borderRadius: 999
  },
  gridIcon: {
    width: 14,
    height: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2
  },
  gridCell: {
    width: 6,
    height: 6
  },
  settingsIcon: {
    width: 15,
    gap: 3
  },
  settingLine: {
    height: 2,
    width: 15
  },
  settingLineShort: {
    width: 10,
    alignSelf: "flex-end"
  },
  accountIcon: {
    width: 16,
    height: 16,
    alignItems: "center"
  },
  accountHead: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginBottom: 2
  },
  accountBody: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999
  }
});

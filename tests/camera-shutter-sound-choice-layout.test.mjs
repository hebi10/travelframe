import assert from "node:assert/strict";
import fs from "node:fs";

const componentSource = fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8");
const stylesSource = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");

for (const snippet of [
  "styles.shutterSoundPanel",
  "styles.shutterSoundHeader",
  "styles.shutterSoundIcon",
  "styles.shutterSoundCopy",
  "styles.shutterSoundDetail",
  "styles.shutterSoundOptions",
  'Feather name={mode === "silent" ? "volume-x" : "volume-2"}'
]) {
  assert.ok(
    componentSource.includes(snippet),
    `shutter sound choice should use a dedicated, spaced layout: ${snippet}`
  );
}

for (const snippet of [
  "shutterSoundPanel:",
  "shutterSoundHeader:",
  "shutterSoundIcon:",
  "shutterSoundCopy:",
  "shutterSoundDetail:",
  "shutterSoundOptions:"
]) {
  assert.ok(stylesSource.includes(snippet), `shutter sound layout style missing: ${snippet}`);
}

assert.ok(
  !componentSource.includes("<View>\\n      <Text selectable={false} style={styles.settingToggleTitle}>"),
  "shutter sound choice should not render as a cramped bare title and option row"
);

console.log("ok - camera shutter sound choice has a dedicated spaced layout");

import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = [
  fs.readFileSync("features/camera/CameraScreen.tsx", "utf8"),
  fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8")
].join("\n");

const readStyleBlock = (name) => {
  const match = new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n\\s{2}\\},`).exec(cameraSource);
  assert.ok(match, `${name} style block should exist`);
  return match[1];
};

const navModalStyle = readStyleBlock("navModal");
const cameraSettingsScrollShellStyle = readStyleBlock("cameraSettingsScrollShell");
const cameraSettingsScrollStyle = readStyleBlock("cameraSettingsScroll");
const cameraSettingsContentStyle = readStyleBlock("cameraSettingsContent");

assert.ok(
  navModalStyle.includes('maxHeight: "88%"') && navModalStyle.includes('overflow: "hidden"'),
  "camera settings modal should clip content that exceeds the panel"
);

assert.ok(
  cameraSettingsScrollShellStyle.includes("flexShrink: 1") &&
    cameraSettingsScrollShellStyle.includes("minHeight: 0"),
  "camera settings scroll shell should shrink inside the modal panel"
);

assert.ok(
  cameraSettingsScrollStyle.includes("flexShrink: 1"),
  "camera settings scroll view should shrink instead of overflowing the panel"
);

assert.ok(
  cameraSettingsContentStyle.includes("paddingBottom: 28"),
  "camera settings content should keep bottom padding so the last item is not clipped"
);

console.log("ok - camera settings modal clips overflow and keeps scrolling inside the panel");

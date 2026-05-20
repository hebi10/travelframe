import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

const readStyleBlock = (name) => {
  const match = new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n\\s{2}\\},`).exec(cameraSource);
  assert.ok(match, `${name} style block should exist`);
  return match[1];
};

const navModalStyle = readStyleBlock("navModal");
const cameraSettingsScrollShellStyle = readStyleBlock("cameraSettingsScrollShell");
const cameraSettingsScrollStyle = readStyleBlock("cameraSettingsScroll");

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

console.log("ok - camera settings modal clips overflow and keeps scrolling inside the panel");

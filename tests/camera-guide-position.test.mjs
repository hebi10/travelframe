import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

for (const snippet of [
  "guideOffsetX",
  "guideOffsetY",
  "setIsGuidePositionAdjusting",
  "startGuidePositionAdjustment",
  "finishGuidePositionAdjustment",
  "resetGuidePositionToCenter",
  "guidePositionGesture",
  "guidePositionAnimatedStyle",
  "드래그 이동하기",
  "중앙",
  "완료",
  "setGuideSettingsOpen(true)",
  "guideSettingsScroll",
  "guideSettingsContent"
]) {
  assert.ok(cameraSource.includes(snippet), `camera guide position UI missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes("GestureDetector gesture={guidePositionGesture}"),
  "guide position adjustment should use a drag gesture detector"
);

assert.ok(
  cameraSource.includes("<ScrollView") &&
    cameraSource.includes("style={styles.guideSettingsScroll}") &&
    cameraSource.includes("contentContainerStyle={styles.guideSettingsContent}"),
  "guide settings modal should scroll so bottom actions remain visible"
);

assert.ok(
  /guideModal:\s*\{[\s\S]*?overflow:\s*"hidden"[\s\S]*?\n\s*\},/.test(cameraSource),
  "guide settings modal should clip content that exceeds the panel"
);

assert.ok(
  cameraSource.includes("!isGuidePositionAdjusting ? (") &&
    cameraSource.includes("{isGuidePositionAdjusting ? ("),
  "camera chrome should be hidden while guide position adjustment is active"
);

for (const snippet of [
  "guideOffsetX: number;",
  "guideOffsetY: number;",
  "guideOffsetX: 0",
  "guideOffsetY: 0"
]) {
  assert.ok(settingsSource.includes(snippet), `app settings missing guide offset: ${snippet}`);
}

assert.ok(
  overlaySource.includes("style={[styles.overlay, offsetStyle]}"),
  "guide overlay should apply the stored position offset"
);

console.log("ok - camera guide position adjustment is wired");

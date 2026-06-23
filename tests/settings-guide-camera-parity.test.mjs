import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const settingsSource = readFileSync("features/settings/SettingsScreen.tsx", "utf8");
const settingsComponentsSource = readFileSync("features/settings/settings-screen.components.tsx", "utf8");
const appSettingsSource = readFileSync("lib/app-settings.ts", "utf8");
const guideOverlaySource = readFileSync("components/camera-guide-overlay.tsx", "utf8");
const cameraSource = readFileSync("features/camera/CameraScreen.tsx", "utf8");
const editSource = readFileSync("app/edit.tsx", "utf8");
const tripClipSource = readTripClipSource();
const editableCanvasSource = readFileSync("components/editable-photo-canvas.tsx", "utf8");
const tripClipPreviewSource = readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const tripClipRecordingSource = readFileSync("components/trip-clip-recording-canvas.tsx", "utf8");

assert.ok(
  settingsSource.includes('import { GuideSizeSlider } from "@/features/camera/camera-screen.components"') &&
    settingsSource.includes("<GuideSizeSlider") &&
    settingsSource.includes("compact") &&
    !settingsSource.includes("SettingsGuideSizeSlider"),
  "settings guide size control should reuse the camera tab's smooth GuideSizeSlider"
);

assert.ok(
  !settingsComponentsSource.includes("onResponderMove") &&
    !settingsComponentsSource.includes("export function SettingsGuideSizeSlider"),
  "settings should not keep the old responder-based guide size slider"
);

assert.ok(
  appSettingsSource.includes("guideLineOpacity: number") &&
    appSettingsSource.includes("guideLineOpacity: 0.7") &&
    appSettingsSource.includes("normalizeGuideLineOpacity"),
  "app settings should store a dedicated guide line opacity"
);

assert.ok(
  settingsSource.includes("guideLineOpacity") &&
    settingsSource.includes("가이드 라인 투명도") &&
    !settingsSource.includes("오버레이 투명도"),
  "settings guide section should label and update guide line opacity, not overlay opacity"
);

assert.ok(
  guideOverlaySource.includes("opacity?: number") &&
    guideOverlaySource.includes("safeOpacity") &&
    guideOverlaySource.includes("opacity: safeOpacity"),
  "CameraGuideOverlay should apply the configured guide line opacity"
);

for (const [name, source] of [
  ["camera", cameraSource],
  ["settings", settingsSource],
  ["editable canvas", editableCanvasSource],
  ["trip clip preview", tripClipPreviewSource],
  ["trip clip recording", tripClipRecordingSource]
]) {
  assert.ok(
    source.includes("guideLineOpacity") &&
      source.includes("opacity={") &&
      source.includes("guideLineOpacity"),
    `${name} should pass guideLineOpacity into CameraGuideOverlay`
  );
}

assert.ok(
  editSource.includes("setGuideLineOpacity(settings.guideLineOpacity)") &&
    editSource.includes("guideLineOpacity={guideLineOpacity}"),
  "edit screen should load and pass guideLineOpacity into the editable canvas"
);

assert.ok(
  tripClipSource.includes("setPreviewGuideLineOpacity(settings.guideLineOpacity)") &&
    tripClipSource.includes("guideLineOpacity={previewGuideLineOpacity}"),
  "trip clip screen should load and pass guideLineOpacity into preview surfaces"
);

console.log("ok - settings guide controls match camera guide behavior");

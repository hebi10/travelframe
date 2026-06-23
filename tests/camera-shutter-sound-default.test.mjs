import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const componentSource = fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8");
const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraUiSource = `${source}\n${componentSource}`;

assert.ok(
  appSettingsSource.includes('export type CameraShutterSoundMode = "silent" | "sound"'),
  "camera shutter sound should be persisted as an explicit mode"
);

assert.ok(
  appSettingsSource.includes('cameraShutterSoundMode: "silent"'),
  "camera silent capture should be enabled by default"
);

assert.ok(
  source.includes("const updateCameraShutterSoundMode = (nextMode: CameraShutterSoundMode)"),
  "camera settings should expose an explicit shutter sound mode handler"
);

assert.ok(
  cameraUiSource.includes("촬영 소리"),
  "camera settings should show the shutter sound choice"
);

assert.ok(
  cameraUiSource.includes("무음") && cameraUiSource.includes("소리"),
  "camera shutter sound choice should use explicit silent and sound labels"
);

assert.ok(
  cameraUiSource.includes('mode === "silent" ? styles.optionButtonActive'),
  "camera shutter sound choice should mark silent as the default active option"
);

assert.ok(
  source.includes('enableShutterSound: cameraShutterSoundMode === "sound"'),
  "camera capture should map silent capture to the native shutter sound option"
);

assert.ok(
  source.includes("android_disableSound"),
  "camera shutter pressable should disable Android touch click sound"
);

console.log("ok - camera silent capture setting is restored and defaults to silent");

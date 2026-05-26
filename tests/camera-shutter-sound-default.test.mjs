import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");

assert.ok(
  appSettingsSource.includes("cameraSilentCaptureEnabled: boolean"),
  "camera silent capture should be persisted in app settings"
);

assert.ok(
  appSettingsSource.includes("cameraSilentCaptureEnabled: true"),
  "camera silent capture should be enabled by default"
);

assert.ok(
  source.includes("const updateCameraSilentCapture = (nextEnabled: boolean)"),
  "camera settings should expose a silent capture toggle handler"
);

assert.ok(
  source.includes("무음 촬영"),
  "camera settings should show the silent capture option"
);

assert.ok(
  source.includes("enableShutterSound: !cameraSilentCaptureEnabled"),
  "camera capture should map silent capture to the native shutter sound option"
);

assert.ok(
  source.includes("android_disableSound"),
  "camera shutter pressable should disable Android touch click sound"
);

console.log("ok - camera silent capture setting is restored and defaults to silent");

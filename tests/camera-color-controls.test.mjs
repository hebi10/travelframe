import assert from "node:assert/strict";
import fs from "node:fs";

import { readCameraSource } from "./camera-test-source.mjs";

const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = readCameraSource();

for (const snippet of [
  "cameraExposureBias: number;",
  "cameraColorTemperature: number;",
  "cameraColorTint: number;",
  "cameraBrightness: number;",
  "cameraContrast: number;",
  "cameraSaturation: number;",
  "cameraExposureBias: 0",
  "cameraColorTemperature: 0",
  "cameraColorTint: 0",
  "cameraBrightness: 0",
  "cameraContrast: 0",
  "cameraSaturation: 0",
  "normalizeCameraExposureBias(nextSettings.cameraExposureBias)",
  "normalizeCameraColorTemperature(nextSettings.cameraColorTemperature)",
  "normalizeCameraColorTint(nextSettings.cameraColorTint)",
  "normalizeCameraBrightness(nextSettings.cameraBrightness)",
  "normalizeCameraContrast(nextSettings.cameraContrast)",
  "normalizeCameraSaturation(nextSettings.cameraSaturation)"
]) {
  assert.ok(settingsSource.includes(snippet), `camera color settings missing: ${snippet}`);
}

for (const snippet of [
  'export type CameraControlPanel = "color" | "zoom" | "light";',
  "const [cameraColorTemperature, setCameraColorTemperature] = useState(defaultAppSettings.cameraColorTemperature);",
  "const [cameraColorTint, setCameraColorTint] = useState(defaultAppSettings.cameraColorTint);",
  "const [cameraBrightness, setCameraBrightness] = useState(defaultAppSettings.cameraBrightness);",
  "const [cameraContrast, setCameraContrast] = useState(defaultAppSettings.cameraContrast);",
  "const [cameraSaturation, setCameraSaturation] = useState(defaultAppSettings.cameraSaturation);",
  "setCameraExposureBias(settings.cameraExposureBias);",
  "setCameraColorTemperature(settings.cameraColorTemperature);",
  "setCameraColorTint(settings.cameraColorTint);",
  "setCameraBrightness(settings.cameraBrightness);",
  "setCameraContrast(settings.cameraContrast);",
  "setCameraSaturation(settings.cameraSaturation);",
  "const openColorControls = () => {",
  'activeCameraControlPanel === "color"',
  "cameraColorOverlayStyle",
  "cameraBrightnessOverlayStyle",
  "saveCameraColorSettings",
  "formatCameraExposureValue",
  "formatCameraSignedValue",
  "formatValue={formatCameraExposureValue}",
  "formatValue={formatCameraSignedValue}",
  "cameraExposureBias:",
  "cameraColorTemperature:",
  "cameraColorTint:",
  "cameraBrightness:",
  "cameraContrast:",
  "cameraSaturation:"
]) {
  assert.ok(cameraSource.includes(snippet), `camera color controls missing: ${snippet}`);
}

const instantControlsSource = cameraSource.slice(
  cameraSource.indexOf("style={styles.cameraInstantControlRow}"),
  cameraSource.indexOf('accessibilityLabel="?뺣? ?ㅼ젙 ?닿린"')
);
assert.ok(
  instantControlsSource.includes("openColorControls"),
  "camera color button should be placed before the zoom button"
);

console.log("ok - camera color controls are persisted and available before zoom");

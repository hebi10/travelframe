import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");

for (const snippet of [
  'cameraRatio: "16:9"',
  'cameraSaveScope: "both"',
  "cameraRatios.includes(nextSettings.cameraRatio)",
  "cameraSaveScopes.includes(nextSettings.cameraSaveScope)",
  ": defaultAppSettings.cameraRatio",
  ": defaultAppSettings.cameraSaveScope",
  "return defaultAppSettings;"
]) {
  assert.ok(source.includes(snippet), `app settings camera defaults missing: ${snippet}`);
}

for (const snippet of [
  "useState<PhotoRatioLabel>(defaultAppSettings.cameraRatio)",
  "useState<CameraSaveScope>(defaultAppSettings.cameraSaveScope)",
  "setCameraRatio(settings.cameraRatio)",
  "setCameraSaveScope(settings.cameraSaveScope)",
  "ratioLabel: cameraRatio",
  'cameraSaveScope !== "device"',
  'cameraSaveScope !== "app"'
]) {
  assert.ok(cameraSource.includes(snippet), `camera should use normalized setting: ${snippet}`);
}

for (const snippet of [
  "useState<AppSettings>(defaultAppSettings)",
  "mark={settings.cameraRatio}",
  "mark={cameraSaveScopeLabel[settings.cameraSaveScope]}",
  "active={settings.cameraRatio === ratio}",
  "active={settings.cameraSaveScope === scope.value}"
]) {
  assert.ok(settingsSource.includes(snippet), `settings screen should display normalized setting: ${snippet}`);
}

for (const snippet of [
  'if (label === "Original")',
  "return width && height ? width / height : undefined;",
  'const shouldApplyRatio = ratioLabel !== "Original"',
  "getRatioLabel(prepared.width, prepared.height)"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `Original ratio should preserve captured dimensions: ${snippet}`);
}

console.log("ok - camera defaults use 16:9 and both while preserving valid settings");

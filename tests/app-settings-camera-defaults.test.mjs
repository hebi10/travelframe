import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");

for (const snippet of [
  'cameraRatio: "9:16"',
  'cameraSaveScope: "both"',
  'const cameraRatios: PhotoRatioLabel[] = ["1:1", "3:4", "4:5", "9:16", "16:9"]',
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

assert.ok(
  !source.includes('const cameraRatios: PhotoRatioLabel[] = ["Original",'),
  "camera ratio setting should not allow Original as a saved camera default"
);
const cameraRatioOptionsSource = cameraSource.slice(
  cameraSource.indexOf("const CAMERA_RATIO_OPTIONS"),
  cameraSource.indexOf("const CAMERA_SAVE_SCOPE_OPTIONS")
);
assert.ok(
  !cameraRatioOptionsSource.includes('value: "Original"'),
  "camera ratio controls should not show the Original option"
);
assert.ok(
  !settingsSource.includes('const cameraRatioOptions = ["Original",'),
  "settings camera ratio controls should not show the Original option"
);

const cameraSaveScopeOptionsSource = cameraSource.slice(
  cameraSource.indexOf("const CAMERA_SAVE_SCOPE_OPTIONS"),
  cameraSource.indexOf("const CAMERA_FACING_OPTIONS")
);
assert.ok(
  cameraSaveScopeOptionsSource.indexOf('value: "both"') < cameraSaveScopeOptionsSource.indexOf('value: "app"'),
  "camera save scope controls should show the default app and device option first"
);

const settingsCameraSaveScopeOptionsSource = settingsSource.slice(
  settingsSource.indexOf("const cameraSaveScopeOptions"),
  settingsSource.indexOf("const tripClipExportFormatOptions")
);
assert.ok(
  settingsCameraSaveScopeOptionsSource.indexOf('value: "both"') <
    settingsCameraSaveScopeOptionsSource.indexOf('value: "app"'),
  "settings camera save scope controls should show the default app and device option first"
);

console.log("ok - camera defaults use 9:16 and both while preserving valid settings");

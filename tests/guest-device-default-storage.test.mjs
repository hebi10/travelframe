import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const planSource = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");
const studioSource = fs.readFileSync("app/(tabs)/studio.tsx", "utf8");
const cloudBackupSource = fs.readFileSync("lib/cloud-backup.ts", "utf8");

const transpiledPlan = ts.transpileModule(planSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const { PLAN_ENTITLEMENTS, getPlanEntitlements } = await import(
  `data:text/javascript,${encodeURIComponent(transpiledPlan)}`
);

assert.ok(
  appSettingsSource.includes('cameraSaveScope: "app_device"'),
  "fresh installs should save camera captures to both the app library and phone album by default"
);
assert.ok(
  appSettingsSource.includes('storageMode: "local_only"') &&
    appSettingsSource.includes("cloudBackupEnabled: false"),
  "fresh installs should not enable cloud backup by default"
);

assert.equal(
  getPlanEntitlements({ isLoggedIn: false, subscription: null }).tier,
  "guest",
  "logged-out users should keep using the guest tier"
);
assert.equal(
  PLAN_ENTITLEMENTS.guest.localImageLimit,
  PLAN_ENTITLEMENTS.free.localImageLimit,
  "logged-out users should be able to use the local app image library"
);
assert.equal(
  PLAN_ENTITLEMENTS.guest.localVideoLimit,
  PLAN_ENTITLEMENTS.free.localVideoLimit,
  "logged-out users should be able to load and use local video work in the library"
);

for (const snippet of [
  'export type CameraSaveTarget = "app" | "device" | "cloud"',
  "getCameraSaveScopeTargets",
  "createCameraSaveScope",
  'app_device: { app: true, device: true, cloud: false }',
  'all: { app: true, device: true, cloud: true }'
]) {
  assert.ok(appSettingsSource.includes(snippet), `camera save targets should be independent: ${snippet}`);
}

assert.ok(
  appSettingsSource.includes('if (value === "both")') &&
    appSettingsSource.includes('return "app_device"'),
  "legacy app plus phone album settings should migrate to app_device"
);

const cameraSaveScopeOptionsSource = cameraSource.slice(
  cameraSource.indexOf("const CAMERA_SAVE_SCOPE_OPTIONS"),
  cameraSource.indexOf("const CAMERA_FACING_OPTIONS")
);
assert.ok(
  cameraSaveScopeOptionsSource.includes('value: "app"') &&
    cameraSaveScopeOptionsSource.includes('value: "device"') &&
    cameraSaveScopeOptionsSource.includes('value: "cloud"') &&
    cameraSource.includes("toggleCameraSaveTarget(option.value)"),
  "camera save scope controls should expose app, phone album, and cloud as independent toggles"
);

const settingsCameraSaveScopeOptionsSource = settingsSource.slice(
  settingsSource.indexOf("const cameraSaveScopeOptions"),
  settingsSource.indexOf("const tripClipExportFormatOptions")
);
assert.ok(
  settingsCameraSaveScopeOptionsSource.includes('value: "app"') &&
    settingsCameraSaveScopeOptionsSource.includes('value: "device"') &&
    settingsCameraSaveScopeOptionsSource.includes('value: "cloud"') &&
    settingsSource.includes("toggleCameraSaveTarget(scope.value)"),
  "settings save scope controls should expose app, phone album, and cloud as independent toggles"
);

assert.ok(
  cloudBackupSource.includes("if (!enabled || !user)") &&
    cloudBackupSource.includes("shouldUseCloudBackupForStorageMode("),
  "cloud backup should remain gated by enabled storage mode and logged-in user"
);

for (const snippet of [
  "getPhotos()",
  "getMadeVideos()",
  "getImageBundleWorks()",
  "getAppSettings()",
  "setCloudBackupEnabled(settings.cloudBackupEnabled)"
]) {
  assert.ok(studioSource.includes(snippet), `studio should load local app data and settings: ${snippet}`);
}

console.log("ok - logged-out users default to app and phone album saves without cloud backup");

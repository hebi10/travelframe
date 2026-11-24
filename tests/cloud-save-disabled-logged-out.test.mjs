import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");

for (const snippet of [
  "const canSelectCloudSaveTarget = planEntitlements.canBackupToCloud",
  'target === "cloud" && !canSelectCloudSaveTarget',
  "cloudAllowed: canSelectCloudSaveTarget",
  "getProjectSaveTargets({",
  "saveScope: captureSaveScope",
  "disabled={option.value === \"app\" || isCloudSaveTargetDisabled}",
  "accessibilityState={{ disabled: option.value === \"app\" || isCloudSaveTargetDisabled"
]) {
  assert.ok(cameraSource.includes(snippet), `camera should disable cloud saves while logged out: ${snippet}`);
}

for (const snippet of [
  "const canSelectCloudSaveTarget = planEntitlements.canBackupToCloud",
  'target === "cloud" && !canSelectCloudSaveTarget',
  "const isCloudSaveTargetDisabled = scope.value === \"cloud\" && !canSelectCloudSaveTarget",
  "disabled={isDisabled}",
  "active={getCameraSaveScopeTargets(settings.cameraSaveScope)[scope.value] && !isCloudSaveTargetDisabled}"
]) {
  assert.ok(settingsSource.includes(snippet), `settings should disable cloud saves while logged out: ${snippet}`);
}

console.log("ok - cloud save target is disabled while logged out");

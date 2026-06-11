import assert from "node:assert/strict";
import fs from "node:fs";

const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "let appSettingsUpdateChain: Promise<AppSettings> = Promise.resolve(defaultAppSettings);",
  "const runUpdate = async () => {",
  "const current = await getAppSettings();",
  "const nextUpdate = appSettingsUpdateChain.then(runUpdate, runUpdate);",
  "appSettingsUpdateChain = nextUpdate.catch(async () => getAppSettings());",
  "return nextUpdate;"
]) {
  assert.ok(
    appSettingsSource.includes(snippet),
    `app settings updates should be serialized and recoverable: ${snippet}`
  );
}

assert.ok(
  appSettingsSource.indexOf("const current = await getAppSettings();") >
    appSettingsSource.indexOf("const runUpdate = async () => {"),
  "each queued app settings update should read the latest stored settings at execution time"
);

for (const snippet of [
  "} catch (error) {",
  "const pendingPatch = pendingSettingsPatchRef.current ?? {};",
  "pendingSettingsPatchRef.current = {",
  "...nextPatch,",
  "...pendingPatch",
  "throw error;"
]) {
  assert.ok(
    cameraSource.includes(snippet),
    `camera settings queue should preserve failed patches for retry: ${snippet}`
  );
}

const cameraFlushSource = cameraSource.slice(
  cameraSource.indexOf("const flushQueuedAppSettingsUpdates = useCallback(async () =>"),
  cameraSource.indexOf("const queueAppSettingsUpdate = useCallback(")
);
assert.ok(
  cameraFlushSource.indexOf("pendingSettingsPatchRef.current = null;") <
    cameraFlushSource.indexOf("await updateAppSettings(nextPatch);"),
  "camera should clear the pending patch before writing so newer updates can batch separately"
);
assert.ok(
  cameraFlushSource.indexOf("...nextPatch,") <
    cameraFlushSource.indexOf("...pendingPatch"),
  "failed camera patch should be restored before newer pending values so the newest values still win"
);

console.log("ok - app settings updates are queued and failed camera patches are preserved");

import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const errorSource = fs.readFileSync(
  new URL("../lib/user-facing-error.ts", import.meta.url),
  "utf8"
);
const settingsSource = fs.readFileSync(
  new URL("../features/settings/SettingsScreen.tsx", import.meta.url),
  "utf8"
);
const accountSource = fs.readFileSync(
  new URL("../features/account/AccountScreen.tsx", import.meta.url),
  "utf8"
);
const backupSource = fs.readFileSync(
  new URL("../lib/cloud-backup.ts", import.meta.url),
  "utf8"
);
const tripClipSource = readTripClipSource();
const editableCanvasSource = fs.readFileSync(
  new URL("../components/editable-photo-canvas.tsx", import.meta.url),
  "utf8"
);
const mediaAvailabilitySource = fs.readFileSync(
  new URL("../lib/media-library-availability.ts", import.meta.url),
  "utf8"
);

for (const snippet of [
  "isDeveloperErrorMessage",
  "npm run",
  "firebase:deploy",
  "Firebase Functions",
  "Firebase Storage",
  "EAS",
  "개발 빌드",
  "native module",
  "react-native",
  "node_modules",
  "return fallback;"
]) {
  assert.ok(errorSource.includes(snippet), `user-facing error sanitizer missing: ${snippet}`);
}

for (const forbidden of [
  "setAuthMessage(error instanceof Error ? error.message",
  "? error.message\n                  :",
  "Android 개발 빌드를 다시 만든 뒤",
  "Firebase 웹 앱 config를 .env",
  "Metro 서버",
  "npm run firebase:deploy-functions",
  "Firebase Functions가",
  "Firebase Storage가",
  "react-native-view-recorder가",
  "EAS Android 개발"
]) {
  for (const [name, source] of [
    ["settings", settingsSource],
    ["account", accountSource],
    ["backup", backupSource],
    ["trip clip", tripClipSource],
    ["editable canvas", editableCanvasSource],
    ["media availability", mediaAvailabilitySource]
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `${name} must not render raw developer errors: ${forbidden}`
    );
  }
}

console.log("ok - developer error messages are sanitized before reaching users");

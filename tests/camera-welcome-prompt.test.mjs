import assert from "node:assert/strict";
import fs from "node:fs";

import { readCameraSource } from "./camera-test-source.mjs";
import { readSettingsSource } from "./settings-test-source.mjs";

const appSettingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const cameraSource = readCameraSource();
const settingsSource = readSettingsSource();
const gitignoreSource = fs.readFileSync(".gitignore", "utf8");

assert.match(
  appSettingsSource,
  /cameraWelcomePromptDismissed:\s*boolean/,
  "AppSettings should include a camera welcome prompt dismissal flag"
);
assert.match(
  appSettingsSource,
  /cameraWelcomePromptDismissed:\s*false/,
  "camera welcome prompt should be enabled by default"
);
assert.match(
  appSettingsSource,
  /typeof nextSettings\.cameraWelcomePromptDismissed === "boolean"/,
  "camera welcome prompt setting should normalize stored values"
);

assert.match(
  cameraSource,
  /CameraWelcomePrompt/,
  "camera screen should render the welcome prompt component"
);
assert.match(
  cameraSource,
  /다시 보지 않기/,
  "camera welcome prompt should expose a do-not-show-again choice"
);
assert.match(
  cameraSource,
  /setGuideSettingsOpen\(true\)/,
  "guide shooting action should open guide settings"
);
assert.match(
  cameraSource,
  /router\.push\("\/studio\?tab=videos" as Href\)/,
  "video action should send users to the studio video tab"
);
assert.match(
  cameraSource,
  /!welcomePromptVisible \? <AppGuideOverlay tabKey="camera" transparentBackdrop \/> : null/,
  "app guide overlay should be hidden while the camera welcome prompt is visible"
);

assert.match(
  settingsSource,
  /시작 안내 팝업/,
  "settings should expose the camera welcome prompt toggle"
);
assert.match(
  settingsSource,
  /cameraWelcomePromptDismissed:\s*!nextEnabled/,
  "settings toggle should map on/off to the dismissal flag"
);

assert.match(
  gitignoreSource,
  /^\.superpowers\/$/m,
  ".superpowers brainstorm files should be ignored"
);

console.log("ok - camera welcome prompt source wiring is present");

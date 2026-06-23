import assert from "node:assert/strict";
import fs from "node:fs";

import { readAccountSource } from "./account-test-source.mjs";
import { readSettingsSource } from "./settings-test-source.mjs";
import { readStudioSource } from "./studio-test-source.mjs";

const sources = [
  ["features/studio", readStudioSource()],
  ["app/photo/[id].tsx", fs.readFileSync("app/photo/[id].tsx", "utf8")],
  ["app/video/[id].tsx", fs.readFileSync("app/video/[id].tsx", "utf8")],
  ["app/edit.tsx", fs.readFileSync("app/edit.tsx", "utf8")],
  ["components/trip-clip-preview-player.tsx", fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8")]
];

for (const [file, source] of sources) {
  assert.ok(
    source.includes('timeZone: "Asia/Seoul"'),
    `${file} should format visible app dates in Korean time`
  );
}

for (const [screenFile, source] of [
  ["features/account", readAccountSource()],
  ["features/settings", readSettingsSource()]
]) {
  assert.ok(
    source.includes('timeZone: "Asia/Seoul"'),
    `${screenFile} should format visible app dates in Korean time`
  );
}

console.log("ok - visible app date formats use Korea time");

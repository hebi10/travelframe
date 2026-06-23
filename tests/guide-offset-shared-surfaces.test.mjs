import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const editableCanvasSource = fs.readFileSync("components/editable-photo-canvas.tsx", "utf8");
const tripClipSource = readTripClipSource();
const previewPlayerSource = fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");

for (const snippet of [
  "guideOffsetX",
  "guideOffsetY",
  "setGuideOffsetX(settings.guideOffsetX)",
  "setGuideOffsetY(settings.guideOffsetY)",
  "guideOffsetX={guideOffsetX}",
  "guideOffsetY={guideOffsetY}"
]) {
  assert.ok(editSource.includes(snippet), `edit screen should use guide offset: ${snippet}`);
}

for (const snippet of [
  "guideOffsetX?: number;",
  "guideOffsetY?: number;",
  "guideOffsetX = 0",
  "guideOffsetY = 0",
  "offsetX={guideOffsetX}",
  "offsetY={guideOffsetY}"
]) {
  assert.ok(editableCanvasSource.includes(snippet), `editable canvas should pass guide offset: ${snippet}`);
}

for (const snippet of [
  "previewGuideOffsetX",
  "previewGuideOffsetY",
  "setPreviewGuideOffsetX(settings.guideOffsetX)",
  "setPreviewGuideOffsetY(settings.guideOffsetY)",
  "guideOffsetX={previewGuideOffsetX}",
  "guideOffsetY={previewGuideOffsetY}"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip should use guide offset: ${snippet}`);
}

for (const snippet of [
  "guideOffsetX?: number;",
  "guideOffsetY?: number;",
  "guideOffsetX = 0",
  "guideOffsetY = 0",
  "offsetX={guideOffsetX}",
  "offsetY={guideOffsetY}"
]) {
  assert.ok(previewPlayerSource.includes(snippet), `trip clip preview should pass guide offset: ${snippet}`);
}

for (const snippet of [
  "offsetX={settings.guideOffsetX}",
  "offsetY={settings.guideOffsetY}"
]) {
  assert.ok(settingsSource.includes(snippet), `settings preview should use guide offset: ${snippet}`);
}

console.log("ok - saved guide offset is shared across guide surfaces");

import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const editableCanvasSource = fs.readFileSync("components/editable-photo-canvas.tsx", "utf8");
const tripClipSource = readTripClipSource();
const previewPlayerSource = fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const recordingCanvasSource = fs.readFileSync("components/trip-clip-recording-canvas.tsx", "utf8");
const settingsSource = fs.readFileSync("features/settings/SettingsScreen.tsx", "utf8");

for (const snippet of [
  "guideShapePoints",
  "setGuideShapePoints(settings.guideShapePoints)",
  "guideShapePoints={guideShapePoints}"
]) {
  assert.ok(editSource.includes(snippet), `edit screen should use shape guide points: ${snippet}`);
}

for (const snippet of [
  "guideShapePoints: GuideShapePoints;",
  "shapePoints={guideShapePoints}"
]) {
  assert.ok(
    editableCanvasSource.includes(snippet),
    `editable canvas should pass shape guide points: ${snippet}`
  );
}

for (const snippet of [
  "previewGuideShapePoints",
  "setPreviewGuideShapePoints(settings.guideShapePoints)",
  "guideShapePoints={previewGuideShapePoints}"
]) {
  assert.ok(tripClipSource.includes(snippet), `trip clip should use shape guide points: ${snippet}`);
}

for (const [sourceName, source] of [
  ["preview player", previewPlayerSource],
  ["recording canvas", recordingCanvasSource]
]) {
  for (const snippet of [
    "guideShapePoints: GuideShapePoints;",
    "shapePoints={guideShapePoints}"
  ]) {
    assert.ok(source.includes(snippet), `${sourceName} should pass shape guide points: ${snippet}`);
  }
}

assert.ok(
  settingsSource.includes("shapePoints={settings.guideShapePoints}"),
  "settings preview should use saved shape guide points"
);

console.log("ok - saved shape guide points are shared across guide surfaces");

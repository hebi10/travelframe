import assert from "node:assert/strict";
import fs from "node:fs";

const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const editableCanvasSource = fs.readFileSync("components/editable-photo-canvas.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const previewPlayerSource = fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const recordingCanvasSource = fs.readFileSync("components/trip-clip-recording-canvas.tsx", "utf8");
const settingsSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");

for (const [label, source] of [
  ["edit screen", editSource],
  ["trip clip screen", tripClipSource]
]) {
  assert.ok(
    source.includes("set") && source.includes("settings.gridGuideLinePositions"),
    `${label} should load stored grid guide line positions`
  );
}

for (const [label, source] of [
  ["editable photo canvas", editableCanvasSource],
  ["trip clip preview player", previewPlayerSource],
  ["trip clip recording canvas", recordingCanvasSource],
  ["settings guide preview", settingsSource]
]) {
  assert.ok(
    source.includes("gridLinePositions={") && source.includes("gridGuideLinePositions"),
    `${label} should pass grid guide line positions to CameraGuideOverlay`
  );
}

console.log("ok - guide grid positions stay synchronized across edit and trip clip surfaces");

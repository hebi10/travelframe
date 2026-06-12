import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import ts from "typescript";

const offsetSource = fs.readFileSync("lib/guide-offset.ts", "utf8");
const settingsSource = fs.readFileSync("lib/app-settings.ts", "utf8");
const overlaySource = fs.readFileSync("components/camera-guide-overlay.tsx", "utf8");
const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const editableCanvasSource = fs.readFileSync("components/editable-photo-canvas.tsx", "utf8");
const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const previewPlayerSource = fs.readFileSync("components/trip-clip-preview-player.tsx", "utf8");
const recordingCanvasSource = fs.readFileSync("components/trip-clip-recording-canvas.tsx", "utf8");
const settingsScreenSource = fs.readFileSync("app/(tabs)/settings.tsx", "utf8");

const { outputText } = ts.transpileModule(offsetSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
});
const offsetModule = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

assert.deepEqual(
  offsetModule.scaleGuideOffsetForFrame({
    offset: { x: 120, y: -160 },
    sourceFrame: { width: 400, height: 800 },
    targetFrame: { width: 200, height: 400 }
  }),
  { x: 60, y: -80 },
  "guide offset should scale with the current frame size"
);

assert.deepEqual(
  offsetModule.scaleGuideOffsetForFrame({
    offset: { x: 120, y: -160 },
    sourceFrame: { width: 0, height: 800 },
    targetFrame: { width: 200, height: 400 }
  }),
  { x: 120, y: -80 },
  "invalid source dimensions should fall back per axis"
);

for (const snippet of [
  "guideOffsetFrameWidth: number;",
  "guideOffsetFrameHeight: number;",
  "guideOffsetFrameWidth: 0",
  "guideOffsetFrameHeight: 0",
  "guideOffsetFrameWidth: normalizeGuideOffsetFrameSize(nextSettings.guideOffsetFrameWidth)",
  "guideOffsetFrameHeight: normalizeGuideOffsetFrameSize(nextSettings.guideOffsetFrameHeight)"
]) {
  assert.ok(settingsSource.includes(snippet), `app settings should persist guide offset frame: ${snippet}`);
}

for (const snippet of [
  "offsetFrameWidth?: number;",
  "offsetFrameHeight?: number;",
  "scaleGuideOffsetForFrame",
  "onLayout={handleGuideFrameLayout}",
  "offsetFrameWidth",
  "offsetFrameHeight"
]) {
  assert.ok(overlaySource.includes(snippet), `guide overlay should scale offsets: ${snippet}`);
}

for (const [name, source, frameSnippet] of [
  ["camera", cameraSource, "guideOffsetFrameWidth: cameraFrame.width"],
  ["edit", editSource, "guideOffsetFrameWidth: guideMoveFrame.width"],
  ["trip clip", tripClipSource, "guideOffsetFrameWidth: previewFrameSize.width"]
]) {
  assert.ok(source.includes(frameSnippet), `${name} should save the frame used for guide offset`);
  assert.ok(source.includes("guideOffsetFrameHeight"), `${name} should save guide offset frame height`);
}

for (const [name, source] of [
  ["camera", cameraSource],
  ["editable photo canvas", editableCanvasSource],
  ["trip clip preview", previewPlayerSource],
  ["trip clip recording", recordingCanvasSource],
  ["settings preview", settingsScreenSource]
]) {
  assert.ok(source.includes("offsetFrameWidth={"), `${name} should pass guide offset frame width`);
  assert.ok(source.includes("offsetFrameHeight={"), `${name} should pass guide offset frame height`);
}

assert.ok(
  editableCanvasSource.includes("onGuideFrameLayout?.("),
  "editable photo canvas should report the actual rendered guide frame to the editor"
);

console.log("ok - guide offsets scale consistently across guide surfaces");

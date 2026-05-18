import assert from "node:assert/strict";
import fs from "node:fs";

const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const canvasSource = fs.readFileSync("components/editable-photo-canvas.tsx", "utf8");

for (const snippet of [
  "bottomSafePadding",
  "expandCanvasButton",
  "bottom: bottomSafePadding",
  "수평 맞추기",
  "canvasRef.current?.straighten()"
]) {
  assert.ok(editSource.includes(snippet), `edit screen safe area/straighten missing: ${snippet}`);
}

assert.ok(!editSource.includes(">이동<"), "edit toolbar should not show 이동 as a separate tool");

for (const snippet of [
  "straighten: () => void;",
  "straighten: () => {",
  "rotation.value = 0;",
  "rotateRight"
]) {
  assert.ok(canvasSource.includes(snippet), `editable canvas straighten handle missing: ${snippet}`);
}

console.log("ok - edit view respects bottom safe area and has straighten action");

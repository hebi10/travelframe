import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("lib/project-photo-window.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
});
const { PROJECT_PHOTO_BATCH, nextProjectPhotoCount } = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);
assert.equal(PROJECT_PHOTO_BATCH % 2, 0);
assert.equal(PROJECT_PHOTO_BATCH % 3, 0);
for (const total of [0, 1, 36, 100, 200, 365]) {
  let visible = Math.min(PROJECT_PHOTO_BATCH, total);
  let batches = 0;
  while (visible < total) {
    const next = nextProjectPhotoCount(visible, total);
    assert.ok(next > visible && next - visible <= PROJECT_PHOTO_BATCH && next <= total);
    visible = next;
    batches++;
  }
  assert.equal(visible, total);
  assert.ok(batches <= 10);
}
const screen = fs.readFileSync("features/records/BodyFrameProjectDetailScreen.tsx", "utf8");
assert.ok(screen.includes("projectPhotos.slice(0, renderedPhotoCount)"));
assert.ok(screen.includes("dragCount={renderedPhotoCount}"));
assert.ok(screen.includes("count={projectPhotos.length}"));
assert.ok(screen.includes("순번 이동"));
assert.ok(screen.indexOf("오늘 사진 찍기") < screen.indexOf("projectPhotos.slice(0, renderedPhotoCount)"));
assert.ok(screen.includes("onScroll={({ nativeEvent })"));
console.log("ok - bounded incremental photo grid, full-order accessibility and early capture actions");

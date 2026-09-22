import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const tripClipStyles = fs.readFileSync(
  "features/trip-clip/trip-clip-screen.styles.ts",
  "utf8"
);

const getStyleBlock = (source, styleName) => {
  const start = source.indexOf(`  ${styleName}: {`);
  assert.ok(start >= 0, `missing style block: ${styleName}`);
  const end = source.indexOf("\n  },", start);
  assert.ok(end > start, `unterminated style block: ${styleName}`);
  return source.slice(start, end);
};

const captureHint = getStyleBlock(cameraSource, "captureHint");
assert.equal(
  captureHint.includes("backgroundColor"),
  false,
  "plain camera hint text should not have its own background color"
);
assert.equal(
  captureHint.includes("paddingHorizontal") || captureHint.includes("paddingVertical"),
  false,
  "plain camera hint text should not be styled as a pill"
);
assert.equal(
  captureHint.includes("borderRadius"),
  false,
  "plain camera hint text should not use a badge radius"
);

const editGuideHint = getStyleBlock(editSource, "guideMoveText");
const previewGuideHint = getStyleBlock(tripClipStyles, "previewGuideMoveText");
assert.ok(
  editGuideHint.includes("backgroundColor"),
  "photo-overlay drag instructions should retain a contrast background"
);
assert.ok(
  previewGuideHint.includes("backgroundColor"),
  "video-preview drag instructions should retain a contrast background"
);

console.log("ok - plain text stays unboxed while image-overlay instructions keep contrast backgrounds");

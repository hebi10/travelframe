import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/trip-clip-photo-adjustment.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const {
  DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT,
  getTripClipPhotoAdjustment,
  setTripClipPhotoAdjustment
} = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

const adjusted = setTripClipPhotoAdjustment({}, "photo-1", {
  translateX: 24,
  translateY: -12,
  scale: 1.4
});

assert.deepEqual(getTripClipPhotoAdjustment(adjusted, "photo-1"), {
  translateX: 24,
  translateY: -12,
  scale: 1.4
});
assert.deepEqual(
  getTripClipPhotoAdjustment(adjusted, "missing"),
  DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT
);
assert.deepEqual(setTripClipPhotoAdjustment(adjusted, "photo-1", {
  ...DEFAULT_TRIP_CLIP_PHOTO_ADJUSTMENT
}), {});

console.log("ok - trip clip photo adjustments persist per selected photo");

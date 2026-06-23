import assert from "node:assert/strict";
import fs from "node:fs";
import { readTripClipSource } from "./trip-clip-test-source.mjs";

const source = readTripClipSource();

const effectStart = source.indexOf("  useEffect(() => {\n    setRenderedVideoUri(null);");
const effectEnd = source.indexOf("\n\n  useEffect(() => {", effectStart + 1);

assert.ok(effectStart >= 0 && effectEnd > effectStart, "trip clip render cache invalidation effect should exist");

const invalidationEffect = source.slice(effectStart, effectEnd);

for (const dependency of [
  "customMusic?.uri",
  "durations",
  "musicMode",
  "photoAdjustments",
  "planEntitlements.showWatermark",
  "previewGridGuideLinePositions",
  "previewGuide",
  "previewGuideColor",
  "previewGuideOffsetX",
  "previewGuideOffsetY",
  "previewGuideShapePoints",
  "previewGuideSize",
  "previewGuideStrokeWidth",
  "previewGuideVisible",
  "ratio",
  "selectedIds",
  "selectedUserMusicId",
  "template",
  "transition",
  "transitionDuration",
  "videoQuality"
]) {
  assert.ok(
    invalidationEffect.includes(dependency),
    `rendered MP4 cache should be invalidated when ${dependency} changes`
  );
}

console.log("ok - trip clip invalidates rendered MP4 cache when video inputs change");

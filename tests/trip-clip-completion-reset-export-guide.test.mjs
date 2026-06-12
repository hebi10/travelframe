import assert from "node:assert/strict";
import fs from "node:fs";

const tripClipSource = fs.readFileSync("app/(tabs)/trip-clip.tsx", "utf8");
const recordingStart = tripClipSource.indexOf("<TripClipRecordingCanvas");
const recordingEnd = tripClipSource.indexOf("/>", recordingStart);
const recordingBlock = tripClipSource.slice(recordingStart, recordingEnd);

assert.ok(recordingStart >= 0 && recordingEnd > recordingStart, "trip clip recording canvas should exist");
assert.ok(
  recordingBlock.includes("guideVisible={false}") &&
    !recordingBlock.includes("guideVisible={previewGuideVisible}"),
  "export recording canvas should hide guide lines even when preview guide is visible"
);

const resetStart = tripClipSource.indexOf("const resetNewTripClipProject = useCallback");
const resetEnd = tripClipSource.indexOf("const createTripClipDraftPayload", resetStart);
const resetBlock = tripClipSource.slice(resetStart, resetEnd);

assert.ok(resetStart >= 0 && resetEnd > resetStart, "trip clip should define a fresh-project reset helper");

for (const snippet of [
  "autoDurationIdsRef.current.clear()",
  "setSelectedIds([])",
  "setDurations({})",
  "setPhotoAdjustments({})",
  'setActiveEditorTab("photos")',
  'setWorkTitle("")',
  "setRenderedVideoUri(null)",
  "setProgressSeconds(0)",
  "setActiveIndex(0)"
]) {
  assert.ok(resetBlock.includes(snippet), `fresh-project reset should clear: ${snippet}`);
}

assert.ok(
  (tripClipSource.match(/resetNewTripClipProject\(\);/g) ?? []).length >= 2,
  "image and MP4 export completion should reset the editor for the next new trip clip"
);

console.log("ok - trip clip completion resets state and exports without guide lines");

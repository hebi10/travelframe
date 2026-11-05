import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const trip = read("features/trip-clip/TripClipScreen.tsx");
const tripStyles = read("features/trip-clip/trip-clip-screen.styles.ts");
const studio = read("features/studio/StudioScreen.tsx");
const studioStyles = read("features/studio/studio-screen.styles.ts");
const studioComponents = read("features/studio/studio-screen.components.tsx");
const settings = read("features/settings/SettingsScreen.tsx");
const settingsStyles = read("features/settings/settings-screen.styles.ts");
const edit = read("app/edit.tsx");
const videoDetail = read("app/video/[id].tsx");
const legacyRoutes = [
  ["app/legacy-video-edit.tsx", "TripClipScreen"],
  ["app/legacy-studio.tsx", "StudioScreen"],
  ["app/advanced-settings.tsx", "SettingsScreen"]
];

for (const [path, component] of legacyRoutes) {
  assert.ok(read(path).includes("export default " + component), path + " must keep its compatible route");
}
assert.ok(videoDetail.includes("/legacy-video-edit"), "existing video re-edit path must remain reachable");

const tsxFiles = [
  "features/trip-clip/TripClipScreen.tsx",
  "features/trip-clip/trip-clip-screen.components.tsx",
  ...["TripClipHeader", "TripClipPreview", "TripClipPhotoTab", "TripClipTimelineTab",
      "TripClipVideoTab", "TripClipGuideTab", "TripClipMusicTab", "TripClipExportTab"]
    .map((name) => "features/trip-clip/components/" + name + ".tsx"),
  "features/studio/StudioScreen.tsx",
  "features/studio/studio-screen.components.tsx",
  "features/settings/SettingsScreen.tsx",
  "app/edit.tsx"
];
for (const path of tsxFiles) {
  const parsed = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(
    parsed.parseDiagnostics.length, 0,
    path + " must parse without TSX diagnostics: " +
      parsed.parseDiagnostics.map((d) => d.messageText).join("; ")
  );
}

assert.ok(tripStyles.includes("createTripClipStyles = (colors: AppPalette)"));
assert.ok(tripStyles.includes("useAppAppearance()"));
assert.ok(tripStyles.includes("useMemo(() => createTripClipStyles(palette), [palette])"));
assert.ok(studioStyles.includes("createStudioStyles = (colors: AppPalette)"));
assert.ok(studioStyles.includes("useMemo(() => createStudioStyles(palette), [palette])"));
assert.ok(trip.includes("const styles = useTripClipStyles();"));
assert.ok(studio.includes("const styles = useStudioStyles();"));
for (const path of tsxFiles.filter((p) => p.startsWith("features/trip-clip/components/"))) {
  assert.ok(read(path).includes("const styles = useTripClipStyles();"), path + " must adopt the shared editor palette");
}
assert.equal((read("features/trip-clip/trip-clip-screen.components.tsx").match(/const styles = useTripClipStyles\(\);/g) ?? []).length, 6);
assert.equal((studioComponents.match(/const styles = useStudioStyles\(\);/g) ?? []).length, 11);

for (const [name, input, expected] of [
  ["recordingView", "backgroundColor", "legacyColors.ink"],
  ["recordingCanvasInner", "backgroundColor", "legacyColors.ink"],
  ["recordingWatermarkText", "color", "legacyColors.inverse"],
  ["previewFrame", "backgroundColor", "legacyColors.ink"],
  ["previewInner", "backgroundColor", "legacyColors.ink"],
  ["frameFitModalFrame", "backgroundColor", "legacyColors.ink"]
]) {
  const start = tripStyles.indexOf("  " + name + ": {");
  const end = tripStyles.indexOf("\n  },", start);
  assert.ok(start >= 0 && end > start, name + " must retain its independent canvas/preview style");
  assert.ok(tripStyles.slice(start, end).includes(input + ": " + expected), name + " must not inherit UI theme colors");
}
for (const preserved of [
  "TripClipRecordingCanvas",
  "getTripClipDraft",
  "saveTripClipDraft",
  "getMadeVideoById",
  "renderMp4Video",
  "saveMadeVideo",
  "updateMadeVideo",
  "useOptionalViewRecorder"
]) {
  assert.ok(trip.includes(preserved), preserved + " editing/export contract must remain present");
}
for (const source of [tripStyles, studioStyles, edit]) {
  assert.ok(!source.includes("bodyFrameAccent"), "legacy UI primary/selection must not use status lime");
}
assert.ok(tripStyles.includes("backgroundColor: colors.text"));
assert.ok(tripStyles.includes("color: colors.inverse"));
assert.ok(trip.includes('accessibilityRole="tab"'));
assert.ok(trip.includes("accessibilityState={{ selected: isActive, disabled: isLocked }}"));
assert.ok(read("features/trip-clip/trip-clip-screen.components.tsx").includes('accessibilityRole="radio"'));
assert.ok(edit.includes('accessibilityRole="radio"') && edit.includes("accessibilityState={{ selected: isActive }}"));
assert.ok(edit.includes("borderColor: bodyFrameDarkColors.text"));
assert.ok(edit.includes("backgroundColor: bodyFrameDarkColors.text"));

const legacyModals = [
  ["features/trip-clip/TripClipScreen.tsx", 2],
  ["features/settings/SettingsScreen.tsx", 5],
  ["features/studio/StudioScreen.tsx", 2]
];
assert.equal(legacyModals.reduce((sum, [, count]) => sum + count, 0), 9);
for (const [path, expected] of legacyModals) {
  const source = read(path);
  assert.equal((source.match(/<Modal\b/g) ?? []).length, expected, path + " modal count must remain unchanged");
  assert.equal((source.match(/\baccessibilityViewIsModal\b/g) ?? []).length, expected,
    path + " must isolate every legacy modal for screen readers");
}
assert.ok(settings.includes("BodyFrameSheetHandle"));
assert.ok(settings.includes('onPress={confirmBackup}'));
assert.ok(settings.includes("saveAppSettings"));
assert.ok(settings.includes("confirmBackup"));
assert.ok(studio.includes("deleteMadeVideo") && studio.includes("saveCapturedPhoto"));
assert.ok(settingsStyles.includes("bodyFrameSheetDesign.maxHeight"));
assert.ok(settingsStyles.includes("bodyFrameSheetDesign.backdropColor"));
assert.ok(tripStyles.includes("bodyFrameSheetDesign.backdropColor"));
assert.ok(studioStyles.includes("bodyFrameSheetDesign.backdropColor"));

const nativeQa = read("scripts/capture-android-qa.py");
assert.ok(nativeQa.includes("('legacy-studio', 'legacy-studio'"));
assert.ok(nativeQa.includes("('legacy-advanced-settings', 'advanced-settings'"));
assert.ok(!nativeQa.includes("guest-authenticated-video-editor"), "never fake a signed-in video reedit QA scenario");

console.log("ok - Body Frame Stage 5 legacy theme, nine modals, edit controls and recording boundary");

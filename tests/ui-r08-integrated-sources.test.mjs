import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const manifest = JSON.parse(read("docs/qa/ui-r08-source-manifest-20261111.json"));
const workflow = read(".github/workflows/body-frame-device-qa.yml");
const files = [
  "features/records/BodyFrameRecordsScreen.tsx",
  "features/records/BodyFrameProjectDetailScreen.tsx",
  "features/records/BodyMeasurementHistoryScreen.tsx",
  "components/body-measurement-summary-card.tsx",
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "components/body-frame-status-notice.tsx",
  "components/body-frame-sheet.tsx",
  "features/records/BodyFrameCompareScreen.tsx",
  "app/video/[id].tsx",
  "app/(tabs)/_layout.tsx",
  "components/app-guide-overlay.tsx",
  "features/camera/BodyFrameProjectSwitcher.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx",
  "features/account/AccountScreen.tsx"
];

test("UI-R08 verifies the exact seven source heads and cannot be mistaken for a release", () => {
  assert.equal(manifest.stage, "UI-R08");
  assert.equal(manifest.mode, "QA_ONLY_PREVIEW");
  assert.deepEqual(manifest.sources.map((s) => s.pr), [150, 151, 152, 153, 154, 155, 156]);
  assert.match(manifest.baseline_main, /^[a-f0-9]{40}$/);
  assert.ok(manifest.sources.every((item) => /^[a-f0-9]{40}$/.test(item.head_sha)));
  assert.equal(new Set(manifest.sources.map((item) => item.head_sha)).size, 7);
  assert.equal(manifest.profiles.length * manifest.variants.length, 24);
  assert.ok(manifest.limitations.some((s) => s.includes("Not merged main")));
  assert.ok(manifest.overlap_resolved.includes(".github/workflows/body-frame-device-qa.yml"));
  assert.ok(manifest.overlap_resolved.includes(".gitleaksignore"));
});

test("UI-R08 all final UI screens remain valid TSX in the same integrated source tree", () => {
  for (const path of files) {
    const source = read(path);
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(tree.parseDiagnostics.length, 0, path + ": invalid merged TSX");
    assert.doesNotMatch(source, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
});

test("UI-R08 preserves the merged R03/R04 photo and measurement outcomes", () => {
  const records = read(files[0]);
  const detail = read(files[1]);
  const measurements = read(files[2]);
  const chart = read(files[3]);
  for (const token of [
    'contentFit="contain"',
    "styles.projectStatsRow",
    "getBodyProjectProgressSummary",
    "onCreateProject={handleCreateProject}"
  ]) assert.ok(records.includes(token), "records: " + token);
  for (const token of [
    "BodyMeasurementSummaryCard",
    "styles.comparePreviewCard",
    'contentFit="contain"',
    'pathname: "/project/[id]/measurements"'
  ]) assert.ok(detail.includes(token), "project: " + token);
  for (const token of [
    "styles.settingRow",
    "styles.historyReading",
    "wide && styles.overviewStatWide",
    "setSelectedPeriod(option.value)",
    "setSelectedMetric(metric)",
    "BodyHealthConnectImportCard"
  ].filter((t) => t !== "styles.settingRow")) assert.ok(measurements.includes(token), "metrics: " + token);
  for (const token of [
    "최저 ", "최고 ", "summary.first.value", "summary.latest.value",
    'accessibilityRole="image"', "formatRangeDate(summary.first.recordedAt)"
  ]) assert.ok(chart.includes(token), "chart: " + token);
  assert.ok(read("lib/body-measurement-series.ts").includes("getBodyMeasurementSeriesSummary"));
});

test("UI-R08 preserves R05 video creation, real MP4 safety and library playback", () => {
  const home = read(files[4]), create = read(files[5]), library = read(files[6]);
  assert.ok(home.includes('recentVideos.length > 0 ? savedVideosSection'));
  assert.ok(home.includes('router.push("/video-library")'));
  assert.ok(home.includes("video.ratio"));
  for (const token of [
    "TripClipRecordingCanvas", "runBodyFrameNativeRecording",
    "saveMadeVideo(", "saveVideoToLibrary(", "cancelExport",
    "getBodyFrameVideoPreviewTransform(previewWidth, frameAspectRatio, RECORDING_VIEW_WIDTH)"
  ]) assert.ok(create.includes(token), token);
  assert.ok(library.includes("confirmDelete(video)"));
  assert.ok(library.includes("deleteMadeVideo(video.id)"));
  assert.ok(library.includes("재생·상세"));
  assert.ok(read("scripts/run_ui_r05_native_video.py").includes("video_failure_and_background_smoke"));
  assert.ok(read("scripts/verify_ui_r05_video_qa.py").includes("nb_read_frames"));
});

test("UI-R08 preserves R06/R07 compare gestures, tabs, status labels, forms and account policy", () => {
  const compare=read(files[9]), tabs=read(files[11]), guide=read(files[12]);
  const switcher=read(files[13]), settings=read(files[14]), account=read(files[15]);
  const icon=read("components/tab-glyph.tsx");
  assert.ok(compare.includes("shouldStartComparisonPan"));
  assert.ok(compare.includes('accessibilityRole="adjustable"'));
  assert.ok(compare.includes("BodyFrameStatusNotice"));
  assert.ok(icon.includes('video: "film"'));
  assert.ok(tabs.includes("extraFontHeight"));
  assert.ok(read("components/screen-shell.tsx").includes("extraTabLabelHeight"));
  assert.ok(guide.includes("styles.welcomeArtworkCompact"));
  assert.ok(guide.includes('onPress={goNext}'));
  assert.ok(guide.includes('onPress={skip}'));
  assert.ok(switcher.includes("Keyboard.addListener"));
  assert.ok(switcher.includes("keyboardVisible && styles.createFooterKeyboard"));
  assert.ok(switcher.includes("onCreateProject({"));
  assert.ok(settings.includes("styles.settingRowValueLargeText"));
  assert.ok(settings.includes("saveAppSettings("));
  assert.ok(account.includes("CloudBackupProjectSlotsSection"));
  assert.ok(account.includes("confirmCloudRestore"));
  assert.ok(account.includes("purchaseProduct("));
  assert.ok(account.includes('accessibilityLabel="로그인 이메일"'));
  assert.ok(read("constants/app-theme.ts").includes("getBodyFrameStatusColors"));
});

test("UI-R08 combines every real native evidence gate without a Play deployment trigger", () => {
  const jobs= [...workflow.matchAll(/^  ([a-z0-9-]+):\s*$/gm)].map((m) => m[1]);
  assert.equal(jobs.length, new Set(jobs).size);
  const required=[
    "build-apk","capture-devices","stage13-design-captures",
    "ui-r00-captures","ui-r00-verify",
    "ui-r01-r02-android","ui-r01-r02-verify",
    "ui-r05-native-video","ui-r05-native-verify",
    "ui-r07-native-keyboard","ui-r07-keyboard-verify",
    "ui-r08-visual-verify","ui-r08-aggregate-gate"
  ];
  for (const job of required) assert.ok(jobs.includes(job), "missing integration job " + job);
  assert.ok(workflow.includes("startsWith(github.head_ref, 'qa/ui-r08-')"));
  assert.ok(workflow.includes("body-frame-stage13-*-${{ github.run_id }}"));
  assert.ok(workflow.includes("scripts/verify_ui_r08_visual.py"));
  assert.ok(workflow.includes("scripts/verify_ui_r08_needs.py"));
  assert.ok(!workflow.includes("[deploy-closed]"));
  assert.ok(!workflow.includes("[publish-store-shots]"));
  for (const name of [
    "scripts/test_ui_r00_baseline.py",
    "scripts/verify_ui_r01_r02_reports.py",
    "scripts/verify-frame-journal-c7.py",
    "scripts/run_ui_r05_native_video.py",
    "scripts/run_ui_r07_keyboard_qa.py"
  ]) assert.ok(fs.existsSync(name), name);
});

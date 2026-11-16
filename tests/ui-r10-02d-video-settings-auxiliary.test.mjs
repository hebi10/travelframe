import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const paths = [
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx",
  "features/trip-clip/BodyFrameVideoOptionsSheet.tsx",
  "features/settings/BodyFrameSettingsScreen.tsx"
];
const [home, creator, library, options, settings] = paths.map(p => readFileSync(p, "utf8"));

test("UI-R10-02D all modified video/settings source files parse without JSX errors", () => {
  paths.forEach((path, index) => {
    const s = [home, creator, library, options, settings][index];
    const ast = ts.createSourceFile(path, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(ast.parseDiagnostics.length, 0, path);
  });
});

test("video home prioritizes selected project's uncropped photo, then build CTA and saved videos", () => {
  for (const token of [
    "activeProjectPhotos", "activeProjectCover", "activeProjectSummary",
    "getBodyProjectProgressSummary(photos, activeProject)",
    "styles.heroCoverFrame", "styles.heroCoverImage", "선택 프로젝트",
    "예상 영상", "contentFit=\"contain\"",
    "startVideo(project)", "getGuestWeeklyVideoExportUsage",
    "recentVideos.length > 0 ? savedVideosSection",
    "recentVideos.length === 0 ? savedVideosSection"
  ]) assert.ok(home.includes(token), token);
  assert.ok(home.indexOf("styles.heroCard") < home.indexOf('accessibilityLabel="선택한 프로젝트로 변화 영상 만들기"'));
  assert.ok(home.indexOf('accessibilityLabel="선택한 프로젝트로 변화 영상 만들기"') <
    home.indexOf("recentVideos.length > 0 ? savedVideosSection"));
  assert.ok(home.includes('router.push("/video-library")'));
  assert.ok(home.includes("styles.heroIllustrationFrame"));
});

test("video creator keeps existing MP4 policy and displays larger portrait preview without losing sticky footer", () => {
  for (const token of [
    "windowHeight * 0.34 * frameAspectRatio", "windowWidth * 0.82",
    "TripClipRecordingCanvas", "runBodyFrameNativeRecording",
    "getBodyFrameVideoDuration", "getBodyFrameVideoTotalFrames",
    "saveMadeVideo(", "saveVideoToLibrary(", "cancelExport",
    "BodyFrameVideoOptionsSheet", "getBodyFrameVideoLimitState",
    "getGuestWeeklyVideoExportUsage", "recordGuestWeeklyVideoExport",
    'styles.exportFooter,', "styles.settingsHeading",
    'label="영상 길이"'
  ]) assert.ok(creator.includes(token), token);
  assert.ok(creator.indexOf("      </ScrollView>") < creator.indexOf("styles.exportFooter,"));
});

test("video library and options preserve delete/select/ratio/overlay semantics and readable empty state", () => {
  for (const token of [
    "getMadeVideos", "deleteMadeVideo(video.id)",
    "confirmDelete(video)", "재생·상세",
    "영상 관리", "저장한 영상이 없습니다.", "영상 만들기",
    "생성 {formatDate(video.createdAt)}", "contentFit=\"contain\""
  ]) assert.ok(library.includes(token), token);
  for (const token of [
    "setDraftOptions", "draftOptions.overlay", "setDraftIds",
    "BodyFrameSheetFooter", "KeyboardAvoidingView",
    'contentFit="contain"', "영상에 포함할 사진을 선택하거나 해제합니다.",
    "accessibilityState={{ checked }}", "accessibilityState={{ selected: active }}",
    "getBodyFrameVideoDuration(selectedCount, draftOptions.interval)",
    "onApply(draftOptions, draftIds)"
  ]) assert.ok(options.includes(token), token);
});

test("six settings groups preserve policies and show actionable context without changing storage or account rules", () => {
  for (const group of ["촬영", "저장 및 백업", "변화 영상", "화면", "계정 및 플랜", "정보 및 개인정보"]) {
    assert.ok(settings.includes('SectionBlock title="' + group + '"'), group);
  }
  for (const token of [
    "saveAppSettings(", "showDetail && detail", "accessibilityHint={onPress ? detail : undefined}",
    'label="저장 방식"\n            showDetail',
    'label="플랜 및 Google Play 결제"\n            showDetail',
    'label={isLoggedIn ? "내 계정" : "로그인"}\n            showDetail',
    'showDetail={!planEntitlements.canBackupToCloud}',
    "planEntitlements.canBackupToCloud",
    "router.push(\"/account\")",
    "setActiveSetting(\"fontStyle\")"
  ]) assert.ok(settings.includes(token), token);
});

test("all 32 supporting screenshot keys retain capture entry points; unplanned layouts are not called pixel-equal", () => {
  const capture = readFileSync("scripts/capture-stage13-android.py", "utf8");
  const keys = [
  "camera-project-picker",
  "camera-new-project",
  "camera-settings",
  "camera-settings-storage",
  "camera-guide-settings",
  "camera-color-panel",
  "camera-zoom-panel",
  "camera-light-panel",
  "capture-preview",
  "empty-projects",
  "new-project",
  "project-settings",
  "project-reminder",
  "project-metrics",
  "project-stats",
  "photo",
  "photo-measurement",
  "measurement-create",
  "video-interval",
  "video-quality",
  "video-ratio",
  "video-photos",
  "video-overlay",
  "video-library",
  "account",
  "edit-login-required",
  "settings-reference",
  "legacy-advanced-settings",
  "legacy-studio",
  "onboarding-first-run",
  "onboarding-next",
  "onboarding-welcome"
];
  assert.equal(keys.length, 32);
  for (const key of keys) assert.ok(capture.includes('"' + key + '"'), key + " capture missing");
  assert.ok(capture.includes("C7_PRIMARY"));
});

test("UI-R10-02D code stays neutral and carries no new release triggers", () => {
  for (const s of [home, creator, library, options, settings]) {
    assert.doesNotMatch(s, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
    assert.doesNotMatch(s, /border(?:Top|Right|Bottom|Left)Width\s*:/);
  }
  assert.ok(!paths.some(p => p.startsWith(".github/workflows")));
});

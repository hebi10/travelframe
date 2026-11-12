import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const paths = [
  "features/trip-clip/BodyFrameVideoHomeScreen.tsx",
  "features/trip-clip/BodyFrameVideoScreen.tsx",
  "features/trip-clip/BodyFrameVideoLibraryScreen.tsx"
];
const [home, creator, library] = paths.map(path => fs.readFileSync(path, "utf8"));
const workflow = fs.readFileSync(".github/workflows/body-frame-device-qa.yml", "utf8");
const native = fs.readFileSync("scripts/run_ui_r05_native_video.py", "utf8");
const audit = fs.readFileSync("scripts/verify_ui_r05_video_qa.py", "utf8");

test("UI-R05 renders valid TSX without new video APIs or styling", () => {
  for (let i = 0; i < paths.length; i += 1) {
    const source = [home, creator, library][i];
    const parsed = ts.createSourceFile(paths[i], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, paths[i] + " TSX parse failed");
    assert.doesNotMatch(source, /border(?:Top|Right|Bottom|Left)Width\s*:/);
    assert.doesNotMatch(source, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
});

test("UI-R05 shows previously saved video ahead of quota messaging without losing project navigation", () => {
  assert.ok(home.includes("const savedVideosSection = ("));
  assert.ok(home.indexOf("recentVideos.length > 0 ? savedVideosSection") < home.indexOf("styles.policyRow"));
  assert.ok(home.indexOf("recentVideos.length > 0 ? savedVideosSection") < home.indexOf('>프로젝트</Text>'));
  assert.ok(home.includes("recentVideos.length === 0 ? savedVideosSection"));
  for (const text of [
    'router.push("/video-library")',
    'router.push("/video-create")',
    "startVideo(project)",
    "video.coverUri",
    "video.duration",
    "video.ratio",
    "비로그인 사용자는 주 1회 출력",
    "getGuestWeeklyVideoExportUsage",
    "styles.savedHeadingCopy",
    "styles.videoPlayIndicator",
    "contentFit=\"contain\""
  ]) assert.ok(home.includes(text), text);
  assert.match(home, /videoCover:\s*\{[^}]*width:\s*72,[^}]*height:\s*92/);
});

test("UI-R05 exposes video ratio and options while preserving native recording and footer", () => {
  for (const key of [
    "TripClipRecordingCanvas",
    "getBodyFrameVideoPreviewTransform(previewWidth, frameAspectRatio, RECORDING_VIEW_WIDTH)",
    "windowHeight * 0.30 * frameAspectRatio",
    "styles.previewFrame",
    "styles.previewHeader",
    "styles.settingsHeading",
    "videoOptions.quality",
    "videoOptions.ratio",
    'accessibilityRole="image"',
    "saveMadeVideo(",
    "saveVideoToLibrary(",
    "runBodyFrameNativeRecording",
    "cancelExport",
    "styles.exportFooter,",
    'onPress={() => void createVideo()}',
    "BodyFrameVideoOptionsSheet",
    "getGuestWeeklyVideoExportUsage",
    "recordGuestWeeklyVideoExport"
  ]) assert.ok(creator.includes(key), key);
  for (const label of ["사진 수", "사진 간격", "영상 길이", "화질", "화면 비율", "텍스트"]) {
    assert.ok(creator.includes('label="' + label + '"'));
  }
  assert.ok(creator.indexOf("      </ScrollView>") < creator.indexOf("styles.exportFooter,"));
  assert.ok(creator.includes("styles.exportFeedback,") && creator.includes('accessibilityLiveRegion="polite"'));
});

test("UI-R05 library makes stored recording, time and playback/deletion controls legible", () => {
  for (const label of [
    "getMadeVideos",
    "deleteMadeVideo(video.id)",
    "confirmDelete(video)",
    "accessibilityState={{ disabled: deletingId === video.id }}",
    "영상 재생 및 상세 보기",
    "재생·상세",
    "생성 {formatDate(video.createdAt)}",
    "재생 {formatDuration(video.duration)} · {video.ratio}",
    "numberOfLines={2}",
    "styles.videoPlayIndicator",
    "contentFit=\"contain\""
  ]) assert.ok(library.includes(label), label);
  assert.match(library, /videoCover:\s*\{[^}]*width:\s*84,[^}]*height:\s*108/);
  assert.ok(library.includes('router.push("/video-create")'));
});

test("UI-R05 isolates actual native MP4, cancellation and verified Android screenshots", () => {
  for (const part of [
    "ui-r05-native-video:",
    "ui-r05-native-verify:",
    "ui-r05-visual-verify:",
    "startsWith(github.head_ref, 'ui/ui-r05-')",
    "scripts/run_ui_r05_native_video.py",
    "scripts/verify_ui_r05_video_qa.py",
    "body-frame-stage13-*-${{ github.run_id }}",
    "scripts/verify-frame-journal-c7.py",
    "body-frame-ui-r05-visual"
  ]) assert.ok(workflow.includes(part), part);
  for (const dp of ["phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp"]) {
    assert.ok(workflow.includes(dp));
  }
  assert.ok(native.includes('ro.kernel.qemu') && native.includes('device.seed(True, "medium", theme_mode="dark")'));
  assert.ok(native.includes("video_failure_and_background_smoke") && native.includes("video_smoke"));
  assert.ok(audit.includes("sha256") && audit.includes("nb_read_frames"));
  assert.ok(audit.includes("1080, 1440") && audit.includes("guestQuotaUnchanged"));
  assert.ok(audit.includes("NOT_TESTED") && audit.includes("ffprobe"));
  assert.doesNotMatch(workflow, /\[deploy-closed\]|\[publish-store-shots\]/);
});

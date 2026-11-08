import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const files = {
  video: "features/trip-clip/BodyFrameVideoScreen.tsx",
  project: "features/records/BodyFrameProjectDetailScreen.tsx",
  camera: "features/camera/BodyFrameCameraScreen.tsx",
  compare: "features/records/BodyFrameCompareScreen.tsx"
};

const source = Object.fromEntries(
  Object.entries(files).map(([name, path]) => [name, fs.readFileSync(path, "utf8")])
);

test("Stage B four Android screens parse and retain existing media controls", () => {
  for (const [name, path] of Object.entries(files)) {
    const parsed = ts.createSourceFile(path, source[name], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, name + " must parse");
    assert.doesNotMatch(source[name], /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
});

test("Stage B video reduces preview without changing aspect ratio or export path", () => {
  assert.ok(source.video.includes("windowHeight * 0.30 * frameAspectRatio"));
  assert.ok(source.video.includes("windowWidth * 0.82"));
  assert.ok(source.video.includes("aspectRatio: frameAspectRatio"));
  for (const token of [
    "TripClipRecordingCanvas",
    "saveMadeVideo(",
    "getBodyFrameVideoPreviewTransform",
    'label="사진 수"',
    'label="사진 간격"',
    'label="영상 길이"',
    'label="화질"',
    'label="화면 비율"',
    'label="텍스트"',
    "styles.exportFooter"
  ]) assert.ok(source.video.includes(token), token);
});

test("Stage B detail exposes records sooner without cropping or mutating photo order", () => {
  assert.ok(source.project.includes("height: 156,"));
  assert.ok(source.project.includes('contentFit="contain"'));
  assert.ok(source.project.includes("marginBottom: 8"));
  for (const token of [
    "styles.projectTabs", "styles.comparePreviewCard", "styles.photoGrid",
    "SortableProjectPhotoTile", "handleProjectPhotoDrop", "setPhotoOrderMode",
    "photoOrderSaving", "오늘 사진 찍기"
  ]) assert.ok(source.project.includes(token), token);
});

test("Stage B camera hint remains non-interactive and preserves camera project/session logic", () => {
  assert.ok(source.camera.includes("styles.captureHintPanel"));
  assert.ok(source.camera.includes('pointerEvents="none"'));
  assert.ok(source.camera.includes("marginTop: 4"));
  assert.ok(source.camera.includes("paddingVertical: 4"));
  for (const token of [
    "<CameraScreen", "<BodyFrameProjectSwitcher", "captureBlockedReason",
    "automaticReferenceUri", "getNextBodyProjectSequence",
    "getBodyFrameCaptureLimitState", "clearBodyFrameCameraSession"
  ]) assert.ok(source.camera.includes(token), token);
});

test("Stage B comparison keeps adjustable divider, 25/50/75 presets and accessible controls", () => {
  assert.ok(source.compare.includes("구분선을 좌우로 움직여 전후 사진을 비교하세요."));
  for (const token of [
    "PanResponder.create", 'accessibilityRole="adjustable"',
    "onAccessibilityAction", "[0.25, 0.5, 0.75]",
    "changeDivider(divider + 0.1)", "changeDivider(divider - 0.1)",
    "styles.dividerHandle", 'contentFit="cover"'
  ]) assert.ok(source.compare.includes(token), token);
});

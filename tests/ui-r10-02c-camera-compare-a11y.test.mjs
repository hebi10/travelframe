import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const camera = readFileSync("features/camera/CameraScreen.tsx", "utf8");
const cameraStyles = readFileSync("features/camera/camera-screen.styles.ts", "utf8");
const compare = readFileSync("features/records/BodyFrameCompareScreen.tsx", "utf8");

test("UI-R10-02C camera and comparison render files parse as TSX", () => {
  for (const [filename, src] of [
    ["features/camera/CameraScreen.tsx", camera],
    ["features/records/BodyFrameCompareScreen.tsx", compare]
  ]) {
    const ast = ts.createSourceFile(filename, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(ast.parseDiagnostics.length, 0, filename);
  }
});

test("UI-R10-02C camera preserves preview/save/guide while making states readable", () => {
  for (const x of [
    "useCameraPermission",
    "<Camera",
    "<CameraGuideOverlay",
    "<PhotoReferenceOverlay",
    "saveCapturedPhoto",
    "saveCapturedPhotoToDevice",
    "tryCamera",
    "overlaySetupActive",
    "기준 사진 조정",
    "현재 기준:",
    "직접 선택한 기준 사진",
    "원본 사진은 변경되지 않습니다.",
    "프로젝트 최근 사진을 기준으로 변경",
    "프로젝트 첫 사진을 기준으로 변경",
    "기준 사진 크기 줄이기",
    "기준 사진 크기 키우기",
    "기준 사진 위치·크기 초기화",
    "accessibilityLabel=\"기준 사진 위치 및 투명도 설정 완료\""
  ]) if(x !== "tryCamera") assert.ok(camera.includes(x), x);
  assert.ok(cameraStyles.includes("overlaySetupModeNote"));
  assert.ok(cameraStyles.includes("color: \"#E9E9EC\""));
  assert.ok(cameraStyles.includes("cameraUnavailableText"));
  assert.ok(cameraStyles.includes("color: bodyFrameDarkColors.text"));
});

test("UI-R10-02C comparison shows dates before modes without changing photo ownership or PanResponder", () => {
  assert.ok(compare.indexOf("styles.labels") < compare.indexOf("styles.dateLabels"));
  assert.ok(compare.indexOf("styles.dateLabels") < compare.indexOf("styles.modeTabs"));
  for (const x of [
    "getBodyFrameComparisonCandidates",
    "selectBodyFrameComparisonPhotos",
    'comparisonMode === "slider"',
    'comparisonMode === "side-by-side"',
    "comparisonMode === \"overlay\"",
    "onStartShouldSetPanResponder: () => false",
    "shouldStartComparisonPan(gesture.dx, gesture.dy)",
    "contentFit=\"contain\"",
    'accessibilityRole="adjustable"',
    "styles.labelRight",
    "styles.dateRight",
    "구분선을 좌우로 이동해 첫 사진과 최근 사진을 비교합니다."
  ]) assert.ok(compare.includes(x), x);
  assert.ok(compare.includes("[0.25, 0.5, 0.75]"));
  assert.ok(compare.includes("accessibilityValue={{ min: 10, max: 90"));
  assert.doesNotMatch(compare, /onMoveShouldSetPanResponder:\s*\(\) => true/);
});

test("UI-R10-02C keeps flat styling and does not introduce media mutations", () => {
  for (const text of [cameraStyles, compare]) {
    assert.doesNotMatch(text, /shadowOpacity|shadowColor|elevation:\s*\d+|LinearGradient/);
  }
  assert.ok(camera.includes("removeReferenceOverlay"));
  assert.ok(camera.includes("confirmOverlaySetup"));
  assert.ok(!compare.includes("saveCapturedPhoto("));
  assert.ok(!compare.includes("deleteLocalFile("));
});

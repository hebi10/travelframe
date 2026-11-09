import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const camera = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const styles = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");
const components = fs.readFileSync("features/camera/camera-screen.components.tsx", "utf8");
const model = fs.readFileSync("features/camera/camera-screen.model.ts", "utf8");
const guide = camera.slice(camera.indexOf("visible={guideSettingsOpen}"), camera.indexOf("{!isCameraModalOpen && !isGuidePositionAdjusting", camera.indexOf("visible={guideSettingsOpen}")));
const overlay = camera.slice(camera.indexOf("{overlaySetupActive && hasReferenceOverlay ? ("), camera.indexOf('style={styles.cameraControlDeck}', camera.indexOf("{overlaySetupActive && hasReferenceOverlay ? (")));

test("C4 native camera TSX, styles and shared slider parse", () => {
  for (const [path, content, kind] of [
    ["CameraScreen.tsx", camera, ts.ScriptKind.TSX],
    ["camera-screen.styles.ts", styles, ts.ScriptKind.TS],
    ["camera-screen.components.tsx", components, ts.ScriptKind.TSX]
  ]) {
    const ast = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind);
    assert.equal(ast.parseDiagnostics.length, 0, path + " should parse");
  }
});

test("C4 guide modal adopts dark sheet with scrollable content", () => {
  assert.ok(guide.includes("styles.guideModal"));
  assert.ok(guide.includes("styles.modalBackdrop"));
  assert.ok(guide.includes("BODY FRAME"));
  assert.ok(guide.includes("guideModalDescription"));
  assert.ok(guide.includes("showsVerticalScrollIndicator"));
  assert.ok(guide.includes("styles.guideSettingsScroll"));
  assert.ok(guide.includes("styles.guideSettingsContent"));
  assert.match(styles, /guideModal:\s*\{[^}]*maxHeight: bodyFrameSheetDesign\.maxHeight/);
  assert.ok(styles.includes('backgroundColor: "#101012"'));
  assert.ok(styles.includes('borderColor: bodyFrameDarkColors.line'));
  assert.ok(styles.includes("guideTypeGrid:"));
});

test("C4 preserves seven guide types and six selectable colors", () => {
  assert.ok(guide.includes("GUIDE_TYPES.map"));
  assert.ok(guide.includes("GUIDE_LABELS[type]"));
  assert.ok(guide.includes("guide === type && styles.optionButtonActive"));
  assert.ok(guide.includes('name="check" size={14}'));
  assert.ok(guide.includes("GUIDE_COLOR_OPTIONS.map"));
  assert.ok(guide.includes("accessibilityLabel={`가이드 색상 ${label}`}"));
  assert.ok(guide.includes("guideColor === swatchColor"));
  assert.ok(styles.includes('colorRow: {\n    flexDirection: "row",\n    flexWrap: "wrap"'));
  assert.ok(styles.includes('flexBasis: "30%"'));
  for (const color of ["흰색", "노랑", "민트", "파랑", "빨강", "검정"]) assert.ok(model.includes(color));
});

test("C4 guide size, position, grid and visibility callbacks stay connected", () => {
  assert.ok(guide.includes("GUIDE_SIZE_OPTIONS.map"));
  assert.ok(guide.includes("GUIDE_STROKE_WIDTH_OPTIONS.map"));
  assert.ok(guide.includes("<GuideSizeSlider"));
  assert.match(guide, /compact\s+dark\s+value=\{guideSize\}/);
  assert.ok(guide.includes("min={guideSizeBounds.min}"));
  assert.ok(guide.includes("max={guideSizeBounds.max}"));
  assert.ok(guide.includes('accessibilityLabel="가이드 크기 직접 입력"'));
  assert.ok(guide.includes("commitGuideSizeInput"));
  assert.ok(components.includes("dark?: boolean"));
  assert.ok(components.includes("dark={dark}"));
  for (const key of [
    "startGuidePositionAdjustment", "startGridLineControl",
    "updateGuideStrokeWidth(strokeWidth)", "updateGuideVisibility(!guideVisible)",
    "updateGuideType(type)", "updateGuideColor(swatchColor)"
  ]) assert.ok(guide.includes(key), key);
});

test("C4 reference overlay keeps opacity, scale, reset, confirm and non-destructive hiding", () => {
  for (const token of [
    "styles.overlaySetupPanel", "styles.overlaySetupHeaderCopy",
    "사진 가이드", "원본 사진은 유지됩니다.",
    "OVERLAY_OPACITY_MIN", "OVERLAY_OPACITY_MAX",
    "applyOverlayOpacityPercent", "commitOverlayOpacityPercent",
    "referenceOverlayRef.current?.scaleBy(-0.1)",
    "referenceOverlayRef.current?.scaleBy(0.1)",
    "resetOverlay", "confirmOverlaySetup", "removeReferenceOverlay",
    "toggleProjectReference()",
    'accessibilityLabel="가이드 이미지만 제거, 원본 사진 유지"',
    'numberOfLines={2}'
  ]) assert.ok(overlay.includes(token), token);
  assert.ok(styles.includes("overlaySetupActions: {\n    flexDirection: \"row\",\n    flexWrap: \"wrap\""));
  assert.ok(styles.includes("overlaySetupHeaderCopy:"));
  assert.ok(camera.includes("queueAppSettingsUpdate({ referencePhotoVisible: false })"));
  assert.ok(camera.includes("queueAppSettingsUpdate({ referencePhotoVisible: true })"));
  assert.ok(!/deleteCapturedPhoto\(|deleteLocalFile\(/.test(overlay), "reference removal must never delete the original photo");
});

test("C4 keeps flat styling and 44dp minimum controls", () => {
  assert.ok(styles.includes("minHeight: bodyFrameDesign.minTouchSize"));
  assert.ok(styles.includes("minWidth: 70"));
  assert.ok(styles.includes('flexWrap: "wrap"'));
  assert.doesNotMatch(styles, /border(?:Top|Bottom|Left|Right)Width\s*:/);
  assert.doesNotMatch(styles, /shadowOpacity|shadowColor|elevation:|LinearGradient/);
});

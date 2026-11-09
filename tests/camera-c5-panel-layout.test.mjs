import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const styles = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");
const capture = fs.readFileSync("scripts/capture-stage13-android.py", "utf8");

const colorStart = source.indexOf('      {activeCameraControlPanel === "color" &&');
const colorEnd = source.indexOf("visible={cameraSettingsOpen}", colorStart);
const zoomStart = source.indexOf('              {activeCameraControlPanel === "zoom" ? (', colorEnd);
const lightStart = source.indexOf('              {activeCameraControlPanel === "light" ? (', zoomStart);
const trayStart = source.indexOf("styles.cameraControlBottomTray", lightStart);

assert.ok(colorStart >= 0 && colorEnd > colorStart && zoomStart > colorEnd);
assert.ok(lightStart > zoomStart && trayStart > lightStart);

const color = source.slice(colorStart, colorEnd);
const zoom = source.slice(zoomStart, lightStart);
const light = source.slice(lightStart, trayStart);

test("C5 camera and styles parse as TypeScript and TSX", () => {
  const cameraAst = ts.createSourceFile("CameraScreen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stylesAst = ts.createSourceFile("camera-screen.styles.ts", styles, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(cameraAst.parseDiagnostics.length, 0);
  assert.equal(stylesAst.parseDiagnostics.length, 0);
});

test("C5 fixes C0 compact color panel: header and footer remain outside scroll", () => {
  const markers = [
    "<View style={styles.cameraColorPanel}>",
    "<View style={styles.cameraColorHeaderRow}>",
    "<ScrollView",
    "<View style={styles.cameraColorPresetSection}>",
    "<View style={styles.cameraColorSliderList}>",
    "</ScrollView>",
    "<View style={styles.cameraColorActions}>"
  ];
  let pos = -1;
  for (const marker of markers) {
    const next = color.indexOf(marker);
    assert.ok(next > pos, marker + " should appear after previous section");
    pos = next;
  }
  assert.ok(color.includes("showsVerticalScrollIndicator"));
  assert.ok(color.includes("nestedScrollEnabled"));
  assert.ok(color.includes("style={styles.cameraColorPrimaryButton}"));
  assert.ok(color.includes("onPress={saveCameraColorSettings}"));
  assert.ok(color.includes("onPress={resetCameraColorSettings}"));
  assert.ok(color.includes('accessibilityLabel="선택한 색감 슬롯에 현재 설정 저장"'));
  assert.ok(color.includes('accessibilityLabel="색감 조절값 초기화"'));

  assert.match(styles, /cameraColorFloatingScroll:\s*\{\s*flex: 1,\s*minHeight: 0/);
  assert.match(styles, /cameraColorPanel:\s*\{[^}]*flex: 1,[^}]*minHeight: 0/);
  assert.match(styles, /cameraColorActions:\s*\{[^}]*minHeight: bodyFrameDesign\.minTouchSize/);
});

test("C5 preserves five persistent color slots and all six editing sliders", () => {
  assert.ok(color.includes("cameraColorSlots.map((slot, index)"));
  assert.ok(color.includes("applyCameraColorSlot(slot, index)"));
  for (const field of [
    "cameraExposureBias", "cameraColorTemperature", "cameraColorTint",
    "cameraBrightness", "cameraContrast", "cameraSaturation"
  ]) assert.ok(color.includes("value={" + field + "}"), field);
  assert.equal((color.match(/<SmoothValueSlider\b/g) ?? []).length, 6);
  for (const callback of [
    "applyCameraExposureBias", "applyCameraColorTemperature", "applyCameraColorTint",
    "applyCameraBrightness", "applyCameraContrast", "applyCameraSaturation"
  ]) assert.ok(color.includes(callback), callback);
  for (const title of ["노출", "온도", "틴트", "밝기", "대비", "채도"]) {
    assert.ok(color.includes('label="' + title + '"'), title);
  }
  assert.ok(color.includes("styles.cameraColorCloseButton"));
});

test("C5 zoom panel retains real device-based presets and marks active magnification", () => {
  for (const token of [
    "styles.cameraQuickPanel", "styles.cameraQuickPanelHeader", "styles.cameraZoomPresetRow",
    "cameraZoomPresets.map", "getCameraZoomPresetFactor(preset, cameraDevice)",
    "setZoomPreset(preset)", "cameraZoomFactor.toFixed(1)", "Math.abs(cameraZoomFactor - presetFactor)",
    "accessibilityState={{ selected: isActive }}"
  ]) assert.ok(zoom.includes(token), token);
  assert.ok(zoom.includes('accessibilityLabel={`확대 ${preset.label}`}'));
});

test("C5 torch uses actual camera capability and visible selected state", () => {
  for (const token of [
    "styles.cameraQuickPanel", "styles.cameraQuickPanelHeader",
    "cameraLightAvailable", "visibleTorchEnabled", "후면 카메라에서 사용 가능",
    "onPress={() => setLightEnabled(false)}", "onPress={() => setLightEnabled(true)}",
    'accessibilityLabel="손전등 끄기"', 'accessibilityLabel="손전등 켜기"',
    "accessibilityState={{ disabled: !cameraLightAvailable, selected: !visibleTorchEnabled }}",
    "accessibilityState={{ disabled: !cameraLightAvailable, selected: visibleTorchEnabled }}"
  ]) assert.ok(light.includes(token), token);
  assert.equal((light.match(/disabled=\{!cameraLightAvailable\}/g) ?? []).length, 2);
});

test("C5 uses monochrome responsive controls and adds device screenshot coverage", () => {
  for (const token of [
    "cameraQuickPanel:", "cameraQuickPanelHeader:", "cameraZoomPresetRow:",
    "quickButtonRow:", 'flexWrap: "wrap"', "minWidth: 48",
    "minHeight: bodyFrameDesign.minTouchSize"
  ]) assert.ok(styles.includes(token), token);
  assert.doesNotMatch(styles, /shadowOpacity|shadowColor|elevation:|LinearGradient/);
  for (const item of ["camera-color-panel", "camera-zoom-panel", "camera-light-panel", "qa.target_bounds(", "camera-color-panel\", \"camera-zoom-panel"]) {
    assert.ok(capture.includes(item), item);
  }
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const styles = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");
const model = fs.readFileSync("features/camera/camera-screen.model.ts", "utf8");

const settingsStart = source.indexOf('visible={cameraSettingsOpen}');
const settingsEnd = source.indexOf('visible={guideSettingsOpen}', settingsStart);
const sheet = source.slice(settingsStart, settingsEnd);

test("C3 camera settings remains valid native TSX", () => {
  const parsed = ts.createSourceFile("CameraScreen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0);
  const parsedStyles = ts.createSourceFile("camera-screen.styles.ts", styles, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(parsedStyles.parseDiagnostics.length, 0);
  assert.ok(sheet.includes('accessibilityViewIsModal'));
  assert.ok(sheet.includes("styles.cameraSettingsScrollShell"));
  assert.ok(sheet.includes("styles.cameraSettingsScroll"));
  assert.ok(styles.includes('maxHeight: bodyFrameSheetDesign.maxHeight'));
});

test("C3 groups camera tools, shooting options, quality, storage and support in order", () => {
  const headings = ["촬영 도구", "촬영 옵션", "품질 및 화면", "저장 위치", "촬영 보조"];
  let cursor = -1;
  for (const title of headings) {
    const next = sheet.indexOf(">" + title + "</Text>");
    assert.ok(next > cursor, title + " is missing or out of order");
    cursor = next;
  }
  assert.ok(sheet.includes("cameraSettingsGroup"));
  assert.ok(sheet.includes("FRAME JOURNAL"));
  assert.ok(sheet.includes('cameraSettingsTitle}>촬영 설정</Text>'));
});

test("C3 tools expose five existing workflows without duplicate front/back switch tile", () => {
  const start = sheet.indexOf('style={styles.cameraToolGrid}');
  const end = sheet.indexOf('style={styles.cameraSettingsDivider}', start);
  assert.ok(start >= 0 && end > start);
  const grid = sheet.slice(start, end);
  for (const name of ["라인 가이드 설정 열기", "사진 설정 열기", "색감 설정 열기", "확대 설정 열기", "라이트 설정 열기"]) {
    assert.ok(grid.includes(name), name);
  }
  assert.equal((grid.match(/accessibilityRole="button"/g) ?? []).length, 5);
  assert.ok(!grid.includes("onPress={toggleCameraFacing}"));
  assert.ok(sheet.includes("CAMERA_FACING_OPTIONS.map"));
  assert.ok(sheet.includes("changeCameraFacing(option.value)"));
  assert.ok(source.includes("toggleCameraFacing"));
});

test("C3 photo quality and aspect ratio remain functional with wrapped six-ratio layout", () => {
  assert.ok(sheet.includes("CAMERA_QUALITY_OPTIONS.map"));
  assert.ok(sheet.includes("setPhotoQuality(option.value)"));
  assert.ok(sheet.includes("CAMERA_RATIO_OPTIONS.map"));
  assert.ok(sheet.includes("updateCameraRatio(option.value)"));
  assert.ok(sheet.includes("styles.cameraSettingsRatioRow"));
  assert.ok(sheet.includes("styles.cameraSettingsRatioOption"));
  assert.ok(styles.includes('flexWrap: "wrap"'));
  for (const ratio of ["1:1", "3:4", "4:3", "4:5", "9:16", "16:9"]) {
    assert.ok(model.includes('"' + ratio + '"'), ratio);
  }
});

test("C3 storage exposes purpose and checkbox state without changing save target logic", () => {
  assert.ok(sheet.includes("CAMERA_SAVE_SCOPE_OPTIONS.map"));
  assert.ok(sheet.includes("getCameraSaveScopeTargets(cameraSaveScope)[option.value]"));
  assert.ok(sheet.includes("toggleCameraSaveTarget(option.value)"));
  assert.ok(sheet.includes('accessibilityRole="checkbox"'));
  assert.ok(sheet.includes("checked: isSelected"));
  assert.ok(sheet.includes("disabled={isCloudSaveTargetDisabled}"));
  assert.ok(sheet.includes("option.detail"));
  assert.ok(sheet.includes("클라우드는 로그인 및 백업 설정이 가능한 경우에만 사용됩니다."));
  for (const label of ["앱 보관함", "핸드폰 앨범", "클라우드"]) {
    assert.ok(model.includes(label));
  }
});

test("C3 avoids bright default selected states and keeps the shutter/guide controls", () => {
  assert.ok(styles.includes("cameraSettingsSaveOption:"));
  assert.ok(styles.includes("cameraSettingsSaveCopy:"));
  assert.ok(styles.includes("cameraSettingsRatioRow:"));
  assert.ok(styles.includes("cameraSettingsOptionButtonActive:"));
  assert.ok(styles.includes("borderColor: bodyFrameDarkColors.text"));
  assert.ok(!styles.includes("bodyFrameAccent"));
  assert.ok(!/shadowOpacity|shadowColor|elevation:|LinearGradient/.test(styles));
  for (const token of [
    "CAMERA_TIMER_OPTIONS.map", "setShutterTimer(option.value)",
    "CAMERA_FLASH_OPTIONS.map", "setFlashMode(option.value)",
    'title="손전등"', "setLightEnabled(!torchEnabled)",
    "<CameraShutterSoundChoice", 'title="가이드 표시"',
    'title="햅틱 피드백"'
  ]) assert.ok(sheet.includes(token), token);
});

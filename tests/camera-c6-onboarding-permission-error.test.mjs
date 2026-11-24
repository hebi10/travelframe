import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const guide = fs.readFileSync("components/app-guide-overlay.tsx", "utf8");
const camera = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const styles = fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8");
const capture = fs.readFileSync("scripts/capture-stage13-android.py", "utf8");

test("C6 onboarding and camera screen parse without TSX errors", () => {
  for (const [file, source, kind] of [
    ["components/app-guide-overlay.tsx", guide, ts.ScriptKind.TSX],
    ["features/camera/CameraScreen.tsx", camera, ts.ScriptKind.TSX],
    ["features/camera/camera-screen.styles.ts", styles, ts.ScriptKind.TS]
  ]) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    assert.equal(ast.parseDiagnostics.length, 0, file);
  }
});

test("C6 first-run actions, replay navigation and close stay outside the scrolling content", () => {
  const ast = ts.createSourceFile("components/app-guide-overlay.tsx", guide, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const pinnedControls = new Map();
  function attributeValue(opening, name) {
    const attribute = opening.attributes.properties.find((entry) => ts.isJsxAttribute(entry) && entry.name.getText(ast) === name);
    const value = attribute?.initializer;
    return value && ts.isJsxExpression(value) ? value.expression : value;
  }
  function visit(node) {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const tag = opening.tagName.getText(ast);
      const isWelcomeFooter = tag === "View" && opening.attributes.getText(ast).includes("styles.welcomeActions");
      const closeLabel = attributeValue(opening, "accessibilityLabel");
      const isReplayClose = tag === "Pressable" && closeLabel && ts.isStringLiteral(closeLabel) && closeLabel.text === "닫기";
      if (isWelcomeFooter || tag === "AppGuideNavigation" || isReplayClose) {
        const label = isWelcomeFooter ? "welcome footer" : isReplayClose ? "replay close" : "replay navigation";
        pinnedControls.set(label, node);
        for (let parent = node.parent; parent; parent = parent.parent) {
          assert.equal(
            ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === "ScrollView",
            false,
            `${label} must live outside ScrollView`
          );
        }
        if (isReplayClose) {
          const handler = attributeValue(opening, "onPress");
          assert.ok(handler && ts.isIdentifier(handler) && handler.text === "skip", "replay close must call the shared skip handler");
          const hint = attributeValue(opening, "accessibilityHint");
          assert.ok(hint && ts.isStringLiteral(hint) && hint.text === "사용 가이드를 닫습니다.", "replay close must explain its action accessibly");
        }
        if (tag === "AppGuideNavigation") {
          for (const [prop, expected] of [["onNext", "goNext"], ["onBack", "goBack"]]) {
            const handler = attributeValue(opening, prop);
            assert.ok(handler && ts.isIdentifier(handler) && handler.text === expected, `replayed guide must retain ${prop}={${expected}}`);
          }
          assert.equal(attributeValue(opening, "onSkip"), undefined, "replay close belongs in the fixed header, not the navigation footer");
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(pinnedControls.has("welcome footer"), "first-run actions must remain pinned");
  assert.ok(pinnedControls.has("replay navigation"), "replayed guide actions must remain pinned");
  assert.ok(pinnedControls.has("replay close"), "replayed guide must retain an accessible fixed close control");
  for (const label of [
    "기록 시작 순서",
    "프로젝트 만들기",
    "첫 사진 촬영하기",
    "같은 구도로 변화 기록하기",
    "시작하기",
    "나중에 보기",
    "styles.welcomeSummary",
    "styles.welcomeArtwork"
  ]) assert.ok(guide.includes(label), label);
  assert.ok(guide.includes("onPress={goNext}"));
  assert.ok(guide.includes("onPress={skip}"));
  assert.ok(guide.includes("step.id === \"body-frame-welcome\" && replaySignal === 0"));
  assert.ok(guide.includes("<AppGuideCard"), "replayed guide must retain its step content");
});

test("C6 camera permission is explicit, theme-aware and keeps a fixed recovery footer", () => {
  const first = camera.indexOf("  if (!hasCameraPermission) {");
  const last = camera.indexOf("  return (\n    <View style={styles.screen}>", first);
  assert.ok(first > 0 && last > first);
  const permission = camera.slice(first, last);
  const scrollEnd = permission.indexOf("        </ScrollView>");
  const actionStart = permission.indexOf("styles.permissionActions");
  assert.ok(scrollEnd > 0 && actionStart > scrollEnd, "camera permission actions must not scroll away");
  for (const marker of [
    "useAppAppearance()",
    "canRequestCameraPermission ? requestCameraPermission : openPermissionSettings",
    "카메라 접근 권한이 필요합니다.",
    "카메라 권한 허용",
    "앱 설정에서 권한 허용",
    "기록으로 이동",
    "styles.permissionDetail",
    "palette.background",
    "Math.max(insets.bottom + 12, 16)"
  ]) assert.ok(camera.includes(marker), marker);
  assert.ok(permission.includes("onPress={returnFromPermissionScreen}"));
  assert.ok(camera.includes('router.replace("/studio")'));
  assert.equal(camera.includes("await requestCameraPermission();"), false);
  assert.equal(camera.includes("requestCameraPermissionOnFocus"), false);
  for (const style of [
    "permissionScroll:", "permissionContent:", "permissionPanel:",
    "permissionDetail:", "permissionActions:", "permissionButton:"
  ]) assert.ok(styles.includes(style), style);
});

test("C6 gives camera and album errors safe actions without changing save fallbacks", () => {
  const start = camera.indexOf("          {errorMessage ? (");
  const end = camera.indexOf("          {overlaySetupActive && hasReferenceOverlay ? (", start);
  assert.ok(start > 0 && end > start);
  const notice = camera.slice(start, end);
  for (const action of [
    "styles.cameraErrorNotice",
    'accessibilityLiveRegion="polite"',
    "errorMessage",
    "cameraConnectionError",
    "albumPermissionError",
    "onPress={retryCameraConnection}",
    "onPress={openPermissionSettings}",
    "onPress={() => setErrorMessage(null)}",
    "다시 연결",
    "권한 설정",
    "닫기"
  ]) assert.ok(notice.includes(action), action);
  assert.ok(camera.includes("setCameraRecoveryPending(false);"));
  assert.ok(camera.includes("setCameraSessionRestartKey((value) => value + 1);"));
  assert.ok(camera.includes("showDeviceAlbumPermissionPrompt(message);"));
  assert.ok(camera.includes("createAppOnlySaveFallback()"));
  assert.ok(camera.includes("await requestPhotoSavePermission();"));
  for (const marker of ["cameraErrorHeading:", "cameraErrorActions:", "cameraErrorAction:", "cameraErrorDismiss:"]) {
    assert.ok(styles.includes(marker), marker);
  }
});

test("C6 Android visual QA includes actual permission denial with guaranteed permission restoration", () => {
  for (const marker of [
    "def capture_camera_permission_denied(",
    '"pm", "revoke", qa.PACKAGE, "android.permission.CAMERA"',
    '"pm", "grant", qa.PACKAGE, "android.permission.CAMERA"',
    "qa.target_bounds(xml, primary, viewport=device.viewport())",
    'qa.target_bounds(xml, "기록으로 이동", viewport=device.viewport())',
    '"camera-permission-denied"',
    'variant in ("dark-100", "light-150")'
  ]) assert.ok(capture.includes(marker), marker);
});

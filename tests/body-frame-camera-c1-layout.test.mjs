import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const sources = {
  wrapper: fs.readFileSync("features/camera/BodyFrameCameraScreen.tsx", "utf8"),
  camera: fs.readFileSync("features/camera/CameraScreen.tsx", "utf8"),
  styles: fs.readFileSync("features/camera/camera-screen.styles.ts", "utf8"),
  switcher: fs.readFileSync("features/camera/BodyFrameProjectSwitcher.tsx", "utf8")
};

test("C1 camera UI files parse without JSX errors", () => {
  for (const [name, source] of Object.entries(sources)) {
    const path = name === "styles"
      ? "features/camera/camera-screen.styles.ts"
      : "features/camera/" + ({wrapper:"BodyFrameCameraScreen.tsx",camera:"CameraScreen.tsx",switcher:"BodyFrameProjectSwitcher.tsx"}[name]);
    const kind = name === "styles" ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
    assert.equal(parsed.parseDiagnostics.length, 0, name + " must parse");
  }
});

test("C1 moves project hint, save feedback and actionable prompts into shutter tray", () => {
  assert.ok(sources.wrapper.includes("footerStatus={"));
  assert.ok(sources.wrapper.includes("styles.captureStatusRow"));
  assert.ok(sources.wrapper.includes('accessibilityLiveRegion="polite"'));
  assert.ok(sources.wrapper.includes("measurementPromptPhotoId"));
  assert.ok(sources.wrapper.includes("플랜 보기 · {upgradePlanLabel}"));
  assert.ok(!sources.wrapper.includes("cameraHeaderBottom"));
  assert.ok(!sources.wrapper.includes("styles.captureHintWrap"));
  assert.ok(!sources.wrapper.includes("styles.snackbar"));
  assert.ok(sources.camera.includes("footerStatus?: ReactNode;"));
  assert.ok(sources.camera.includes("footerStatus && activeCameraControlPanel === null"));
  assert.ok(sources.camera.includes("<View style={styles.cameraCaptureStatus}>{footerStatus}</View>"));
  assert.ok(sources.camera.indexOf("styles.cameraCaptureStatus") < sources.camera.indexOf("styles.captureRow", sources.camera.indexOf("styles.cameraControlBottomTray")));
});

test("C1 preserves project switcher and the existing photo/overlay/save behavior", () => {
  for (const token of [
    "setBodyFrameCameraSession(", "clearBodyFrameCameraSession(",
    "getBodyFrameCaptureLimitState", "selectBodyProjectReferencePhoto",
    "getNextBodyProjectSequence", "onProjectReferenceModeChange",
    "onSelectProject={handleSelectProject}", "onCreateProject={handleCreateProject}"
  ]) assert.ok(sources.wrapper.includes(token), token);
  for (const token of [
    "capturePhotoToFile(", "queueCapturedPhotoSave(", "reserveBodyFrameCameraCapture(",
    "PhotoReferenceOverlay", "CameraGuideOverlay", "overlaySetupActive",
    "handleCameraBottomTrayLayout", "cameraControlsHeight + CAMERA_PREVIEW_CONTROL_GAP",
    'accessibilityLabel="사진 촬영"', "onPress={takePhoto}",
    "openPersonalGallery", "reopenOverlaySetup"
  ]) assert.ok(sources.camera.includes(token), token);
});

test("C1 makes header and shutter controls compact without decreasing tap reach", () => {
  assert.ok(sources.switcher.includes("headerButtonCompact:"));
  assert.ok(sources.switcher.includes("minHeight: 48,"));
  assert.ok(sources.switcher.includes('textAlign: "center"'));
  assert.ok(sources.styles.includes("cameraCaptureStatus:"));
  assert.ok(sources.styles.includes("minHeight: 68,"));
  assert.ok(sources.styles.includes("width: 68,"));
  assert.ok(sources.styles.includes("height: 68,"));
  assert.ok(sources.wrapper.includes("minHeight: bodyFrameDesign.minTouchSize"));
  assert.ok(sources.styles.includes("cameraControlsHeight") === false);
});

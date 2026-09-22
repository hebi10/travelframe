import assert from "node:assert/strict";
import fs from "node:fs";

const bodyCamera = fs.readFileSync(
  "features/camera/BodyFrameCameraScreen.tsx",
  "utf8"
);
const camera = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const components = fs.readFileSync(
  "features/camera/camera-screen.components.tsx",
  "utf8"
);
const styles = fs.readFileSync(
  "features/camera/camera-screen.styles.ts",
  "utf8"
);

const saveEffectStart = bodyCamera.indexOf(
  "session.lastSavedAt <= 0"
);
const saveEffectEnd = bodyCamera.indexOf(
  "const handleSelectProject",
  saveEffectStart
);
const saveEffect = bodyCamera.slice(saveEffectStart, saveEffectEnd);

assert.ok(
  bodyCamera.includes('setSaveMessage(`${session.lastSavedSequence}번째 사진을 저장했습니다.`);'),
  "camera should show the saved photo sequence message"
);
assert.ok(
  bodyCamera.includes("}, 4200);") &&
    bodyCamera.includes("}, [saveMessage]);"),
  "save message should disappear on its own after about 4.2 seconds"
);
assert.ok(
  !saveEffect.includes("return () => clearTimeout(timeout);"),
  "project/session refreshes must not cancel the save-message timer"
);

for (const token of [
  "cameraColorTitleRow",
  "cameraColorPresetSection",
  "cameraColorPresetHeader",
  "cameraColorSliderList",
  "cameraColorSecondaryButton",
  "cameraColorPrimaryButton",
  'name="sliders"',
  'name="refresh-ccw"',
  'name="save"',
  "저장 슬롯",
  "탭하여 적용"
]) {
  assert.ok(camera.includes(token), `dark color panel markup missing: ${token}`);
}

assert.ok(
  camera.match(/<SmoothValueSlider[\s\S]*?compact[\s\S]*?dark/g)?.length >= 6,
  "all six camera color sliders should use the dark variant"
);

assert.ok(
  components.includes("dark?: boolean") &&
    components.includes("cameraColorSliderLabel") &&
    components.includes("cameraColorTrackBase") &&
    components.includes("cameraColorThumb"),
  "shared slider should expose isolated dark styling for the color panel"
);

for (const token of [
  'backgroundColor: "#101012"',
  'backgroundColor: "#151517"',
  'backgroundColor: "#18181B"',
  'backgroundColor: "#F5F5F5"',
  "cameraColorSliderArea:",
  "cameraColorCompactSliderRow:",
  "cameraColorSliderLabel:",
  "cameraColorSliderValue:",
  "cameraColorTrackBase:",
  "cameraColorTrackFill:",
  "cameraColorThumb:"
]) {
  assert.ok(styles.includes(token), `dark color panel style missing: ${token}`);
}

console.log("ok - save message auto-dismisses and camera color panel matches dark UI");

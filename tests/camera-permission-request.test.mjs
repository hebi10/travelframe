import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");

for (const snippet of [
  "useCameraPermission()",
  "hasCameraPermission",
  "canRequestCameraPermission",
  "requestCameraPermission"
]) {
  assert.ok(cameraSource.includes(snippet), `camera permission flow missing: ${snippet}`);
}

assert.equal(
  cameraSource.includes("requestCameraPermissionOnFocus"),
  false,
  "camera permission should not be requested automatically on first focus"
);
assert.equal(
  cameraSource.includes("await requestCameraPermission();"),
  false,
  "camera permission should only be requested from the explicit permission button"
);
assert.ok(
  cameraSource.includes("onPress={canRequestCameraPermission ? requestCameraPermission : openPermissionSettings}"),
  "camera permission screen should keep an explicit permission request button"
);

assert.ok(
  cameraSource.includes('router.replace("/studio")'),
  "camera permission fallback should send users to a usable non-camera screen"
);
assert.equal(
  cameraSource.includes('router.replace("/")'),
  false,
  "camera permission fallback should not route back to the root camera redirect"
);

console.log("ok - camera tab waits for explicit permission request");

import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

for (const snippet of [
  "useCameraPermission()",
  "hasCameraPermission",
  "canRequestCameraPermission",
  "requestCameraPermission",
  "if (!hasCameraPermission && canRequestCameraPermission)",
  "await requestCameraPermission();"
]) {
  assert.ok(cameraSource.includes(snippet), `camera permission auto request missing: ${snippet}`);
}

assert.ok(
  cameraSource.includes('router.replace("/studio")'),
  "camera permission fallback should send users to a usable non-camera screen"
);
assert.equal(
  cameraSource.includes('router.replace("/")'),
  false,
  "camera permission fallback should not route back to the root camera redirect"
);

console.log("ok - camera tab requests permission on first focus");

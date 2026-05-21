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

console.log("ok - camera tab requests permission on first focus");

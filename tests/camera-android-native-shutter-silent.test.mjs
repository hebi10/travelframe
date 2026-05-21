import assert from "node:assert/strict";
import fs from "node:fs";

const cameraSource = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.ok(
  packageJson.dependencies["react-native-vision-camera"],
  "camera capture should use VisionCamera instead of an expo-camera patch"
);

assert.ok(
  cameraSource.includes("photoOutput.capturePhotoToFile"),
  "camera should capture through VisionCamera photo output"
);

assert.ok(
  cameraSource.includes("enableShutterSound: false"),
  "VisionCamera capture should explicitly request silent Android native capture"
);

assert.ok(
  !cameraSource.includes("shutterSound: false"),
  "expo-camera takePictureAsync shutter option should not remain after migration"
);

console.log("ok - Android VisionCamera capture disables native shutter sound");

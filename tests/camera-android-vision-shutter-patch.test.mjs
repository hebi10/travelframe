import assert from "node:assert/strict";
import fs from "node:fs";

const patchScript = fs.readFileSync("scripts/apply-patches.mjs", "utf8");
const nativeSource = fs.readFileSync(
  "node_modules/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/outputs/HybridPhotoOutput.kt",
  "utf8"
);

assert.ok(
  patchScript.includes("patchVisionCameraAndroidShutterSound"),
  "postinstall patch should cover VisionCamera Android shutter sound"
);

assert.ok(
  nativeSource.includes("val enableShutterSound = settings.enableShutterSound ?: true"),
  "VisionCamera Android should honor the JS shutter sound setting directly"
);

assert.equal(
  nativeSource.includes("CameraInfo.mustPlayShutterSound()"),
  false,
  "VisionCamera Android should not force app-level shutter playback in silent mode"
);

console.log("ok - VisionCamera Android shutter sound patch honors silent mode");

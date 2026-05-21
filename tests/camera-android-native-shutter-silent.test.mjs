import assert from "node:assert/strict";
import fs from "node:fs";

const nativeSource = fs.readFileSync(
  "node_modules/expo-camera/android/src/main/java/expo/modules/camera/ExpoCameraView.kt",
  "utf8"
);
const patchScript = fs.readFileSync("scripts/apply-patches.mjs", "utf8");
const patchFile = fs.readFileSync("patches/expo-camera+55.0.0.patch", "utf8");

assert.ok(
  !nativeSource.includes("MediaActionSound().play(MediaActionSound.SHUTTER_CLICK)"),
  "Android expo-camera native code should not play the system shutter click"
);

assert.ok(
  patchScript.includes("disableExpoCameraAndroidShutterSound"),
  "local patch script should keep Android expo-camera shutter sound disabled after install"
);

assert.ok(
  patchFile.includes("+  @Field val shutterSound: Boolean = false,"),
  "expo-camera patch file should default Android native shutter sound to disabled"
);

console.log("ok - Android native camera shutter sound is disabled");

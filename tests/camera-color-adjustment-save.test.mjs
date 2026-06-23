import assert from "node:assert/strict";
import fs from "node:fs";

const typesSource = fs.readFileSync("types/photo.ts", "utf8");
const cameraSource = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const photoLibrarySource = fs.readFileSync("lib/photo-library.ts", "utf8");
const nativeWrapperSource = fs.readFileSync("lib/android-image-adjustment.ts", "utf8");
const mainApplicationSource = fs.readFileSync(
  "android/app/src/main/java/com/haebi/photoguide/MainApplication.kt",
  "utf8"
);
const nativeModuleSource = fs.readFileSync(
  "android/app/src/main/java/com/haebi/photoguide/image/AndroidImageAdjustmentModule.kt",
  "utf8"
);

for (const snippet of [
  "export type CameraColorAdjustment",
  "brightness: number;",
  "contrast: number;",
  "saturation: number;",
  "temperature: number;",
  "tint: number;",
  "colorAdjustment?: CameraColorAdjustment;"
]) {
  assert.ok(typesSource.includes(snippet), `photo types should include color adjustment: ${snippet}`);
}

for (const snippet of [
  "colorAdjustment: getCameraColorAdjustmentInput()",
  "brightness: cameraBrightness",
  "contrast: cameraContrast",
  "saturation: cameraSaturation",
  "temperature: cameraColorTemperature",
  "tint: cameraColorTint"
]) {
  assert.ok(cameraSource.includes(snippet), `camera capture should pass color adjustment: ${snippet}`);
}

for (const snippet of [
  'import { applyAndroidImageAdjustment, hasCameraColorAdjustment } from "@/lib/android-image-adjustment";',
  "adjusted = await applyAndroidImageAdjustment({",
  "adjustment: input.colorAdjustment",
  "temporaryUris.push(adjusted.uri);",
  "uri: adjusted.uri"
]) {
  assert.ok(photoLibrarySource.includes(snippet), `photo storage should apply color adjustment: ${snippet}`);
}

for (const snippet of [
  "NativeModules.AndroidImageAdjustment",
  "export const hasCameraColorAdjustment",
  "export const applyAndroidImageAdjustment"
]) {
  assert.ok(nativeWrapperSource.includes(snippet), `native wrapper missing: ${snippet}`);
}

assert.ok(
  mainApplicationSource.includes("AndroidImageAdjustmentPackage()"),
  "MainApplication should register Android image adjustment package"
);

for (const snippet of [
  'override fun getName(): String = "AndroidImageAdjustment"',
  "BitmapFactory.decodeFile",
  "ColorMatrix",
  "setSaturation",
  "compress(Bitmap.CompressFormat.JPEG"
]) {
  assert.ok(nativeModuleSource.includes(snippet), `native module missing: ${snippet}`);
}

console.log("ok - camera color adjustments are applied to saved Android photos");

import { readTripClipSource } from "./trip-clip-test-source.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";

const editSource = fs.readFileSync("app/edit.tsx", "utf8");
const tripClipSource = readTripClipSource();
const viewRecorderNativeSource = fs.readFileSync(
  "node_modules/react-native-view-recorder/android/src/main/java/com/reactnativeviewrecorder/ViewRecorderModule.kt",
  "utf8"
);

assert.ok(
  viewRecorderNativeSource.includes("PixelCopy.request") &&
    !viewRecorderNativeSource.includes("MediaProjection") &&
    !viewRecorderNativeSource.includes("MediaActionSound") &&
    !viewRecorderNativeSource.includes("SHUTTER_CLICK"),
  "internal view capture should use silent PixelCopy/view drawing and not camera/system screenshot sound APIs"
);

assert.ok(
  editSource.includes("android_disableSound") &&
    editSource.includes("onPress={confirmSaveEdit}"),
  "edit save action should disable Android touch click sound"
);

assert.ok(
  tripClipSource.includes("android_disableSound") &&
    tripClipSource.includes("onPress={() => void saveSelectedExport()}") &&
    tripClipSource.includes("onPress={shareSelectedExport}"),
  "trip clip export actions should disable Android touch click sound"
);

console.log("ok - internal capture actions stay silent");

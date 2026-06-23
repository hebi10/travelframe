import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cameraSource = readFileSync("features/camera/CameraScreen.tsx", "utf8");

assert.ok(
  cameraSource.includes('<Feather name="image" size={28} color={colors.inverse} />'),
  "empty camera gallery button should use a clear photo icon"
);

assert.ok(
  !cameraSource.includes("styles.galleryEmptyLine") &&
    !cameraSource.includes("styles.galleryEmptyDot"),
  "empty camera gallery button should not use the old abstract line/dot icon"
);

console.log("ok - camera empty gallery button uses photo icon");

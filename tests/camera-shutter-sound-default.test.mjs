import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

assert.ok(
  !source.includes("setShutterSoundEnabled"),
  "camera shutter sound should not be toggleable on Android"
);

assert.ok(
  source.includes("shutterSound: false"),
  "camera capture should always request silent Android native capture"
);

console.log("ok - camera shutter sound is forced off");

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/(tabs)/camera.tsx", "utf8");

assert.ok(
  source.includes("const [shutterSoundEnabled, setShutterSoundEnabled] = useState(false);"),
  "camera shutter sound should be disabled by default"
);

assert.ok(
  source.includes("shutterSound: shutterSoundEnabled"),
  "camera capture should pass the shutter sound preference to expo-camera"
);

console.log("ok - camera shutter sound is disabled by default");

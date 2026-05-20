import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(tabs)/studio.tsx", "utf8");

assert.ok(
  source.includes("backgroundColor: palette.surfaceStrong"),
  "studio pressed surfaces should use the active theme palette"
);

assert.ok(
  !source.includes("pressed && styles.pressed"),
  "studio pressable surfaces should not use a static light pressed style"
);

assert.ok(
  !source.includes("pressed: {\n    backgroundColor: colors.surfaceStrong"),
  "studio should not define pressed background from the light palette"
);

console.log("ok - studio dark-mode pressed surfaces use palette colors");

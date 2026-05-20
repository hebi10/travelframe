import assert from "node:assert/strict";
import fs from "node:fs";

const wrapperSource = fs.readFileSync("tests/firebase-rules-emulator.test.mjs", "utf8");
const scriptSource = fs.readFileSync("scripts/run-firebase-rules-tests.mjs", "utf8");

assert.equal(wrapperSource.includes("process.exit(0)"), false, "Firebase emulator wrapper must not turn failures into passes");
assert.equal(wrapperSource.includes("skip -"), false, "Firebase emulator wrapper must not report skipped emulator checks as success");

for (const snippet of [
  "firebase emulators:exec",
  "tests/firebase-rules-emulator-runner.mjs",
  "FIREBASE_CONFIG_DIR",
  "Java 21 or newer",
  "process.exit(result.status ?? 1)"
]) {
  assert.ok(scriptSource.includes(snippet), `Firebase Rules runner missing: ${snippet}`);
}

console.log("ok - Firebase Rules runner fails closed and requires real emulator execution");

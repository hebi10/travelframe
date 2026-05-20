import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const result = spawnSync(process.execPath, ["scripts/run-firebase-rules-tests.mjs"], {
  stdio: "inherit"
});

assert.equal(result.status, 0, "Firebase Rules emulator tests should pass");

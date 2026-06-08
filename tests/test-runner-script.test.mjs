import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const runnerPath = "scripts/run-tests.mjs";

assert.equal(packageJson.scripts.test, "node scripts/run-tests.mjs");
assert.equal(packageJson.scripts["test:firebase-rules"], "node scripts/run-firebase-rules-tests.mjs");
assert.ok(fs.existsSync(runnerPath), "test runner script should exist");

const runnerSource = fs.readFileSync(runnerPath, "utf8");
for (const snippet of [
  "testsDirectory",
  "process.argv.slice(2)",
  "firebase-rules-emulator.test.mjs",
  "!defaultExcludedTests.has(name)",
  "filters.length === 0 || defaultExcludedTests.has(name)",
  "spawnSync(process.execPath",
  "TEST_TIMEOUT_MS",
  "300_000",
  "timeout: TEST_TIMEOUT_MS",
  "result.signal === \"SIGTERM\"",
  "timed out after",
  "No tests matched"
]) {
  assert.ok(runnerSource.includes(snippet), `test runner missing: ${snippet}`);
}

console.log("ok - npm test uses a reusable test runner script");

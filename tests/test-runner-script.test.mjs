import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const runnerPath = "scripts/run-tests.mjs";

assert.equal(packageJson.scripts.test, "node scripts/run-tests.mjs");
assert.ok(fs.existsSync(runnerPath), "test runner script should exist");

const runnerSource = fs.readFileSync(runnerPath, "utf8");
for (const snippet of [
  "testsDirectory",
  "process.argv.slice(2)",
  "spawnSync(process.execPath",
  "No tests matched"
]) {
  assert.ok(runnerSource.includes(snippet), `test runner missing: ${snippet}`);
}

console.log("ok - npm test uses a reusable test runner script");

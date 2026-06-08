import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const workflowPath = ".github/workflows/quality.yml";
assert.ok(fs.existsSync(workflowPath), "quality workflow should exist");

const source = fs.readFileSync(workflowPath, "utf8");

for (const snippet of [
  "name: Quality",
  "npm ci",
  "npm run typecheck",
  "npm run lint",
  "npm test",
  "name: Firebase Rules",
  "actions/setup-java@v4",
  "distribution: temurin",
  "java-version: \"21\"",
  "npm run test:firebase-rules",
  "name: Android Kotlin Verify",
  "runs-on: windows-latest",
  "npm run android:verify:kotlin"
]) {
  assert.ok(source.includes(snippet), `quality workflow missing: ${snippet}`);
}

assert.equal(
  packageJson.scripts.quality,
  "npm run typecheck && npm run lint && npm test && npm run security:secrets",
  "package.json should expose one bounded local app quality command"
);
assert.equal(
  packageJson.scripts["quality:firebase-rules"],
  "npm run test:firebase-rules",
  "Firebase Rules quality checks should remain explicit and separate"
);

console.log("ok - quality workflow runs app quality checks and Firebase Rules separately");

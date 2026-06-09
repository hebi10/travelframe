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
  "npm run security:secrets",
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

const qualityJobStart = source.indexOf("jobs:\n  quality:");
const firebaseRulesJobStart = source.indexOf("\n  firebase-rules:");
assert.ok(qualityJobStart >= 0, "quality workflow should define the quality job");
assert.ok(firebaseRulesJobStart > qualityJobStart, "quality workflow should define Firebase Rules after app quality");

const qualityJobSource = source.slice(qualityJobStart, firebaseRulesJobStart);
assert.ok(
  qualityJobSource.includes("npm run security:secrets"),
  "CI app quality job should include the same secrets scan as npm run quality"
);
assert.equal(
  packageJson.scripts["quality:firebase-rules"],
  "npm run test:firebase-rules",
  "Firebase Rules quality checks should remain explicit and separate"
);

console.log("ok - quality workflow runs app quality checks and Firebase Rules separately");

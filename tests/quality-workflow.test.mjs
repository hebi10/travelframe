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
  "npm run format:check",
  "npm test",
  "npm run security:secrets",
  "name: Functions",
  "npm ci --prefix functions",
  "npm run quality:functions",
  "name: Firebase Rules",
  "actions/setup-java@v4",
  "distribution: temurin",
  "java-version: \"21\"",
  "npm run test:firebase-rules",
  "name: Android Kotlin and Release Manifest Verify",
  "runs-on: windows-latest",
  "npm run android:verify:kotlin",
  "npm run android:manifest:release"
]) {
  assert.ok(source.includes(snippet), `quality workflow missing: ${snippet}`);
}

assert.equal(
  packageJson.scripts["format:check"],
  "npm run lint",
  "package.json should document the current format check policy as lint-backed"
);
assert.equal(
  packageJson.scripts.quality,
  "npm run typecheck && npm run format:check && npm test && npm run security:secrets",
  "package.json should expose one bounded local app quality command"
);
assert.equal(
  packageJson.scripts["quality:functions"],
  "npm --prefix functions run quality",
  "package.json should expose a bounded Functions quality command"
);

const qualityJobStart = source.indexOf("jobs:\n  quality:");
const functionsJobStart = source.indexOf("\n  functions:");
const firebaseRulesJobStart = source.indexOf("\n  firebase-rules:");
const androidJobStart = source.indexOf("\n  android-kotlin:");
assert.ok(qualityJobStart >= 0, "quality workflow should define the quality job");
assert.ok(functionsJobStart > qualityJobStart, "quality workflow should define Functions after app quality");
assert.ok(firebaseRulesJobStart > functionsJobStart, "quality workflow should define Firebase Rules after Functions");
assert.ok(androidJobStart > firebaseRulesJobStart, "quality workflow should define Android after Firebase Rules");

const qualityJobSource = source.slice(qualityJobStart, functionsJobStart);
assert.ok(
  qualityJobSource.includes("npm run security:secrets"),
  "CI app quality job should include the same secrets scan as npm run quality"
);
assert.ok(
  qualityJobSource.includes("npm run format:check"),
  "CI app quality job should run the explicit format check policy"
);

const functionsJobSource = source.slice(functionsJobStart, firebaseRulesJobStart);
assert.ok(
  functionsJobSource.indexOf("npm ci --prefix functions") <
    functionsJobSource.indexOf("npm run quality:functions"),
  "CI Functions job should install Functions dependencies before syntax verification"
);

const androidJobSource = source.slice(androidJobStart);
assert.ok(
  androidJobSource.includes("npm run android:manifest:release"),
  "CI Android job should include bounded release manifest verification"
);
assert.equal(
  androidJobSource.includes("npm run android:verify:debug") ||
    androidJobSource.includes("npm run android:build-prod"),
  false,
  "CI Android job should avoid long assemble/build release checks"
);
assert.equal(
  packageJson.scripts["quality:firebase-rules"],
  "npm run test:firebase-rules",
  "Firebase Rules quality checks should remain explicit and separate"
);

console.log("ok - quality workflow runs app, Functions, Firebase Rules, and Android manifest checks separately");

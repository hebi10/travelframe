import assert from "node:assert/strict";
import fs from "node:fs";

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
  "npm run test:firebase-rules"
]) {
  assert.ok(source.includes(snippet), `quality workflow missing: ${snippet}`);
}

console.log("ok - quality workflow runs app quality checks and Firebase Rules separately");

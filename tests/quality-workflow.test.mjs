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
  "npm test"
]) {
  assert.ok(source.includes(snippet), `quality workflow missing: ${snippet}`);
}

console.log("ok - quality workflow runs typecheck, lint, and tests");

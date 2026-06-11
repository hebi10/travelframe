import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/run-gitleaks.mjs", "utf8");
const secretScanWorkflow = fs.readFileSync(".github/workflows/secret-scan.yml", "utf8");

for (const snippet of [
  "COMMAND_TIMEOUT_MS",
  "DOWNLOAD_TIMEOUT_MS",
  "GITLEAKS_RUN_TIMEOUT_MS",
  "timeout: COMMAND_TIMEOUT_MS",
  "requestHandle.setTimeout(DOWNLOAD_TIMEOUT_MS",
  "download timed out after",
  "timeout: GITLEAKS_RUN_TIMEOUT_MS",
  "gitleaks timed out after"
]) {
  assert.ok(source.includes(snippet), `gitleaks runner missing timeout guard: ${snippet}`);
}

assert.ok(
  source.includes("const SCAN_HISTORY = process.argv.includes(\"--history\");"),
  "gitleaks runner should expose an explicit history scan mode"
);
assert.ok(
  secretScanWorkflow.includes("fetch-depth: 0"),
  "secret scan workflow should fetch full git history"
);
assert.ok(
  secretScanWorkflow.includes("npm run security:secrets:history"),
  "secret scan workflow should scan git history, not only the current tree"
);

console.log("ok - gitleaks runner bounds download and execution time");

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/run-gitleaks.mjs", "utf8");

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

console.log("ok - gitleaks runner bounds download and execution time");

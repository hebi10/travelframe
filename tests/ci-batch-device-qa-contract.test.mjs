import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(name, "utf8");
const device = read(".github/workflows/body-frame-device-qa.yml");
const release = read(".github/workflows/release-build.yml");
const orchestrator = read("scripts/release/tf_release_orchestrator.py");

test("final native Android QA runs only from exact frozen main", () => {
  const events = device.slice(device.indexOf("\non:\n") + 1, device.indexOf("\npermissions:"));
  assert.ok(events.includes("  workflow_dispatch:"), "manual trigger missing");
  assert.ok(!events.includes("  push:"), "automatic main QA must not repeat");
  assert.ok(!events.includes("  pull_request:"), "PR must not run full QA");
  assert.ok(events.includes("expected_main_sha:"), "exact source SHA input missing");
  assert.ok(device.includes("FULL_RELEASE_QA"), "full native video test required");
  assert.ok(device.includes('"$FULL_RELEASE_QA" == "true"'), "partial QA must not pass release");
  assert.ok(device.includes('"$EXPECTED_MAIN_SHA" == "$GITHUB_SHA"'), "selected SHA must match checkout");
  assert.ok(device.includes('gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main"'), "latest main must be verified");
  assert.ok(device.includes("cancel-in-progress: false"), "duplicate request must not cancel running QA");
});

test("existing approved release orchestrator passes the same full QA SHA", () => {
  assert.ok(orchestrator.includes('"release_qa": "true"'));
  assert.ok(orchestrator.includes('"expected_main_sha": sha'));
  assert.ok(orchestrator.includes('"release_request_id": request_id'));
});

test("signed release requires the actual successful nine-job native QA on exact main", () => {
  assert.ok(release.includes('REQUIRED_CI_JSON: \'["Quality","Secret Scan"]\''));
  assert.ok(release.includes('REQUIRED_MANUAL_QA_JSON: \'["Body Frame native device QA"]\''));
  assert.ok(release.includes('r.get("head_sha")==sha'));
  assert.ok(release.includes('r.get("head_branch")=="main"'));
  assert.ok(release.includes('r.get("event")=="workflow_dispatch"'));
  assert.ok(release.includes('len(found)!=1'));
  assert.ok(release.includes('found[0].get("conclusion")!="success"'));
  for (const job of [
    "build-apk", "capture-devices", "phone-360dp", "phone-412dp",
    "tablet-600dp", "tablet-750dp", "ui-r05-visual-verify",
    "UI-R05 native MP4 export", "UI-R05 independent MP4 hash"
  ]) {
    assert.ok(release.includes(job), "missing release-required job: " + job);
  }
});

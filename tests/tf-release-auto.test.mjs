import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");
const workflow = read(".github/workflows/tf-release-auto-01.yml");
const orchestrator = read("scripts/release/tf_release_orchestrator.py");
const native = read(".github/workflows/body-frame-device-qa.yml");
const build = read(".github/workflows/android-play-aab.yml");
const internal = read(".github/workflows/play-internal-release.yml");
const closed = read(".github/workflows/play-closed-release.yml");

test("TF release requires manual main-only workflow_dispatch and two approvals", () => {
  assert.match(workflow, /\n  workflow_dispatch:\n/);
  assert.doesNotMatch(workflow, /\n  (?:push|pull_request|pull_request_target|workflow_run|issue_comment):/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /internal_approved:/);
  assert.match(workflow, /closed_approved:/);
  assert.match(orchestrator, /internal and closed/);
  assert.match(orchestrator, /GITHUB_SHA.*sha/);
  assert.match(workflow, /inputs\.mode == 'deploy'/);
});

test("TF release checks exact main and real native capture and MP4 QA", () => {
  for (const name of [
    "Quality", "Secret Scan", "OPS-08 final main source and release policy verification",
    "capture-devices", "phone-360dp", "phone-412dp", "tablet-600dp", "tablet-750dp",
    "UI-R05 native MP4 export", "UI-R05 independent MP4 hash"
  ]) {
    assert.ok(orchestrator.includes(name), "Missing required release gate: " + name);
  }
  assert.match(native, /release_qa:/);
  assert.ok(native.split("inputs.release_qa == true").length - 1 >= 2,
    "Both MP4 generation and independent H.264 verification must run in release QA");
});

test("TF release dispatches existing manual publishers without changing originals", () => {
  for (const file of [build, internal, closed]) {
    assert.match(file, /workflow_dispatch:/);
  }
  assert.match(build, /release_request_id:/);
  assert.match(native, /release_request_id:/);
  assert.match(internal, /run-name: TF OPS-04/);
  assert.match(closed, /run-name: TF OPS-05/);
  for (const phrase of [
    "PUBLISH_VERIFIED_INTERNAL_AAB", "PROMOTE_VERIFIED_INTERNAL_VERSION",
    "committed-and-read-back", "committed_and_read_back",
    "aabSha256", "version_code", "aab_rebuilt"
  ]) {
    assert.ok(orchestrator.includes(phrase), "Missing identity/readback guard: " + phrase);
  }
  assert.doesNotMatch(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /androidpublisher\.googleapis\.com/);
});

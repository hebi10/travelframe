import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  collectStage15SourceEvidence,
  REQUIRED_LIVE_EVIDENCE,
  REQUIRED_REGRESSION_TESTS
} from "../scripts/report-stage15-release-readiness.mjs";
import {
  EARLIEST_PLAY_PUBLISH_AT,
  requirePlayPublishWindow,
  inspectInventory,
  resolveRequest
} from "../scripts/publish-play-release.mjs";

test("Stage 15 release preparation cannot declare live store or physical-device approval", () => {
  const report = collectStage15SourceEvidence();
  assert.equal(report.schema, "body-frame-stage15-readiness-v1");
  assert.equal(report.package, "com.haebi.photoguide");
  assert.equal(report.overallStatus, "awaiting_external_release_evidence");
  assert.equal(report.safeToPublish, false);
  assert.ok(report.source.length >= 12);
  assert.ok(report.source.every((r) => r.status === "source_verified"), "All source checks should pass");
  assert.equal(report.regressionSuites.length, Object.keys(REQUIRED_REGRESSION_TESTS).length);
  assert.ok(report.regressionSuites.every((s) => s.status === "included_in_full_node_suite"));
  assert.ok(report.manual.length >= 10);
  assert.equal(report.manual.length, REQUIRED_LIVE_EVIDENCE.length);
  assert.ok(report.manual.every((m) => m.status === "requires_live_evidence"));
  for (const id of ["android-arm64", "purchase-restore", "refund-rtdn", "firebase-deployed",
    "play-console-certificate", "play-products", "ad-consent", "health-declaration",
    "store-review", "dependency-triage"]) {
    assert.ok(report.manual.some((m) => m.id === id), id);
  }
  assert.ok(report.scope.includes("offline repository contracts only"));
});

test("Play inventory remains read-only before new upload key starts, publishing requires exact window", () => {
  assert.equal(EARLIEST_PLAY_PUBLISH_AT, "2026-11-07T02:01:00.000Z");
  const time = Date.parse(EARLIEST_PLAY_PUBLISH_AT);
  assert.throws(() => requirePlayPublishWindow("publish", time - 1), /unavailable before/);
  assert.doesNotThrow(() => requirePlayPublishWindow("inventory", time - 1));
  assert.doesNotThrow(() => requirePlayPublishWindow("publish", time));
  assert.throws(() => requirePlayPublishWindow("publish", NaN), /unavailable before/);

  const fixture = {
    GITHUB_REPOSITORY: "hebi10/travelframe",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_SHA: "a".repeat(40),
    INPUT_OPERATION: "inventory",
    INPUT_TRACK: "internal"
  };
  assert.deepEqual(resolveRequest(fixture), {
    sourceSha: "a".repeat(40), logicalTrack: "internal", operation: "inventory", mode: "check"
  });
  assert.equal(resolveRequest({ ...fixture, INPUT_TRACK: "closed" }).logicalTrack, "closed");
  for(const bad of [
    { GITHUB_REF: "refs/heads/production" },
    { INPUT_TRACK: "production" },
    { INPUT_OPERATION: "promote" },
    { GITHUB_REPOSITORY: "other/travelframe" }
  ]) {
    assert.throws(() => resolveRequest({ ...fixture, ...bad }));
  }
});

test("Play inventory checks target release safety without uploading, committing or modifying existing releases", async () => {
  let calls = [];
  const snapshot = {
    tracks: [
      { track: "internal", releases: [{ status: "draft", versionCodes: ["26092630"] }] },
      { track: "alpha", releases: [{ status: "completed", versionCodes: ["26092622"] }] }
    ],
    bundles: [{ versionCode: 26092631 }],
    apks: []
  };
  const client = {
    snapshot: async () => { calls.push("read-inventory"); return snapshot; },
    uploadBundle: () => { throw new Error("Must not upload"); },
    commit: () => { throw new Error("Must not commit"); }
  };
  const result = await inspectInventory(client, "internal");
  assert.equal(result.operation, "inventory");
  assert.equal(result.currentMaximumVersionCode, 26092631);
  assert.equal(result.hasBlockingRelease, true);
  assert.deepEqual(calls, ["read-inventory"]);
});

test("Existing local regression runner includes every Stage 15 area rather than marking mocks as real Play verification", () => {
  const tests = fs.readFileSync("scripts/run-tests.mjs", "utf8");
  assert.ok(tests.includes('name.endsWith(".test.mjs")'));
  const workflow = fs.readFileSync(".github/workflows/quality.yml", "utf8");
  for (const command of ["npm run typecheck", "npm run format:check",
    "npm run android:prebuild:ci", "npm run release:verify", "npm test",
    "npm run security:secrets", "npm run quality:functions", "npm run test:firebase-rules"]) {
    assert.ok(workflow.includes(command), command);
  }
  const release = fs.readFileSync(".github/workflows/android-play-aab.yml", "utf8");
  assert.ok(release.includes("BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'"));
  assert.ok(release.includes("needs: [plan, build]"));
  assert.ok(!release.includes("refs/heads/production"));
  assert.ok(release.includes("options: [internal, closed]"));
});

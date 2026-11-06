import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { readPlayInventory } from "../scripts/inspect-play-inventory-readonly.mjs";

const validEnv = {
  GITHUB_REPOSITORY: "hebi10/travelframe",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "push",
  PLAY_INTERNAL_TRACK: "internal",
  PLAY_ACCESS_TOKEN: "fixture-short-lived-token-for-testing"
};

test("Stage 15 main push inspects existing Play tracks in read-only mode, even before upload key activation", async () => {
  const operations = [];
  const factory = (token) => {
    assert.equal(token, validEnv.PLAY_ACCESS_TOKEN);
    return {
      snapshot: async () => {
        operations.push("snapshot");
        return {
          tracks: [
            { track: "internal", releases: [{ status: "draft", versionCodes: ["26092624"] }] },
            { track: "alpha", releases: [{ status: "completed", versionCodes: ["26092622"] }] }
          ],
          bundles: [{ versionCode: 26092625 }],
          apks: []
        };
      },
      commit: () => { throw new Error("Must never commit"); },
      uploadBundle: () => { throw new Error("Must never upload"); },
      updateTrack: () => { throw new Error("Must never modify tracks"); }
    };
  };
  const result = await readPlayInventory(validEnv, factory);
  assert.deepEqual(operations, ["snapshot"]);
  assert.equal(result.operation, "temporary-edit-readback-deleted-without-commit");
  assert.equal(result.package, "com.haebi.photoguide");
  assert.equal(result.currentMaximumVersionCode, 26092625);
  assert.equal(result.configuredInternalTrack, "internal");
  assert.equal(result.hasBlockingRelease, true);
  assert.equal(result.safeToPublish, false);
  assert.equal(result.uploadCertificateMatchesConsole, "unverified");
  assert.ok(!JSON.stringify(result).includes(validEnv.PLAY_ACCESS_TOKEN));
});

test("Read-only inventory allows manual dispatch but refuses arbitrary repository/branch/event/track", async () => {
  const factory = () => ({
    snapshot: async () => ({
      tracks: [{ track: "qa", releases: [{ status: "completed", versionCodes: ["26092622"] }] }],
      bundles: [], apks: []
    })
  });
  const result = await readPlayInventory({
    ...validEnv,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    PLAY_INTERNAL_TRACK: "qa"
  }, factory);
  assert.equal(result.hasBlockingRelease, false);
  for (const overrides of [
    { GITHUB_REPOSITORY: "someone/else" },
    { GITHUB_REF: "refs/heads/production" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { PLAY_INTERNAL_TRACK: "alpha" },
    { PLAY_ACCESS_TOKEN: "" }
  ]) {
    await assert.rejects(readPlayInventory({ ...validEnv, ...overrides }, factory));
  }
});

test("Play operations CI never publishes from the diagnostic workflow or depends on the publish calendar gate", () => {
  const workflow = fs.readFileSync(".github/workflows/body-frame-stage15-play-ops-readonly.yml", "utf8");
  const source = fs.readFileSync("scripts/inspect-play-inventory-readonly.mjs", "utf8");
  assert.ok(workflow.includes("scripts/inspect-play-inventory-readonly.mjs"));
  assert.ok(workflow.includes("stage15-play-inventory.json"));
  assert.ok(workflow.includes("stage15-play-catalog.json"));
  assert.ok(!workflow.includes("scripts/publish-play-release.mjs plan"));
  assert.ok(!workflow.includes("scripts/publish-play-release.mjs publish"));
  assert.ok(!source.includes("requirePlayPublishWindow("));
  assert.ok(!source.includes("resolveRequest("));
  assert.ok(source.includes("inspectInventory(factory(token), track)"));
  assert.ok(!workflow.includes(":app:bundleRelease"));
  assert.ok(!workflow.includes("prepare-play-aab.mjs signing"));
});

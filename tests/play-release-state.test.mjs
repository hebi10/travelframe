import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planRelease, publishRelease } from "../scripts/publish-play-release.mjs";

const request = { sourceSha: "a".repeat(40), logicalTrack: "internal", internalTrack: "internal", versionName: "1.0.32", certificateSha256: "b".repeat(64) };
const completed = { status: "completed", versionCodes: ["26092622"] };
const snapshot = (track, releases) => ({ tracks: [{ track: "production", releases: [{ status: "draft", versionCodes: ["26092621"] }] }, { track, ...(releases === undefined ? {} : { releases }) }], bundles: [], apks: [] });
const protectedReleases = [
  [{ status: "draft", versionCodes: ["26092622"] }],
  [{ status: "inProgress", versionCodes: ["26092622"], userFraction: 0.1 }],
  [{ status: "halted", versionCodes: ["26092622"] }],
  [{ status: "futureStatus", versionCodes: ["26092622"] }],
  [{ status: "statusUnspecified" }],
  [{ versionCodes: ["26092622"] }],
  [completed, { status: "draft", versionCodes: ["26092620"] }],
  [{ status: "draft", name: "Saved work", versionCodes: [] }],
  [{ status: "draft", releaseNotes: [{ language: "en-US", text: "Saved notes" }] }],
  [{ status: "draft", versionCodes: null }],
  [{ status: "draft", versionCodes: "26092622" }],
  [{ status: "completed", versionCodes: [] }],
  [{ status: "completed", versionCodes: [["26092622"]] }],
  [null], null, {}
];

test("planning preserves protected target releases before a build is planned for internal or closed", async () => {
  for (const logicalTrack of ["internal", "closed"]) {
    const track = logicalTrack === "internal" ? "internal" : "alpha";
    for (const releases of protectedReleases) {
      const calls = [];
      const client = { snapshot: async () => { calls.push("snapshot"); return snapshot(track, releases); } };
      await assert.rejects(planRelease(client, { ...request, logicalTrack }));
      assert.deepEqual(calls, ["snapshot"]);
    }
  }
});

test("fresh publish snapshot blocks target draft, staged, halted, unknown or malformed work before upload or PUT", async () => {
  for (const logicalTrack of ["internal", "closed"]) {
    const track = logicalTrack === "internal" ? "internal" : "alpha";
    const plan = await planRelease({ snapshot: async () => snapshot(track, [completed]) }, { ...request, logicalTrack });
    for (const releases of protectedReleases) {
      const calls = [];
      const client = {
        insert: async () => { calls.push("insert"); return "publish"; },
        readSnapshot: async () => { calls.push("snapshot"); return snapshot(track, releases); },
        uploadBundle: async () => { calls.push("upload"); throw new Error("Unexpected upload"); },
        uploadMapping: async () => { calls.push("mapping"); },
        updateTrack: async () => { calls.push("PUT"); },
        validate: async () => { calls.push("validate"); },
        commit: async () => { calls.push("commit"); },
        delete: async (id) => { calls.push(["delete", id]); }
      };
      await assert.rejects(publishRelease(client, plan, "/unused", "/unused"));
      assert.deepEqual(calls, ["insert", "snapshot", ["delete", "publish"]]);
    }
  }
});

test("completed targets, empty tracks and explicitly empty draft shells remain publishable without changing routing", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-release-state-"));
  const aab = path.join(directory, "verified.aab");
  fs.writeFileSync(aab, "verified bundle");
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(aab)).digest("hex");
  try {
    for (const logicalTrack of ["internal", "closed"]) {
      const track = logicalTrack === "internal" ? "internal" : "alpha";
      for (const releases of [[completed], [], undefined, [{ status: "draft" }], [{ status: "draft", versionCodes: [] }]]) {
        const state = snapshot(track, releases);
        const plan = await planRelease({ snapshot: async () => state }, { ...request, logicalTrack });
        const calls = [];
        const body = { track, releases: [{ status: "completed", versionCodes: [String(plan.versionCode)] }] };
        const client = {
          insert: async () => "edit", readSnapshot: async () => state,
          uploadBundle: async () => { calls.push("upload"); return { versionCode: plan.versionCode, sha256 }; },
          uploadMapping: async () => {}, updateTrack: async (_id, apiTrack, value) => { calls.push(["PUT", apiTrack]); return value; },
          validate: async () => {}, commit: async () => {}, getTrack: async () => body, delete: async () => {}
        };
        assert.equal((await publishRelease(client, plan, aab, "/unused")).status, "committed-and-read-back");
        assert.deepEqual(calls, ["upload", ["PUT", track]]);
      }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

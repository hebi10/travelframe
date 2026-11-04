import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPublisher, resolveRequest, resolveTrack, maximumVersion, planRelease, publishRelease, verifyArtifactMetadata, inspectInventory } from "../scripts/publish-play-release.mjs";

const sha = "a".repeat(40);
const request = { sourceSha: sha, logicalTrack: "internal", internalTrack: "internal", versionName: "1.0.32", certificateSha256: "b".repeat(64) };
const snapshot = { tracks: [{ track: "production", releases: [{ status: "completed", versionCodes: ["26092620"] }] }, { track: "internal", releases: [{ status: "completed", versionCodes: ["26092622"] }] }, { track: "alpha", releases: [] }], bundles: [{ versionCode: 26092624 }], apks: [{ versionCode: 26092623 }] };

test("automatic builds use the triggering main commit; only manual runs accept a full source SHA", () => {
  const environment = { GITHUB_REPOSITORY: "hebi10/travelframe", GITHUB_REF: "refs/heads/main", GITHUB_SHA: sha, GITHUB_EVENT_NAME: "push" };
  assert.equal(resolveRequest(environment).sourceSha, sha);
  assert.equal(resolveRequest({ ...environment, INPUT_SOURCE_SHA: "c".repeat(40) }).sourceSha, sha);
  assert.equal(resolveRequest({ ...environment, INPUT_OPERATION: "inventory" }).operation, "publish");
  assert.equal(resolveRequest({ ...environment, GITHUB_EVENT_NAME: "workflow_dispatch", INPUT_OPERATION: "inventory" }).operation, "inventory");
  assert.equal(resolveRequest({ ...environment, GITHUB_EVENT_NAME: "workflow_dispatch", INPUT_SOURCE_SHA: "c".repeat(40), INPUT_TRACK: "closed" }).logicalTrack, "closed");
  for (const changes of [{ GITHUB_REF: "refs/heads/feature" }, { GITHUB_REPOSITORY: "elsewhere/app" }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "workflow_dispatch", INPUT_SOURCE_SHA: "main" }, { GITHUB_EVENT_NAME: "workflow_dispatch", INPUT_TRACK: "production" }]) assert.throws(() => resolveRequest({ ...environment, ...changes }));
});

test("track names must match an explicit safe mapping and an existing API track", () => {
  assert.equal(resolveTrack("internal", "internal", snapshot.tracks), "internal");
  assert.equal(resolveTrack("internal", "qa", [{ track: "qa" }]), "qa");
  assert.equal(resolveTrack("closed", "", snapshot.tracks), "alpha");
  for (const [logical, mapping, tracks] of [["internal", "", snapshot.tracks], ["internal", "production", snapshot.tracks], ["internal", "qa", snapshot.tracks], ["closed", "", [{ track: "closed" }]], ["production", "internal", snapshot.tracks]]) assert.throws(() => resolveTrack(logical, mapping, tracks));
});

test("version planning includes unassigned bundles, APKs and every track; manual reuse is rejected", async () => {
  assert.equal(maximumVersion(snapshot), 26092624);
  const client = { snapshot: async () => snapshot };
  assert.equal((await planRelease(client, request)).versionCode, 26092625);
  await assert.rejects(planRelease(client, { ...request, versionCode: "26092624" }), /exceed/);
  assert.throws(() => maximumVersion({ ...snapshot, bundles: [{ versionCode: "bad" }] }));
  assert.equal(maximumVersion({ tracks: [], apks: [], bundles: [] }), 26092622);
});

test("Publisher transport is fixed to this app and rejects a foreign resumable upload URL", async () => {
  const calls = [];
  const client = createPublisher("test-token", async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/edits")) return new Response(JSON.stringify({ id: "edit1" }));
    if (url.includes("uploadType=resumable")) return new Response("", { headers: { location: "https://evil.example/upload" } });
    return new Response("{}");
  });
  assert.equal(await client.insert(), "edit1");
  await assert.rejects(client.uploadBundle("edit1", "/unused", 12), /upload URL/);
  assert(calls.every(({ url, options }) => url.startsWith("https://androidpublisher.googleapis.com/") && url.includes("/com.haebi.photoguide/") && options.redirect === "error"));
  await assert.rejects(client.getTrack("edit1", "production"), /test track/);
});

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-play-api-test-"));
  const aab = path.join(directory, "BodyFrame.aab");
  const mapping = path.join(directory, "mapping.txt");
  fs.writeFileSync(aab, "verified-test-bundle");
  fs.writeFileSync(mapping, "mapping");
  const plan = { ...request, apiTrack: "internal", versionCode: 26092625, lastPlayVersionCode: 26092624, workflowSha: "d".repeat(40), runId: "123", runAttempt: "1" };
  return { directory, aab, mapping, plan };
}

test("publishing checks the upload hash, commits only the test track, then reads the committed track", async () => {
  const f = fixture();
  const calls = [];
  let committed = false;
  const crypto = await import("node:crypto");
  const client = {
    insert: async () => { calls.push("insert"); return committed ? "readback" : "publish"; },
    readSnapshot: async () => snapshot,
    uploadBundle: async () => { calls.push("bundle"); return { versionCode: f.plan.versionCode, sha256: crypto.createHash("sha256").update(fs.readFileSync(f.aab)).digest("hex") }; },
    uploadMapping: async () => { calls.push("mapping"); },
    updateTrack: async (_edit, track, body) => { calls.push(["track", track, body]); return body; },
    validate: async () => { calls.push("validate"); },
    commit: async () => { calls.push("commit"); committed = true; },
    getTrack: async () => ({ track: "internal", releases: [{ status: "completed", versionCodes: [String(f.plan.versionCode)] }] }),
    delete: async (id) => { calls.push(["delete", id]); }
  };
  try {
    const receipt = await publishRelease(client, f.plan, f.aab, f.mapping);
    assert.equal(receipt.status, "committed-and-read-back");
    assert.deepEqual(calls.find((entry) => Array.isArray(entry) && entry[0] === "track"), ["track", "internal", { track: "internal", releases: [{ name: "1.0.32 (26092625)", status: "completed", versionCodes: ["26092625"] }] }]);
    assert(calls.indexOf("mapping") < calls.indexOf("commit"));
    assert(calls.some((entry) => Array.isArray(entry) && entry[0] === "delete" && entry[1] === "readback"));
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("racing versions and upload hash mismatch stop before track mutation", async () => {
  const f = fixture();
  try {
    let uploaded = false;
    const client = { insert: async () => "edit", readSnapshot: async () => ({ ...snapshot, bundles: [{ versionCode: f.plan.versionCode }] }), delete: async () => {}, uploadBundle: async () => { uploaded = true; } };
    await assert.rejects(publishRelease(client, f.plan, f.aab, f.mapping), /versionCode/);
    assert.equal(uploaded, false);
    client.readSnapshot = async () => snapshot;
    client.uploadBundle = async () => ({ versionCode: f.plan.versionCode, sha256: "0".repeat(64) });
    await assert.rejects(publishRelease(client, f.plan, f.aab, f.mapping), /hash/);
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("committed releases with failed readback preserve an unverified receipt and do not recommit", async () => {
  const f = fixture();
  const crypto = await import("node:crypto");
  let commits = 0;
  let receipt;
  const client = {
    insert: async () => "edit", readSnapshot: async () => snapshot, delete: async () => {},
    uploadBundle: async () => ({ versionCode: f.plan.versionCode, sha256: crypto.createHash("sha256").update(fs.readFileSync(f.aab)).digest("hex") }),
    uploadMapping: async () => {}, updateTrack: async (_id, _track, body) => body,
    validate: async () => {}, commit: async () => { commits++; },
    getTrack: async () => ({ track: "internal", releases: [{ status: "draft", versionCodes: [String(f.plan.versionCode)] }] })
  };
  try {
    await assert.rejects(publishRelease(client, f.plan, f.aab, f.mapping, (value) => { receipt = { ...value }; }), /readback/);
    assert.equal(commits, 1);
    assert.equal(receipt.status, "committed-readback-unverified");
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("artifact provenance binds the source, workflow, run, version, certificate and output hashes", async () => {
  const f = fixture();
  const crypto = await import("node:crypto");
  const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  fs.renameSync(f.aab, path.join(f.directory, "BodyFrame-1.0.32-26092625.aab"));
  f.aab = path.join(f.directory, "BodyFrame-1.0.32-26092625.aab");
  const provenance = { repository: "hebi10/travelframe", sourceSha: f.plan.sourceSha, workflowSha: f.plan.workflowSha, runId: f.plan.runId, runAttempt: f.plan.runAttempt, packageId: "com.haebi.photoguide", versionName: f.plan.versionName, versionCode: f.plan.versionCode, confirmedPreviousPlayVersionCode: f.plan.lastPlayVersionCode, uploadCertificateSha256: f.plan.certificateSha256, aabSha256: digest(f.aab), mappingSha256: digest(f.mapping) };
  const file = path.join(f.directory, "build-provenance.json");
  try {
    fs.writeFileSync(file, JSON.stringify(provenance));
    assert.equal(verifyArtifactMetadata(f.directory, f.plan).aab, f.aab);
    for (const changes of [{ sourceSha: "f".repeat(40) }, { workflowSha: "f".repeat(40) }, { packageId: "other.app" }, { runAttempt: "2" }, { versionCode: 26092626 }, { aabSha256: "0".repeat(64) }, { uploadCertificateSha256: "0".repeat(64) }]) {
      fs.writeFileSync(file, JSON.stringify({ ...provenance, ...changes }));
      assert.throws(() => verifyArtifactMetadata(f.directory, f.plan));
    }
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("resumable transfer sends only the AAB to the exact app session and mapping to its version", async () => {
  const f = fixture();
  const calls = [];
  const client = createPublisher("test-token", async (url, options) => {
    let data = "";
    if (options.body?.pipe) for await (const chunk of options.body) data += chunk;
    calls.push({ url, options, data });
    if (url.endsWith("?uploadType=resumable")) return new Response("", { headers: { location: url + "&upload_id=opaque" } });
    return new Response(JSON.stringify({ versionCode: f.plan.versionCode, sha256: "a".repeat(64) }));
  });
  try {
    await client.uploadBundle("edit1", f.aab);
    await client.uploadMapping("edit1", f.plan.versionCode, f.mapping);
    assert.equal(calls[1].options.method, "PUT");
    assert.equal(calls[1].data, "verified-test-bundle");
    assert(calls[1].url.includes("/com.haebi.photoguide/edits/edit1/bundles?"));
    assert(calls[2].url.includes("/apks/26092625/deobfuscationFiles/proguard?uploadType=media"));
    assert.equal(calls[2].data, "mapping");
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("resumable sessions accept documented Google hosts and reject another app, edit or resource", async () => {
  const f = fixture();
  const fixed = "/upload/androidpublisher/v3/applications/com.haebi.photoguide/edits/edit1/bundles";
  try {
    for (const location of [`https://www.googleapis.com${fixed}?upload_id=opaque`, `https://androidpublisher.googleapis.com/resumable${fixed}?upload_id=opaque`]) {
      const client = createPublisher("test-token", async (_url, options) => {
        if (options.method === "POST") return new Response("", { headers: { location } });
        for await (const _chunk of options.body) { /* Consume the fixture stream. */ }
        return new Response("{}");
      });
      await client.uploadBundle("edit1", f.aab);
    }
    for (const location of [`https://www.googleapis.com${fixed.replace("com.haebi.photoguide", "other.app")}?upload_id=opaque`, `https://androidpublisher.googleapis.com${fixed.replace("edit1", "edit2")}?upload_id=opaque`, `https://androidpublisher.googleapis.com${fixed.replace("bundles", "apks")}?upload_id=opaque`, `https://androidpublisher.googleapis.com${fixed}`, `https://androidpublisher.googleapis.com.evil.example${fixed}?upload_id=opaque`]) {
      const client = createPublisher("test-token", async () => new Response("", { headers: { location } }));
      await assert.rejects(client.uploadBundle("edit1", f.aab), /upload URL/);
    }
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("commit never cancels an existing review or silently switches to draft", async () => {
  const calls = [];
  const client = createPublisher("test-token", async (url, options) => { calls.push({ url, options }); return new Response("{}", { status: 400 }); });
  await assert.rejects(client.commit("edit1"), /400/);
  assert.equal(calls.length, 1);
  assert(calls[0].url.endsWith(":commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW"));
  assert.equal(calls[0].options.body, undefined);
});

test("inventory requires no track mapping or signing keys and only lists then deletes its temporary edit", async () => {
  const calls = [];
  const client = createPublisher("test-token", async (url, options) => {
    calls.push([options.method, url]);
    if (options.method === "POST" && url.endsWith("/edits")) return new Response(JSON.stringify({ id: "inspect" }));
    if (options.method === "DELETE") return new Response(null, { status: 204 });
    if (options.method !== "GET") throw new Error("Inventory tried to mutate a release");
    if (url.endsWith("/tracks")) return new Response(JSON.stringify({ tracks: snapshot.tracks }));
    if (url.endsWith("/bundles")) return new Response(JSON.stringify({ bundles: snapshot.bundles }));
    if (url.endsWith("/apks")) return new Response(JSON.stringify({ apks: snapshot.apks }));
    throw new Error("Unexpected inventory request");
  });
  const result = await inspectInventory(client);
  assert.equal(result.currentMaximumVersionCode, 26092624);
  assert.deepEqual(result.apiTracks, ["production", "internal", "alpha"]);
  assert.deepEqual(calls.map(([method]) => method), ["POST", "GET", "GET", "GET", "DELETE"]);
  assert(calls.every(([, url]) => !url.includes(":commit") && !url.includes(":validate") && !url.includes("/upload/")));
});

test("partial upload, mapping and validation failures discard the uncommitted edit", async () => {
  const f = fixture();
  const crypto = await import("node:crypto");
  try {
    for (const failedStep of ["uploadBundle", "uploadMapping", "validate"]) {
      let commits = 0;
      const deleted = [];
      const client = {
        insert: async () => "publish", readSnapshot: async () => snapshot,
        uploadBundle: async () => ({ versionCode: f.plan.versionCode, sha256: crypto.createHash("sha256").update(fs.readFileSync(f.aab)).digest("hex") }),
        uploadMapping: async () => {}, updateTrack: async (_id, _track, body) => body,
        validate: async () => {}, commit: async () => { commits++; },
        delete: async (id) => { deleted.push(id); }
      };
      client[failedStep] = async () => { throw new Error("simulated failure"); };
      await assert.rejects(publishRelease(client, f.plan, f.aab, f.mapping), /simulated failure/);
      assert.equal(commits, 0);
      assert.deepEqual(deleted, ["publish"]);
    }
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test("a commit network error preserves an uncertain receipt and never retries the commit", async () => {
  const f = fixture();
  const crypto = await import("node:crypto");
  let commits = 0;
  let receipt;
  const client = {
    insert: async () => "publish", readSnapshot: async () => snapshot,
    uploadBundle: async () => ({ versionCode: f.plan.versionCode, sha256: crypto.createHash("sha256").update(fs.readFileSync(f.aab)).digest("hex") }),
    uploadMapping: async () => {}, updateTrack: async (_id, _track, body) => body,
    validate: async () => {}, commit: async () => { commits++; throw new Error("network outcome unknown"); },
    delete: async () => { throw new Error("edit may be committed"); }
  };
  try {
    await assert.rejects(publishRelease(client, f.plan, f.aab, f.mapping, (value) => { receipt = { ...value }; }), /network outcome unknown/);
    assert.equal(commits, 1);
    assert.equal(receipt.status, "commit-outcome-unconfirmed");
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

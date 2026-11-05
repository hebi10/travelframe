import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBuildInputs } from "./prepare-play-aab.mjs";

const PACKAGE = "com.haebi.photoguide";
const ORIGIN = "https://androidpublisher.googleapis.com";
const BASE = `${ORIGIN}/androidpublisher/v3/applications/${PACKAGE}/edits`;
const UPLOAD = `${ORIGIN}/upload/androidpublisher/v3/applications/${PACKAGE}/edits`;
const FLOOR = 26092622;
const MAXIMUM = 2100000000;
const BUNDLETOOL_SHA256 = "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29";
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export const EARLIEST_PLAY_PUBLISH_AT = "2026-11-06T15:00:00.000Z"; // 2026-11-07 00:00 Asia/Seoul

export function requirePlayPublishWindow(operation, now = Date.now()) {
  if (operation === "inventory") return;
  if (operation !== "publish" || !Number.isFinite(now) || now < Date.parse(EARLIEST_PLAY_PUBLISH_AT)) {
    throw new Error("Play publishing is unavailable before 2026-11-07 00:00 KST; read-only inventory remains available");
  }
}


export function resolveRequest(environment) {
  if (environment.GITHUB_REPOSITORY !== "hebi10/travelframe" || environment.GITHUB_REF !== "refs/heads/main") throw new Error("Play releases must run from this repository's main workflow");
  if (!["push", "workflow_dispatch"].includes(environment.GITHUB_EVENT_NAME)) throw new Error("Unsupported release event");
  const manual = environment.GITHUB_EVENT_NAME === "workflow_dispatch";
  const sourceSha = String(manual && environment.INPUT_SOURCE_SHA ? environment.INPUT_SOURCE_SHA : environment.GITHUB_SHA || "").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("source_sha must be a full 40-character commit SHA");
  const logicalTrack = manual ? environment.INPUT_TRACK || "internal" : "internal";
  if (!["internal", "closed"].includes(logicalTrack)) throw new Error("Only internal and closed testing are allowed");
  const operation = manual ? environment.INPUT_OPERATION || "publish" : "publish";
  if (!["publish", "inventory"].includes(operation)) throw new Error("Only publish and read-only inventory operations are allowed");
  return { sourceSha, logicalTrack, operation };
}

export function resolveTrack(logicalTrack, internalTrack, tracks) {
  if (!["internal", "closed"].includes(logicalTrack)) throw new Error("Only internal and closed testing are allowed");
  const apiTrack = logicalTrack === "closed" ? "alpha" : internalTrack;
  if (!(["internal", "qa"].includes(apiTrack) && logicalTrack === "internal") && !(logicalTrack === "closed" && apiTrack === "alpha")) throw new Error("PLAY_INTERNAL_TRACK must explicitly identify the confirmed internal or qa API track");
  if (!Array.isArray(tracks) || tracks.filter((track) => track.track === apiTrack).length !== 1) throw new Error("Configured test track is absent or ambiguous in edits.tracks.list; no alias or custom track will be guessed");
  return apiTrack;
}

function requireReplaceableTarget(tracks, apiTrack) {
  const target = tracks.find((track) => track.track === apiTrack);
  const releases = target.releases === undefined ? [] : target.releases;
  const blocked = () => { throw new Error("Target test track contains an existing draft, staged, halted or unknown release; preserve it in Play Console before publishing"); };
  if (!Array.isArray(releases)) blocked();
  for (const release of releases) {
    if (!release || typeof release !== "object" || Array.isArray(release)) blocked();
    const codes = release.versionCodes === undefined ? [] : release.versionCodes;
    if (!Array.isArray(codes)) blocked();
    if (release.status === "completed" && codes.length > 0) {
      codes.forEach(version);
      continue;
    }
    if (release.status === "draft" && codes.length === 0 && Object.keys(release).every((field) => ["status", "versionCodes"].includes(field))) continue;
    blocked();
  }
}

function version(value) {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid Play versionCode");
  const text = String(value);
  if (!/^[1-9]\d{0,9}$/.test(text) || Number(text) > MAXIMUM) throw new Error("Invalid Play versionCode");
  return Number(text);
}

export function maximumVersion(snapshot) {
  const versions = [FLOOR];
  for (const track of snapshot.tracks) for (const release of track.releases ?? []) for (const code of release.versionCodes ?? []) versions.push(version(code));
  for (const bundle of snapshot.bundles) versions.push(version(bundle.versionCode));
  for (const apk of snapshot.apks) versions.push(version(apk.versionCode));
  return Math.max(...versions);
}

export function createPublisher(accessToken, fetchImpl = fetch) {
  if (!accessToken) throw new Error("A short-lived Android Publisher access token is required");
  const edit = (id) => { if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error("Invalid edit identifier"); return `${BASE}/${id}`; };
  const testTrack = (track) => { if (!["internal", "qa", "alpha"].includes(track)) throw new Error("Only an allowlisted test track can be requested"); return track; };
  async function request(url, method = "GET", body, headers = {}) {
    const response = await fetchImpl(url, { method, headers: { authorization: `Bearer ${accessToken}`, ...headers }, ...(body === undefined ? {} : { body }), ...(body?.pipe ? { duplex: "half" } : {}), redirect: "error", signal: AbortSignal.timeout(20 * 60 * 1000) });
    if (!response.ok) throw new Error(`Android Publisher ${method} request failed (HTTP ${response.status}); response contents withheld`);
    return response;
  }
  async function json(url, method = "GET", body) {
    const response = await request(url, method, body === undefined ? undefined : JSON.stringify(body), body === undefined ? {} : { "content-type": "application/json" });
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }
  const client = {
    insert: async () => { const result = await json(BASE, "POST", {}); edit(result.id); return result.id; },
    delete: async (id) => { await request(edit(id), "DELETE"); },
    readSnapshot: async (id) => {
      const [tracks, bundles, apks] = await Promise.all([json(`${edit(id)}/tracks`), json(`${edit(id)}/bundles`), json(`${edit(id)}/apks`)]);
      if ([tracks, bundles, apks].some((result) => result.nextPageToken)) throw new Error("Unexpected paginated Publisher response; refusing an incomplete version inventory");
      const snapshot = { tracks: tracks.tracks ?? [], bundles: bundles.bundles ?? [], apks: apks.apks ?? [] };
      if (Object.values(snapshot).some((value) => !Array.isArray(value))) throw new Error("Invalid Publisher inventory response");
      maximumVersion(snapshot);
      return snapshot;
    },
    snapshot: async () => { const id = await client.insert(); try { return await client.readSnapshot(id); } finally { await client.delete(id); } },
    uploadBundle: async (id, file, size = fs.statSync(file).size) => {
      edit(id);
      const base = `${UPLOAD}/${id}/bundles`;
      const response = await request(`${base}?uploadType=resumable`, "POST", "{}", { "content-type": "application/json", "x-upload-content-type": "application/octet-stream", "x-upload-content-length": String(size) });
      const location = response.headers.get("location");
      const url = new URL(location || "https://invalid.example");
      const uploadPath = new URL(base).pathname;
      if (![ORIGIN, "https://www.googleapis.com"].includes(url.origin) || ![uploadPath, `/resumable${uploadPath}`].includes(url.pathname) || !url.searchParams.get("upload_id") || url.username || url.password || url.hash) throw new Error("Unsafe resumable upload URL; credentials will not be forwarded");
      const result = await request(url.href, "PUT", createReadStream(file), { "content-type": "application/octet-stream", "content-length": String(size) });
      return result.json();
    },
    uploadMapping: async (id, code, file) => {
      edit(id);
      await request(`${UPLOAD}/${id}/apks/${version(code)}/deobfuscationFiles/proguard?uploadType=media`, "POST", createReadStream(file), { "content-type": "application/octet-stream", "content-length": String(fs.statSync(file).size) });
    },
    updateTrack: async (id, track, body) => json(`${edit(id)}/tracks/${testTrack(track)}`, "PUT", body),
    getTrack: async (id, track) => json(`${edit(id)}/tracks/${testTrack(track)}`),
    validate: async (id) => { await request(`${edit(id)}:validate`, "POST"); },
    commit: async (id) => { await request(`${edit(id)}:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW`, "POST"); }
  };
  return client;
}

export async function planRelease(client, request) {
  const snapshot = await client.snapshot();
  const apiTrack = resolveTrack(request.logicalTrack, request.internalTrack, snapshot.tracks);
  requireReplaceableTarget(snapshot.tracks, apiTrack);
  const lastPlayVersionCode = maximumVersion(snapshot);
  const inputs = validateBuildInputs({ ...request, versionCode: request.versionCode || String(lastPlayVersionCode + 1), lastPlayVersionCode: String(lastPlayVersionCode) });
  return { ...inputs, logicalTrack: request.logicalTrack, apiTrack };
}

export async function inspectInventory(client, internalTrack) {
  const snapshot = await client.snapshot();
  const summary = {
    packageId: PACKAGE, operation: "inventory",
    apiTracks: snapshot.tracks.map((track) => track.track),
    currentMaximumVersionCode: maximumVersion(snapshot),
    bundleCount: snapshot.bundles.length, apkCount: snapshot.apks.length
  };
  if (!internalTrack) return summary;
  const target = resolveTrack("internal", internalTrack, snapshot.tracks);
  let hasBlockingRelease = false;
  try { requireReplaceableTarget(snapshot.tracks, target); }
  catch { hasBlockingRelease = true; }
  return {
    ...summary, configuredInternalTrack: target,
    internalTrackReleaseStatuses: (snapshot.tracks.find((track) => track.track === target).releases ?? [])
      .map((release) => typeof release?.status === "string" ? release.status : "unknown"),
    hasBlockingRelease
  };
}

function requireRelease(track, apiTrack, code) {
  if (track.track !== apiTrack || track.releases?.length !== 1 || track.releases[0].status !== "completed" || track.releases[0].versionCodes?.length !== 1 || String(track.releases[0].versionCodes[0]) !== String(code)) throw new Error("Committed test track readback did not match the exact completed release");
}

export async function publishRelease(client, plan, aab, mapping, onReceipt = () => {}) {
  const id = await client.insert();
  let committed = false;
  try {
    const snapshot = await client.readSnapshot(id);
    if (resolveTrack(plan.logicalTrack, plan.logicalTrack === "internal" ? plan.apiTrack : "", snapshot.tracks) !== plan.apiTrack) throw new Error("Test track mapping changed after planning");
    requireReplaceableTarget(snapshot.tracks, plan.apiTrack);
    if (plan.versionCode <= maximumVersion(snapshot)) throw new Error("Planned versionCode is no longer above every current Play version; rebuild with a fresh plan");
    const bundle = await client.uploadBundle(id, aab);
    if (bundle.versionCode !== plan.versionCode || bundle.sha256?.toLowerCase() !== sha256(aab)) throw new Error("Play uploaded bundle versionCode or SHA-256 hash does not match the verified local AAB");
    await client.uploadMapping(id, plan.versionCode, mapping);
    const body = { track: plan.apiTrack, releases: [{ name: `${plan.versionName} (${plan.versionCode})`, status: "completed", versionCodes: [String(plan.versionCode)] }] };
    requireRelease(await client.updateTrack(id, plan.apiTrack, body), plan.apiTrack, plan.versionCode);
    await client.validate(id);
    const receipt = { status: "commit-outcome-unconfirmed", packageId: PACKAGE, sourceSha: plan.sourceSha, workflowSha: plan.workflowSha, runId: plan.runId, runAttempt: plan.runAttempt, logicalTrack: plan.logicalTrack, apiTrack: plan.apiTrack, versionCode: plan.versionCode, versionName: plan.versionName, aabSha256: sha256(aab), uploadCertificateSha256: plan.certificateSha256 };
    onReceipt(receipt);
    await client.commit(id);
    committed = true;
    receipt.status = "committed-readback-unverified";
    onReceipt(receipt);
    const readbackId = await client.insert();
    try { requireRelease(await client.getTrack(readbackId, plan.apiTrack), plan.apiTrack, plan.versionCode); }
    finally { await client.delete(readbackId); }
    receipt.status = "committed-and-read-back";
    receipt.verifiedAt = new Date().toISOString();
    onReceipt(receipt);
    return receipt;
  } finally { if (!committed) { try { await client.delete(id); } catch { /* The edit may already have been committed; never retry a commit automatically. */ } } }
}

function authConfiguration() {
  if (!/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(process.env.PLAY_WORKLOAD_IDENTITY_PROVIDER ?? "")) throw new Error("PLAY_WORKLOAD_IDENTITY_PROVIDER is missing or invalid");
  if (!/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(process.env.PLAY_SERVICE_ACCOUNT ?? "")) throw new Error("PLAY_SERVICE_ACCOUNT is missing or invalid");
}

function expectedPlan() {
  const inputs = validateBuildInputs({ sourceSha: process.env.SOURCE_SHA, versionCode: process.env.VERSION_CODE, lastPlayVersionCode: process.env.LAST_PLAY_VERSION_CODE, versionName: process.env.VERSION_NAME, certificateSha256: process.env.ANDROID_UPLOAD_CERT_SHA256 });
  const logicalTrack = process.env.LOGICAL_TRACK;
  const apiTrack = process.env.API_TRACK;
  resolveTrack(logicalTrack, process.env.PLAY_INTERNAL_TRACK, [{ track: apiTrack }]);
  return { ...inputs, logicalTrack, apiTrack, workflowSha: process.env.BUILD_WORKFLOW_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.BUILD_RUN_ATTEMPT };
}

export function verifyArtifactMetadata(directory, plan) {
  const provenance = JSON.parse(fs.readFileSync(path.join(directory, "build-provenance.json"), "utf8"));
  for (const [field, expected] of Object.entries({ repository: "hebi10/travelframe", sourceSha: plan.sourceSha, workflowSha: plan.workflowSha, runId: plan.runId, runAttempt: plan.runAttempt, packageId: PACKAGE, versionName: plan.versionName, versionCode: plan.versionCode, confirmedPreviousPlayVersionCode: plan.lastPlayVersionCode, uploadCertificateSha256: plan.certificateSha256 })) if (provenance[field] !== expected) throw new Error(`Artifact provenance mismatch: ${field}`);
  const aab = path.join(directory, `BodyFrame-${plan.versionName}-${plan.versionCode}.aab`);
  const mapping = path.join(directory, "mapping.txt");
  if (sha256(aab) !== provenance.aabSha256 || sha256(mapping) !== provenance.mappingSha256 || fs.statSync(mapping).size === 0) throw new Error("Artifact AAB/mapping hash mismatch");
  return { aab, mapping };
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Downloaded AAB verification failed; command output withheld");
  return result.stdout;
}

function verifySourceAncestry(sourceDirectory, sourceSha, mainSha) {
  if (!/^[a-f0-9]{40}$/.test(mainSha ?? "")) throw new Error("The run must identify an exact main commit");
  const git = (...arguments_) => {
    const result = spawnSync("git", arguments_, { cwd: sourceDirectory, encoding: "utf8" });
    if (result.error || result.status !== 0) throw new Error("Release source must be an ancestor of the run's main commit; complete Git history is required");
    return result.stdout.trim();
  };
  if (git("rev-parse", "HEAD") !== sourceSha) throw new Error("Source checkout SHA does not match source_sha");
  git("rev-parse", "--verify", `${mainSha}^{commit}`);
  git("merge-base", "--is-ancestor", sourceSha, mainSha);
}

function verifyArtifact(plan) {
  const files = verifyArtifactMetadata(process.env.AAB_ARTIFACT_DIR, plan);
  if (sha256(process.env.BUNDLETOOL_JAR) !== BUNDLETOOL_SHA256) throw new Error("Pinned bundletool SHA-256 mismatch");
  run("java", ["-jar", process.env.BUNDLETOOL_JAR, "validate", "--bundle", files.aab]);
  const manifest = run("java", ["-jar", process.env.BUNDLETOOL_JAR, "dump", "manifest", "--bundle", files.aab, "--module", "base"]);
  const manifestPath = path.join(process.env.RUNNER_TEMP, "publish-bundle-manifest.xml");
  fs.writeFileSync(manifestPath, manifest);
  run("java", [path.join(path.dirname(fileURLToPath(import.meta.url)), "VerifyPlayBundle.java"), files.aab, plan.certificateSha256, manifestPath, String(plan.versionCode), plan.versionName]);
  return files;
}

async function main() {
  const command = process.argv[2];
  if (command === "resolve") {
    const request = resolveRequest(process.env);
    requirePlayPublishWindow(request.operation);
    authConfiguration();
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `source_sha=${request.sourceSha}\nlogical_track=${request.logicalTrack}\noperation=${request.operation}\n`);
  } else if (command === "check-source") {
    const request = resolveRequest(process.env);
    verifySourceAncestry(process.env.SOURCE_DIR, request.sourceSha, process.env.GITHUB_SHA);
    console.log(`Verified release source ${request.sourceSha} belongs to the run's main history`);
  } else if (command === "plan") {
    const request = resolveRequest(process.env);
    requirePlayPublishWindow(request.operation);
    const client = createPublisher(process.env.PLAY_ACCESS_TOKEN);
    if (request.operation === "inventory") {
      console.log(JSON.stringify(await inspectInventory(client, process.env.PLAY_INTERNAL_TRACK)));
      return;
    }
    const app = JSON.parse(fs.readFileSync(path.join(process.env.SOURCE_DIR, "app.json"), "utf8"));
    if (app.expo?.android?.package !== PACKAGE) throw new Error("Source package is not Body Frame");
    const plan = await planRelease(client, { ...request, internalTrack: process.env.PLAY_INTERNAL_TRACK, versionCode: process.env.INPUT_VERSION_CODE, versionName: process.env.INPUT_VERSION_NAME || app.expo.version, certificateSha256: process.env.ANDROID_UPLOAD_CERT_SHA256 });
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version_code=${plan.versionCode}\nlast_play_version_code=${plan.lastPlayVersionCode}\nversion_name=${plan.versionName}\napi_track=${plan.apiTrack}\n`);
    console.log(`Planned ${PACKAGE}, ${plan.apiTrack}, version ${plan.versionName} (${plan.versionCode}), source ${plan.sourceSha}; current API maximum ${plan.lastPlayVersionCode}`);
  } else if (command === "verify-artifact") {
    const plan = expectedPlan();
    verifyArtifact(plan);
    console.log(`Verified downloaded AAB for ${PACKAGE}, ${plan.apiTrack}, version ${plan.versionCode}, source ${plan.sourceSha}`);
  } else if (command === "publish") {
    requirePlayPublishWindow("publish");
    const plan = expectedPlan();
    const files = verifyArtifactMetadata(process.env.AAB_ARTIFACT_DIR, plan);
    const receiptPath = path.join(process.env.PLAY_RECEIPT_DIR, "play-release-receipt.json");
    fs.mkdirSync(process.env.PLAY_RECEIPT_DIR, { recursive: true });
    const receipt = await publishRelease(createPublisher(process.env.PLAY_ACCESS_TOKEN), plan, files.aab, files.mapping, (value) => fs.writeFileSync(receiptPath, JSON.stringify(value, null, 2) + "\n"));
    console.log(`Committed and read back ${receipt.packageId}, ${receipt.apiTrack}, version ${receipt.versionCode}, source ${receipt.sourceSha}`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Play test release committed and read back: \`${PACKAGE}\`, \`${receipt.apiTrack}\`, \`${receipt.versionName} (${receipt.versionCode})\`, source \`${receipt.sourceSha}\`. Play processing, review and tester delivery can take additional time.\n`);
  } else throw new Error("Expected resolve, check-source, plan, verify-artifact or publish command");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`Play release failed: ${error.message}`); process.exitCode = 1; });

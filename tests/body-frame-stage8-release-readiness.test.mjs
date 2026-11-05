import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const app = JSON.parse(read("app.json"));
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const publisher = read("scripts/publish-play-release.mjs");
const workflow = read(".github/workflows/android-play-aab.yml");
const versionName = "1.0.32";

assert.equal(app.expo.version, versionName, "Expo display version must match the reviewed candidate");
assert.equal(pkg.version, versionName, "package.json must carry the same display version");
assert.equal(lock.version, versionName, "package-lock.json root version must be synchronized");
assert.equal(lock.packages[""].version, versionName, "npm root package version must be synchronized");
assert.equal(app.expo.android.package, "com.haebi.photoguide", "Play app identity must be preserved");
assert.ok(pkg.dependencies["react-native-view-recorder"], "Native recorder dependency must be retained");

const planStart = workflow.indexOf("\n  plan:");
const buildStart = workflow.indexOf("\n  build:", planStart);
const publishStart = workflow.indexOf("\n  publish:", buildStart);
assert.ok(planStart >= 0 && buildStart > planStart && publishStart > buildStart);

const plan = workflow.slice(planStart, buildStart);
assert.ok(
  plan.includes("vars.BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'"),
  "Play AAB build/publish must remain gated until upload signing is verified"
);
assert.ok(plan.includes("inputs.operation == 'inventory'"), "Read-only inventory must remain available");
assert.ok(plan.includes("Require existing signing secrets before contacting Play"));
assert.ok(plan.includes("fetch-depth: 0"), "Release ancestry check needs full Git history");
assert.ok(plan.includes("scripts/publish-play-release.mjs check-source"));
assert.ok(plan.includes("tests/play-release-state.test.mjs"));
assert.ok(plan.includes("tests/play-source.test.mjs"));
assert.ok(workflow.slice(buildStart, publishStart).includes("needs: plan"));
assert.ok(workflow.slice(publishStart).includes("needs: [plan, build]"));

assert.ok(publisher.includes("function requireReplaceableTarget(tracks, apiTrack)"));
assert.ok(publisher.includes("requireReplaceableTarget(snapshot.tracks, apiTrack)"));
assert.ok(publisher.includes("requireReplaceableTarget(snapshot.tracks, plan.apiTrack)"));
assert.ok(publisher.includes('release.status === "completed"'));
assert.ok(publisher.includes('release.status === "draft"'));
assert.ok(publisher.includes("function verifySourceAncestry(sourceDirectory, sourceSha, mainSha)"));
assert.ok(publisher.includes('git("merge-base", "--is-ancestor", sourceSha, mainSha)'));
assert.ok(publisher.includes('command === "check-source"'));
assert.ok(!workflow.includes("refs/heads/production"), "Production publishing must not be added");

console.log("ok - Stage 8 Play release candidate metadata, source/track safety and signing approval gate");

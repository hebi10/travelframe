import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/android-play-aab.yml", "utf8");
assert.ok(workflow.includes("push:\n    branches: [main]"), "main CI trigger must remain configured");
assert.ok(workflow.includes("workflow_dispatch:"), "Manual CI mode must be available");
assert.ok(workflow.includes("options: [check, build, deploy]"));
assert.ok(workflow.includes("options: [internal, closed]"));

const start = workflow.indexOf("\n  plan:");
const end = workflow.indexOf("\n  build:", start);
const publish = workflow.indexOf("\n  publish:", end);
assert.ok(start > 0 && end > start && publish > end, "Play jobs must preserve plan / build / publish sequence");

const plan = workflow.slice(start, end);
const build = workflow.slice(end, publish);
const release = workflow.slice(publish);

for (const required of [
  "github.repository == 'hebi10/travelframe'",
  "github.ref == 'refs/heads/main'",
  "github.event_name == 'workflow_dispatch'",
  "inputs.mode == 'check'",
  "vars.BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'",
  "github.event_name == 'push'",
  "contains(github.event.head_commit.message, '[deploy-internal]')",
  "contains(github.event.head_commit.message, '[deploy-closed]')",
  "RELEASE_COMMIT_MESSAGE: ${{ github.event.head_commit.message }}"
]) {
  assert.ok(plan.includes(required), "Missing explicit Play gate: " + required);
}
assert.ok(/name: Verify the upload keystore before contacting Play\n\s+if: steps\.resolve\.outputs\.operation == 'publish'/.test(plan));
assert.ok(build.includes("needs.plan.outputs.mode == 'build' || needs.plan.outputs.mode == 'deploy'"));
assert.ok(build.includes("needs: plan"));
assert.ok(release.includes("needs: [plan, build]"));
assert.ok(release.includes("needs.plan.outputs.mode == 'deploy'"));
assert.ok(workflow.includes("ops01_release_approved:"), "final manual release approval input must be present");
assert.ok(release.includes("github.event_name == 'workflow_dispatch' && inputs.ops01_release_approved == true"), "push-triggered release builds must not publish");
assert.ok(release.includes("scripts/publish-play-release.mjs publish"));
assert.ok(!workflow.includes("refs/heads/production"), "Play must never publish to production");

const firebase = fs.readFileSync(".github/workflows/firebase-backend-release.yml", "utf8");
assert.ok(firebase.includes("workflow_dispatch:"));
assert.ok(!firebase.includes("\n  push:") && !firebase.includes("\n  pull_request:"));
assert.ok(firebase.includes("options: [check, deploy]"));
assert.ok(firebase.includes("environment: travelframe-firebase-backend-production"));
assert.ok(firebase.includes("vars.TRAVELFRAME_FIREBASE_BACKEND_APPROVED == 'true'"));
assert.ok(firebase.includes("inputs.confirmation == 'DEPLOY_TRAVELFRAME_FIREBASE_BACKEND'"));
assert.ok(firebase.includes("node scripts/verify-firebase-backend-release.mjs"));
assert.ok(firebase.includes("firebase deploy --only functions --project travelframe-4e1fb --non-interactive"));
assert.ok(!firebase.includes("androidpublisher") && !firebase.includes("play-deploy"));
assert.ok(!workflow.includes("firebase deploy --only functions"), "Play workflow must not deploy Firebase");

console.log("ok - explicit Play test-release intent and independent manual Firebase server gate");

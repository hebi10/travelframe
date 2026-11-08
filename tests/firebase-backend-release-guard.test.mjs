import assert from "node:assert/strict";
import test from "node:test";
import { verifyFirebaseBackendRelease } from "../scripts/verify-firebase-backend-release.mjs";

const approved = {
  GITHUB_REPOSITORY: "hebi10/travelframe",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  FIREBASE_BACKEND_DEPLOY_MODE: "deploy",
  FIREBASE_BACKEND_CONFIRM: "DEPLOY_TRAVELFRAME_FIREBASE_BACKEND",
  FIREBASE_BACKEND_RELEASE_APPROVED: "true",
  FIREBASE_BACKEND_PROJECT_ID: "travelframe-4e1fb",
  FIREBASE_BACKEND_SERVICE_ACCOUNT: "travelframe-functions@travelframe-4e1fb.iam.gserviceaccount.com",
  FIREBASE_BACKEND_WIF_PROVIDER: "projects/123456/locations/global/workloadIdentityPools/travelframe/providers/github"
};

test("approved manual Firebase backend target is an exact single reviewed project", () => {
  assert.deepEqual(verifyFirebaseBackendRelease(approved), { projectId: "travelframe-4e1fb" });
});

for (const [name,change] of [
  ["reject foreign GitHub repository", { GITHUB_REPOSITORY: "other/repo" }],
  ["reject feature branches", { GITHUB_REF: "refs/heads/feature/foo" }],
  ["reject main pushes", { GITHUB_EVENT_NAME: "push" }],
  ["reject pull requests", { GITHUB_EVENT_NAME: "pull_request" }],
  ["reject check-only workflows", { FIREBASE_BACKEND_DEPLOY_MODE: "check" }],
  ["reject missing exact confirmation", { FIREBASE_BACKEND_CONFIRM: "deploy" }],
  ["reject unapproved deployment", { FIREBASE_BACKEND_RELEASE_APPROVED: "false" }],
  ["reject staging or unrelated Firebase project", { FIREBASE_BACKEND_PROJECT_ID: "travelframe-staging" }],
  ["reject Play Publisher service account", { FIREBASE_BACKEND_SERVICE_ACCOUNT: "play@hebi-app-release-80847404.iam.gserviceaccount.com" }],
  ["reject absent identity provider", { FIREBASE_BACKEND_WIF_PROVIDER: "" }]
]) {
  test(name, () => assert.throws(() => verifyFirebaseBackendRelease({ ...approved, ...change })));
}

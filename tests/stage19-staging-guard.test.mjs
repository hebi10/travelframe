import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { verifyStagingTarget } from "../scripts/stage19-staging-guard.mjs";

const production = JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
const valid = {
  stageProjectId: "travelframe-staging-verify",
  approvedProjectId: "travelframe-staging-verify",
  productionProjectId: production,
  storageBucket: "travelframe-staging-verify.firebasestorage.app",
  approvalFlag: "true",
  serviceAccount: "staging-runner@travelframe-staging-verify.iam.gserviceaccount.com",
  identityProvider: "projects/123456789/locations/global/workloadIdentityPools/github/providers/travelframe"
};

test("staging preflight validates an exact separate project and bucket", () => {
  assert.deepEqual(verifyStagingTarget(valid), {
    projectId: valid.stageProjectId,
    storageBucket: valid.storageBucket
  });
});

for (const [name,change] of [
  ["reject production", { stageProjectId: production, approvedProjectId: production }],
  ["reject unconfigured project", { approvedProjectId: undefined }],
  ["reject unapproved deploy", { approvalFlag: "false" }],
  ["reject demo emulator project", { stageProjectId: "demo-travelframe", approvedProjectId: "demo-travelframe" }],
  ["reject bucket for wrong project", { storageBucket: "travelframe-4e1fb.appspot.com" }],
  ["reject service account in production project", { serviceAccount: "staging-runner@" + production + ".iam.gserviceaccount.com" }],
  ["reject missing WIF identity provider", { identityProvider: "" }]
]) {
  test(name, () => assert.throws(() => verifyStagingTarget({ ...valid, ...change })));
}

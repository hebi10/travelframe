import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { verifyStagingTarget } from "./stage19-staging-guard.mjs";

const root = path.resolve(".");
const rc = JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8"));
const { projectId, storageBucket } = verifyStagingTarget({
  stageProjectId: process.env.STAGE19_STAGING_PROJECT_ID,
  approvedProjectId: process.env.STAGE19_APPROVED_PROJECT_ID,
  productionProjectId: rc.projects.default,
  storageBucket: process.env.STAGE19_STAGING_STORAGE_BUCKET,
  approvalFlag: process.env.STAGE19_STAGING_DEPLOY_APPROVED,
  serviceAccount: process.env.STAGE19_STAGING_SERVICE_ACCOUNT,
  identityProvider: process.env.STAGE19_STAGING_WIF_PROVIDER
});

for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  assert.ok(!process.env[key], "Real staging test must not connect to an emulator: " + key);
}
const requireFunctions = createRequire(path.join(root, "functions", "index.js"));
const { initializeApp, deleteApp } = requireFunctions("firebase-admin/app");
const { getFirestore, FieldValue } = requireFunctions("firebase-admin/firestore");
const { getStorage } = requireFunctions("firebase-admin/storage");
const { getAuth } = requireFunctions("firebase-admin/auth");

const app = initializeApp({ projectId, storageBucket }, "stage19-staging-proof");
const db = getFirestore(app);
const bucket = getStorage(app).bucket(storageBucket);
const auth = getAuth(app);
const id = crypto.randomBytes(8).toString("hex");
const testUid = "stage19-ci-" + id;
const doc = db.doc("stage19Integration/" + id);
const file = bucket.file("stage19-ci/" + id + ".txt");
const report = {
  projectId,
  sourceSha: process.env.GITHUB_SHA ?? "unknown",
  liveEnvironment: "isolated-staging-only",
  didUseProduction: false,
  cases: [],
  passed: false
};
const casePassed = (label) => report.cases.push({ name: label, status: "PASS" });
let docCreated = false;
let fileCreated = false;
let userCreated = false;
let failure = null;
const scrub = (message) => String(message).replace(/Bearer\s+\S+/gi, "[REDACTED]").slice(0, 300);

async function denyUnauthenticatedCallable(name) {
  const url = "https://us-central1-" + projectId + ".cloudfunctions.net/" + name;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} }),
    signal: AbortSignal.timeout(20000)
  });
  assert.ok([401, 403].includes(response.status),
    name + " must reject unauthenticated calls: HTTP " + response.status);
  await response.arrayBuffer();
  casePassed(name + " unauthenticated request rejected");
}

try {
  await doc.set({ stage19: true, createdAt: FieldValue.serverTimestamp() });
  docCreated = true;
  await db.runTransaction(async (transaction) => {
    const found = await transaction.get(doc);
    assert.equal(found.data()?.stage19, true);
    transaction.update(doc, { writes: FieldValue.increment(1) });
  });
  assert.equal((await doc.get()).data()?.writes, 1);
  casePassed("Cloud Firestore Admin 14 transaction");

  await file.save(Buffer.from("stage19-isolated-staging-" + id), {
    resumable: false,
    contentType: "text/plain"
  });
  fileCreated = true;
  const [contents] = await file.download();
  assert.equal(contents.toString("utf8"), "stage19-isolated-staging-" + id);
  casePassed("Cloud Storage Admin 14 save/read");

  await auth.createUser({ uid: testUid, email: testUid + "@example.test" });
  userCreated = true;
  const user = await auth.getUser(testUid);
  assert.equal(user.uid, testUid);
  casePassed("Firebase Auth Admin 14 create/read");

  for (const name of [
    "verifyGooglePlayPurchase",
    "deleteAdminCloudBackupData",
    "setAdminProductSubscription",
    "getAdminBackupCapabilities"
  ]) {
    await denyUnauthenticatedCallable(name);
  }
  assert.equal((await doc.get()).data()?.writes, 1);
  casePassed("Denied requests did not alter staging test data");
  report.passed = true;
} catch (error) {
  failure = error;
  report.failure = scrub(error instanceof Error ? error.message : error);
} finally {
  const cleanup = await Promise.allSettled([
    ...(docCreated ? [doc.delete()] : []),
    ...(fileCreated ? [file.delete({ ignoreNotFound: true })] : []),
    ...(userCreated ? [auth.deleteUser(testUid)] : [])
  ]);
  const deletedApp = await Promise.allSettled([deleteApp(app)]);
  const unsuccessful = [...cleanup, ...deletedApp].filter((item) => item.status === "rejected");
  report.cleanup = unsuccessful.length ? "FAILED" : "PASS";
  if (unsuccessful.length) {
    report.passed = false;
    report.cleanupFailureCount = unsuccessful.length;
  }
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/stage19-staging-cloud-integration.json", JSON.stringify(report, null, 2) + "\n");
}

if (failure || !report.passed) {
  throw new Error("Staging-only cloud integration failed; inspect the redacted CI artifact and confirm cleanup");
}
console.log("Stage19 staging cloud checks successful: " + report.cases.length + " checks, cleanup verified. Production untouched.");

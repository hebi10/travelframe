import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const projectId = "demo-travelframe-stage19";
const appId = "stage19-functions-emulator-integration";
const requiredHosts = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FUNCTIONS_EMULATOR_HOST"];
assert.equal(process.env.STAGE19_PROJECT_ID, projectId, "Only the isolated demo test project may be used");
for (const name of requiredHosts) {
  assert.ok(process.env[name] && /^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name]), name + " must target a loopback emulator");
}
assert.equal(process.env.FUNCTIONS_ENABLE_ADMIN_BACKUP_DELETION, "false");
assert.equal(process.env.FUNCTIONS_ENABLE_ADMIN_FULL_BACKUP_DELETION, "false");
assert.ok(!process.env.GOOGLE_APPLICATION_CREDENTIALS, "Do not supply live cloud credentials to this test");

const requireFunctions = createRequire(path.resolve("functions/index.js"));
const { initializeApp, deleteApp } = requireFunctions("firebase-admin/app");
const { getFirestore, FieldValue } = requireFunctions("firebase-admin/firestore");
const { getStorage } = requireFunctions("firebase-admin/storage");
const { getAuth } = requireFunctions("firebase-admin/auth");
const app = initializeApp({ projectId, storageBucket: projectId + ".appspot.com" }, appId);
const db = getFirestore(app);
const storage = getStorage(app).bucket();
const auth = getAuth(app);
const suffix = crypto.randomBytes(6).toString("hex");
const uid = "stage19-owner-" + suffix;
const owner = db.doc("users/" + uid);
const audit = db.doc("users/" + uid + "/backupUsage/current");
const name = "users/" + uid + "/backups/stage19-qa/integration.txt";
const file = storage.file(name);
const evidence = { projectId, node: process.version, mode: "Firebase Emulator Suite only", cases: [], liveCloudTouched: false };

const mark = (name, status) => evidence.cases.push({ name, status });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callable(name, data = {}, idToken = null) {
  const url = "http://" + process.env.FUNCTIONS_EMULATOR_HOST + "/" + projectId + "/us-central1/" + name;
  let lastError;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: "Bearer " + idToken } : {})
        },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(8000)
      });
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }
  throw new Error("Callable endpoint unavailable: " + name + ": " + (lastError?.message ?? ""));
}

async function assertDenied(name, data, token, label) {
  const response = await callable(name, data, token);
  assert.ok([401, 403].includes(response.status), label + " must deny access, received HTTP " + response.status);
  const body = await response.json();
  assert.ok(body?.error, label + " must return callable error payload");
  mark(label, "denied");
}

try {
  await owner.set({ stage19Test: true, createdAt: Date.now() });
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(owner);
    assert.equal(snapshot.data()?.stage19Test, true);
    transaction.set(audit, { count: FieldValue.increment(1) }, { merge: true });
  });
  assert.equal((await audit.get()).data()?.count, 1);
  mark("Admin 14 Firestore transaction and write/read", "pass");

  const bytes = Buffer.from("stage19-emulator-only-" + suffix, "utf8");
  await file.save(bytes, { resumable: false, contentType: "text/plain" });
  const [readBack] = await file.download();
  assert.deepEqual(readBack, bytes);
  mark("Admin 14 Storage upload/read", "pass");

  const anonymousFirestore = await fetch("http://" + process.env.FIRESTORE_EMULATOR_HOST +
    "/v1/projects/" + projectId + "/databases/(default)/documents/users/" + uid);
  assert.ok([401, 403].includes(anonymousFirestore.status), "Anonymous Firestore user data must remain private");
  mark("Firestore Rules unauthenticated read", "denied");

  const anonymousStorage = await fetch("http://" + process.env.FIREBASE_STORAGE_EMULATOR_HOST +
    "/v0/b/" + projectId + ".appspot.com/o/" + encodeURIComponent(name) + "?alt=media");
  assert.ok([401, 403].includes(anonymousStorage.status), "Anonymous Storage object read must be denied");
  mark("Storage Rules unauthenticated read", "denied");

  await assertDenied("verifyGooglePlayPurchase", { productId: "creator_monthly" }, null, "Anonymous Play purchase verification");
  await assertDenied("deleteAdminCloudBackupData", { targetUid: uid, confirmationUid: uid }, null, "Anonymous destructive backup request");

  const signUp = await fetch("http://" + process.env.FIREBASE_AUTH_EMULATOR_HOST +
    "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=stage19-emulator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "stage19-" + suffix + "@example.test",
        password: crypto.randomBytes(24).toString("hex"),
        returnSecureToken: true
      })
    });
  assert.ok(signUp.ok, "Auth emulator account creation failed: HTTP " + signUp.status);
  const credential = await signUp.json();
  assert.ok(credential.idToken && credential.localId, "Auth emulator must issue an ID token");
  await assertDenied("getAdminBackupCapabilities", {}, credential.idToken, "Non-admin cannot inspect destructive capabilities");
  await assertDenied("setAdminProductSubscription", { targetUid: uid, productId: "expert_monthly", status: "active" }, credential.idToken, "Non-admin cannot grant paid subscriptions");
  assert.equal((await owner.get()).data()?.stage19Test, true, "Denied calls must not corrupt owner records");
  assert.equal((await audit.get()).data()?.count, 1, "Denied calls must not alter usage");
  mark("Existing Firestore data intact after rejected callables", "pass");

  await auth.deleteUser(credential.localId);
  mark("Auth emulator identity removal", "pass");
} finally {
  await Promise.allSettled([file.delete({ ignoreNotFound: true }), audit.delete(), owner.delete()]);
  await deleteApp(app);
}
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/stage19-firebase-emulator-integration.json", JSON.stringify(evidence, null, 2) + "\n", "utf8");
console.log("Stage19 isolated Firebase integration passed: " + evidence.cases.length + " checks; production service untouched.");

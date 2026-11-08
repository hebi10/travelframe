import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("functions/index.js", "utf8");
const billing = fs.readFileSync("functions/google-play-billing.js", "utf8");
const packageJson = JSON.parse(fs.readFileSync("functions/package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("functions/package-lock.json", "utf8"));

test("Functions initialize exactly one app and access Firestore/Storage through public modular APIs", () => {
  for (const required of [
    'require("firebase-admin/app")',
    'require("firebase-admin/firestore")',
    'require("firebase-admin/storage")',
    "const app = initializeApp();",
    "const db = getFirestore(app);",
    "const bucket = getStorage(app).bucket();",
    "const { getFirestore, FieldValue, Timestamp }",
    "const googlePlayBilling = createGooglePlayBillingService({",
    "  db,",
    "  FieldValue,",
    "  HttpsError"
  ]) assert.ok(source.includes(required), `Missing modular API contract: ${required}`);

  assert.equal(source.includes('require("firebase-admin")'), false);
  assert.doesNotMatch(source, /admin\.(initializeApp|firestore|storage)\s*\(/);
  assert.equal((source.match(/Timestamp\.fromMillis\(/g) ?? []).length, 3);
  assert.ok(source.includes("FUNCTIONS_ENFORCE_APP_CHECK"));
  assert.ok(source.includes("FUNCTIONS_ENABLE_ADMIN_BACKUP_DELETION"));
  assert.ok(source.includes("FUNCTIONS_ENABLE_ADMIN_FULL_BACKUP_DELETION"));
});

test("Google Play billing keeps the same database and timestamp injection without unused legacy Admin namespace", () => {
  const signature = billing.split("const createGooglePlayBillingService = (")[1]?.split("}) =>")[0];
  assert.ok(signature, "Billing factory signature must exist");
  assert.ok(signature.includes("db,"));
  assert.ok(signature.includes("FieldValue,"));
  assert.ok(signature.includes("HttpsError"));
  assert.doesNotMatch(signature, /\badmin\b/);
  assert.ok(billing.includes("createBillingVerificationGate({ db, HttpsError })"));
});

test("Server dependency versions stay unchanged until independent SDK upgrade and production QA", () => {
  assert.equal(packageJson.dependencies["firebase-admin"], "^13.10.0");
  assert.equal(packageJson.dependencies["firebase-functions"], "^6.2.0");
  assert.equal(lock.packages["node_modules/firebase-admin"]?.version, "13.10.0");
  assert.equal(lock.packages["node_modules/firebase-functions"]?.version, "6.6.0");
  assert.equal(packageJson.engines.node, "22");
  assert.ok(packageJson.scripts["runtime:deps"].includes("firebase-admin/firestore"));
  assert.ok(packageJson.scripts["runtime:deps"].includes("firebase-admin/storage"));
  assert.equal(packageJson.scripts["runtime:deps"].includes("google-gax/build/src/fallback"), false);
});

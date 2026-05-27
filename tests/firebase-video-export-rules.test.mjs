import assert from "node:assert/strict";
import fs from "node:fs";

const firestoreRules = fs.readFileSync("firestore.rules", "utf8");

for (const snippet of [
  "function isActiveSubscription(userId, productId)",
  "function weeklyVideoExportLimitForUser(userId)",
  "match /usage/{usageGroup}/weeks/{weekId}",
  "allow create, update: if false;",
  "allow delete: if isAdmin();"
]) {
  assert.ok(firestoreRules.includes(snippet), `weekly video export rules should be server-owned: ${snippet}`);
}

console.log("ok - Firestore rules keep weekly video export usage server-owned");

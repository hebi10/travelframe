import assert from "node:assert/strict";
import fs from "node:fs";

const firestoreRules = fs.readFileSync("firestore.rules", "utf8");

for (const snippet of [
  "function isActiveSubscription(userId, productId)",
  "function weeklyVideoExportLimitForUser(userId)",
  "request.resource.data.count <= weeklyVideoExportLimitForUser(userId)",
  "request.resource.data.limit == weeklyVideoExportLimitForUser(userId)"
]) {
  assert.ok(firestoreRules.includes(snippet), `weekly video export rules missing: ${snippet}`);
}

console.log("ok - Firestore rules allow weekly video export usage by active plan limit");

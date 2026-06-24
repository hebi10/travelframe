import assert from "node:assert/strict";
import fs from "node:fs";

const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");
const planEntitlementsSource = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
const accountSource = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");

assert.ok(
  subscriptionSource.includes('"local_checkout"'),
  "temporary in-app checkout must be marked separately from verified providers"
);
assert.ok(
  subscriptionSource.includes('provider: "local_checkout"'),
  "temporary checkout should be fulfilled through the local checkout adapter"
);
assert.ok(
  !planEntitlementsSource.includes('provider === "local_checkout"') &&
    planEntitlementsSource.includes("PLAN_ENTITLEMENTS[getPlanTier(params)]"),
  "completed local checkout should behave like a real Pro entitlement until Play Billing replaces it"
);
assert.ok(
  accountSource.includes("planEntitlements.canBackupToCloud"),
  "account backup permission display should follow actual cloud backup entitlement"
);

console.log("ok - local checkout unlocks Pro backup entitlement");

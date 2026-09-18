import assert from "node:assert/strict";
import fs from "node:fs";

const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");
const planEntitlementsSource = fs.readFileSync("lib/plan-entitlements.ts", "utf8");
const accountSource = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const billingHookSource = fs.readFileSync(
  "features/account/hooks/useGooglePlayBilling.ts",
  "utf8"
);

assert.equal(
  subscriptionSource.includes('provider: "local_checkout"'),
  false,
  "local checkout must not grant Pro backup entitlement"
);
assert.ok(
  subscriptionSource.includes('provider: "none" | "admin" | "google_play"'),
  "only server/admin verified providers should remain valid"
);
assert.ok(
  billingHookSource.includes("verifyGooglePlayPurchase") &&
    billingHookSource.includes("refreshUser"),
  "Google Play purchase must refresh server-backed entitlement after verification"
);
assert.ok(
  !planEntitlementsSource.includes('provider === "local_checkout"') &&
    planEntitlementsSource.includes("PLAN_ENTITLEMENTS[getPlanTier(params)]"),
  "backup entitlement should derive from the verified subscription tier"
);
assert.ok(
  accountSource.includes("planEntitlements.canBackupToCloud"),
  "account backup permission display should follow verified cloud backup entitlement"
);

console.log("ok - Google Play verified subscription gates Pro backup entitlement");

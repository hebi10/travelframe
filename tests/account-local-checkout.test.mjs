import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const authSource = fs.readFileSync("lib/auth-context.tsx", "utf8");
const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");
const billingHookSource = fs.readFileSync(
  "features/account/hooks/useGooglePlayBilling.ts",
  "utf8"
);

assert.ok(
  accountSource.includes("useGooglePlayBilling") &&
    accountSource.includes("purchaseProduct("),
  "account payment button should route through Google Play Billing"
);
assert.ok(
  accountSource.includes("restorePurchases") &&
    accountSource.includes("구매 복원"),
  "account payment UI should expose Google Play purchase restore"
);
assert.equal(
  authSource.includes("purchaseProduct:"),
  false,
  "AuthContext must not expose local purchase completion"
);
assert.equal(
  subscriptionSource.includes("saveLocalCheckoutSubscription"),
  false,
  "subscription library must not grant local paid entitlement"
);
assert.ok(
  billingHookSource.includes("verifyGooglePlayPurchase") &&
    billingHookSource.includes("finishTransaction"),
  "purchase fulfillment must verify on the server before finishing the transaction"
);
assert.ok(
  billingHookSource.indexOf("verifyGooglePlayPurchase") <
    billingHookSource.lastIndexOf("finishTransaction"),
  "server verification should be part of the fulfillment path before transaction finish"
);

console.log("ok - account checkout uses server-verified Google Play Billing");

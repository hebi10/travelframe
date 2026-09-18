import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const firestoreRules = read("firestore.rules");
const subscriptionSource = read("lib/subscription.ts");
const authContextSource = read("lib/auth-context.tsx");
const accountSource = read("features/account/AccountScreen.tsx");
const billingSource = read("lib/google-play-billing.ts");
const billingHookSource = read("features/account/hooks/useGooglePlayBilling.ts");
const functionsSource = read("functions/index.js");
const serverBillingSource = read("functions/google-play-billing.js");

assert.equal(
  firestoreRules.includes("isOwner(userId) && isMockSubscription"),
  false,
  "owners must not be able to write mock subscription documents"
);
assert.equal(
  firestoreRules.includes("isOwner(userId) && isMockPaymentEvent"),
  false,
  "owners must not be able to create mock payment events"
);
assert.ok(
  firestoreRules.includes("match /subscriptions/{subscriptionId}") &&
    firestoreRules.includes("allow create, update, delete: if false;"),
  "subscription writes should be blocked from client rules"
);
assert.ok(
  firestoreRules.includes("match /paymentEvents/{eventId}") &&
    firestoreRules.includes("allow create, update, delete: if false;"),
  "payment event writes should be blocked from client rules"
);
assert.ok(
  firestoreRules.includes("match /googlePlayPurchases/{purchaseId}") &&
    firestoreRules.includes("match /unresolvedGooglePlayNotifications/{notificationId}"),
  "Google Play tokens and unresolved billing notifications must stay server-only"
);

for (const [file, source] of [
  ["lib/subscription.ts", subscriptionSource],
  ["lib/auth-context.tsx", authContextSource],
  ["features/account/AccountScreen.tsx", accountSource]
]) {
  assert.equal(source.includes("activateMockSubscription"), false, `${file} must not expose mock subscription activation`);
  assert.equal(source.includes("startMockSubscription"), false, `${file} must not expose mock subscription activation`);
  assert.equal(source.includes("mock_payment_completed"), false, `${file} must not create mock payment events`);
}

assert.equal(
  subscriptionSource.includes("saveLocalCheckoutSubscription"),
  false,
  "local checkout must not grant entitlement"
);
assert.equal(
  authContextSource.includes("purchaseProduct:"),
  false,
  "AuthContext must not own purchase fulfillment"
);
assert.ok(
  accountSource.includes("useGooglePlayBilling") &&
    billingSource.includes("verifyGooglePlayPurchase") &&
    billingHookSource.includes("finishTransaction"),
  "account purchase flow must route through Google Play and server verification"
);
assert.ok(
  functionsSource.includes("exports.verifyGooglePlayPurchase = secureOnCall") &&
    serverBillingSource.includes("googlePlayPurchases"),
  "server must own purchase verification and token ownership"
);

console.log("ok - subscription entitlement writes are server-verified and client-blocked");

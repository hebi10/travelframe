import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");
const authSource = fs.readFileSync("lib/auth-context.tsx", "utf8");
const accountSource = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const firestoreRules = fs.readFileSync("firestore.rules", "utf8");

assert.equal(
  packageJson.dependencies?.["expo-iap"],
  "5.6.2",
  "Stage 6 must pin expo-iap 5.6.2"
);
assert.ok(
  appJson.expo?.plugins?.some((plugin) =>
    Array.isArray(plugin) ? plugin[0] === "expo-iap" : plugin === "expo-iap"
  ),
  "app config must install the expo-iap config plugin"
);

assert.ok(
  fs.existsSync("lib/google-play-billing.ts"),
  "Google Play billing adapter must exist"
);
assert.ok(
  fs.existsSync("features/account/hooks/useGooglePlayBilling.ts"),
  "Google Play billing hook must exist"
);
assert.ok(
  fs.existsSync("functions/google-play-billing.js"),
  "server Google Play verifier must exist"
);
assert.ok(
  fs.existsSync("functions/google-play-billing-policy.js"),
  "pure Google Play verification policy must exist"
);

const billingSource = fs.readFileSync("lib/google-play-billing.ts", "utf8");
for (const token of [
  "ad_remove",
  "creator_monthly",
  "expert_monthly",
  "verifyGooglePlayPurchase",
  "purchaseToken"
]) {
  assert.ok(billingSource.includes(token), `billing adapter should contain ${token}`);
}

const billingHookSource = fs.readFileSync(
  "features/account/hooks/useGooglePlayBilling.ts",
  "utf8"
);
for (const token of [
  "useIAP",
  "fetchProducts",
  "requestPurchase",
  "finishTransaction",
  "getAvailablePurchases",
  "subscriptionOffers",
  "obfuscatedAccountId",
  "verifyGooglePlayPurchase"
]) {
  assert.ok(billingHookSource.includes(token), `billing hook should contain ${token}`);
}

assert.equal(
  subscriptionSource.includes("saveLocalCheckoutSubscription"),
  false,
  "local checkout fulfillment must be removed"
);
assert.equal(
  authSource.includes("saveLocalCheckoutSubscription"),
  false,
  "AuthContext must not grant paid entitlement locally"
);
assert.equal(
  authSource.includes("purchaseProduct:"),
  false,
  "AuthContext local purchase action must be removed"
);
assert.equal(
  subscriptionSource.includes("isPremiumSubscription(cachedSubscription) && !isPremiumSubscription(verifiedSubscription)"),
  false,
  "cached premium state must not override verified server state"
);
assert.equal(
  subscriptionSource.includes('provider: "none" | "admin" | "google_play" | "local_checkout"'),
  false,
  "legacy local_checkout must not remain a valid subscription provider"
);
assert.ok(
  subscriptionSource.includes('parsed.provider === ("local_checkout" as unknown)'),
  "legacy local_checkout cache should be detected and downgraded to free"
);

for (const token of [
  "useGooglePlayBilling",
  "purchaseProduct",
  "restorePurchases",
  "구매 복원"
]) {
  assert.ok(accountSource.includes(token), `Account screen should contain ${token}`);
}

for (const token of [
  "verifyGooglePlayPurchase",
  "handleGooglePlayBillingNotification",
  "google-play-billing",
  "syncGooglePlayPurchase"
]) {
  assert.ok(functionsSource.includes(token), `Functions entry should contain ${token}`);
}

const serverBillingSource = fs.readFileSync("functions/google-play-billing.js", "utf8");
for (const token of [
  "androidpublisher",
  "purchases/subscriptionsv2/tokens",
  "purchases/productsv2/tokens",
  ":acknowledge",
  "googlePlayPurchases",
  "sha256",
  "linkedPurchaseToken",
  "paymentEvents",
  'provider: "google_play"'
]) {
  assert.ok(serverBillingSource.includes(token), `server billing should contain ${token}`);
}

for (const token of [
  "match /googlePlayPurchases/{purchaseId}",
  "match /unresolvedGooglePlayNotifications/{notificationId}",
  "allow read, write: if false;"
]) {
  assert.ok(firestoreRules.includes(token), `Firestore rules should contain ${token}`);
}

const {
  parseOneTimePurchase,
  parseSubscriptionPurchase
} = require("../functions/google-play-billing-policy.js");

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

assert.equal(
  parseSubscriptionPurchase({
    productId: "creator_monthly",
    data: {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      externalAccountIdentifiers: { obfuscatedExternalAccountId: "user-1" },
      lineItems: [
        {
          productId: "creator_monthly",
          expiryTime: future,
          latestSuccessfulOrderId: "GPA.active"
        }
      ]
    }
  }).active,
  true,
  "active non-expired subscription must grant access"
);

assert.equal(
  parseSubscriptionPurchase({
    productId: "creator_monthly",
    data: {
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      lineItems: [{ productId: "creator_monthly", expiryTime: future }]
    }
  }).active,
  true,
  "canceled subscription remains active until expiry"
);

assert.equal(
  parseSubscriptionPurchase({
    productId: "creator_monthly",
    data: {
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      lineItems: [{ productId: "creator_monthly", expiryTime: past }]
    }
  }).active,
  false,
  "expired canceled subscription must not grant access"
);

assert.equal(
  parseSubscriptionPurchase({
    productId: "creator_monthly",
    data: {
      subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD",
      lineItems: [{ productId: "creator_monthly", expiryTime: future }]
    }
  }).active,
  false,
  "on-hold subscription must not grant access"
);

assert.equal(
  parseOneTimePurchase({
    productId: "ad_remove",
    data: {
      purchaseStateContext: { purchaseState: "PURCHASED" },
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      productLineItem: [
        {
          productId: "ad_remove",
          productOfferDetails: { refundableQuantity: 1 }
        }
      ]
    }
  }).active,
  true,
  "purchased non-consumable must grant access"
);

assert.equal(
  parseOneTimePurchase({
    productId: "ad_remove",
    data: {
      purchaseStateContext: { purchaseState: "PURCHASED" },
      productLineItem: [
        {
          productId: "ad_remove",
          productOfferDetails: { refundableQuantity: 0 }
        }
      ]
    }
  }).active,
  false,
  "fully refunded one-time purchase must not grant access"
);

assert.ok(
  serverBillingSource.includes("voidedPurchaseNotification"),
  "RTDN handler must process voided/refunded purchases"
);
assert.ok(
  serverBillingSource.includes("SUBSCRIPTION_STATE_REPLACED") &&
    serverBillingSource.includes("replacedByProductId"),
  "linked subscription replacement must retire the previous Google Play entitlement"
);
assert.ok(
  functionsSource.includes('source: "client"') &&
    functionsSource.includes("acknowledge: false"),
  "client purchase verification should let finishTransaction acknowledge only after server verification"
);

console.log("ok - Body Frame stage 6 Google Play Billing contracts are enforced");

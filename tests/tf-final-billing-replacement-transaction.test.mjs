import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";

const requireBilling = createRequire(new URL("../functions/google-play-billing.js", import.meta.url));
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const OLD = "fixture-old-subscription-token-000001";
const NEW = "fixture-new-subscription-token-000002";
const NEXT = "fixture-next-subscription-token-000003";
const LEGACY = "fixture-legacy-ad-removal-token-000004";
const A = "fixture-account-a";
const B = "fixture-account-b";
const PRO = "creator_monthly";
const PLUS = "plus_monthly";
const EXPERT = "expert_monthly";

const subscription = (productId, uid = A, state = "SUBSCRIPTION_STATE_ACTIVE", linkedPurchaseToken = undefined) => ({
  lineItems: [{ productId, expiryTime: new Date(Date.now() + 86_400_000).toISOString(), latestSuccessfulOrderId: "fixture-order" }],
  subscriptionState: state,
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  ...(uid ? { externalAccountIdentifiers: { obfuscatedExternalAccountId: uid } } : {}),
  ...(linkedPurchaseToken ? { linkedPurchaseToken } : {})
});

function fixture() {
  const documents = new Map();
  const replies = new Map();
  const requests = [];
  let events = 0;
  let queue = Promise.resolve();
  const snapshot = key => ({ exists: documents.has(key), data: () => structuredClone(documents.get(key)) });
  const write = (key, data, options) =>
    documents.set(key, structuredClone(options?.merge ? { ...documents.get(key), ...data } : data));
  const doc = key => ({ path: key, get: async () => snapshot(key), set: async (data, options) => write(key, data, options) });
  const db = {
    doc,
    collection: key => ({ doc: () => doc(key + "/" + ++events) }),
    runTransaction: body => {
      const result = queue.then(async () => {
        const writes = [];
        const value = await body({
          get: async ref => snapshot(ref.path),
          set: (ref, data, options) => writes.push(() => write(ref.path, data, options))
        });
        for (const apply of writes) apply();
        return value;
      });
      queue = result.catch(() => {});
      return result;
    }
  };
  const context = {
    module: { exports: {} },
    require: name => name === "google-auth-library" ? {
      GoogleAuth: class {
        async getClient() {
          return { request: async request => {
            const pathname = new URL(request.url).pathname;
            const token = decodeURIComponent(pathname.split("/").at(-1).replace(/:acknowledge$/, ""));
            requests.push({ method: request.method, token });
            if (request.method === "POST") return { data: {} };
            assert.ok(replies.has(token), "Only synthetic Publisher responses are permitted");
            return { data: structuredClone(replies.get(token)) };
          } };
        }
      }
    } : requireBilling(name)
  };
  vm.runInNewContext(fs.readFileSync(new URL("../functions/google-play-billing.js", import.meta.url), "utf8"), context);
  const { createGooglePlayBillingService, hashPurchaseToken } = context.module.exports;
  const service = createGooglePlayBillingService({ db, FieldValue: { serverTimestamp: () => 1 }, HttpsError });
  const verify = (token, productId, uid = A, source = "client") =>
    service.syncGooglePlayPurchase({ uid, productId, purchaseToken: token, source, acknowledge: source === "rtdn" });
  const notify = (token, productId, kind = "subs") =>
    service.handleGooglePlayBillingNotification({
      packageName: "com.haebi.photoguide",
      ...(kind === "subs" ? { subscriptionNotification: { purchaseToken: token, notificationType: 2 } } :
        { oneTimeProductNotification: { purchaseToken: token, sku: productId, notificationType: 2 } })
    });
  return {
    replies, requests, verify, notify, hash: hashPurchaseToken,
    purchase: token => documents.get("googlePlayPurchases/" + hashPurchaseToken(token)),
    product: (productId, uid = A) => documents.get("users/" + uid + "/subscriptions/" + productId),
    current: (uid = A) => documents.get("users/" + uid + "/subscriptions/current")
  };
}

for (const successorProduct of [PLUS, PRO]) {
  test("pending " + successorProduct + " replacement keeps current token until active RTDN", async () => {
    const h = fixture();
    h.replies.set(OLD, subscription(PRO));
    assert.equal((await h.verify(OLD, PRO)).active, true);
    h.replies.set(NEW, subscription(successorProduct, A, "SUBSCRIPTION_STATE_PENDING", OLD));
    assert.equal((await h.verify(NEW, successorProduct)).active, false);
    assert.equal(h.current().googlePurchaseTokenHash, h.hash(OLD));
    assert.equal(h.purchase(OLD).supersededBy, undefined);
    h.replies.set(NEW, subscription(successorProduct, A, "SUBSCRIPTION_STATE_ACTIVE", OLD));
    assert.equal((await h.notify(NEW, successorProduct)).active, true);
    assert.equal(h.current().googlePurchaseTokenHash, h.hash(NEW));
    assert.equal(h.purchase(OLD).supersededBy, h.hash(NEW));
    if (successorProduct !== PRO) assert.equal(h.product(PRO).status, "expired");

    // A delayed active provider result for the old token cannot be restored or
    // cached as an active purchase after its successor committed.
    const stale = await h.verify(OLD, PRO);
    assert.equal(stale.active, false);
    assert.equal(h.purchase(OLD).active, false);
    assert.equal(h.current().googlePurchaseTokenHash, h.hash(NEW));
    assert.equal((await h.verify(OLD, PRO)).active, false);
  });
}

test("a stale middle token cannot rewrite the predecessor's supersession or current entitlement", async () => {
  const h = fixture();
  h.replies.set(OLD, subscription(PRO));
  await h.verify(OLD, PRO);
  h.replies.set(NEW, subscription(PLUS, A, "SUBSCRIPTION_STATE_ACTIVE", OLD));
  await h.verify(NEW, PLUS);
  h.replies.set(NEXT, subscription(EXPERT, A, "SUBSCRIPTION_STATE_ACTIVE", NEW));
  await h.verify(NEXT, EXPERT);
  assert.equal((await h.notify(NEW, PLUS)).active, false);
  assert.equal(h.current().productId, EXPERT);
  assert.equal(h.purchase(NEW).supersededBy, h.hash(NEXT));
  assert.equal(h.purchase(OLD).supersededBy, h.hash(NEW));
  assert.equal(h.product(PLUS).status, "expired");
});

test("foreign linked purchase is denied before acknowledgement or entitlement mutation", async () => {
  const h = fixture();
  h.replies.set(OLD, subscription(PRO));
  await h.verify(OLD, PRO);
  h.replies.set(NEW, {
    ...subscription(PLUS, null, "SUBSCRIPTION_STATE_ACTIVE", OLD),
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING"
  });
  await assert.rejects(h.verify(NEW, PLUS, B, "rtdn"), { code: "permission-denied" });
  assert.equal(h.current(B), undefined);
  assert.equal(h.purchase(NEW), undefined);
  assert.equal(h.purchase(OLD).supersededBy, undefined);
  assert.equal(h.requests.filter(request => request.method === "POST").length, 0);
});

test("RTDN refund of a pending replacement does not revoke the old subscription", async () => {
  const h = fixture();
  h.replies.set(OLD, subscription(PRO));
  await h.verify(OLD, PRO);
  h.replies.set(NEW, subscription(PLUS, A, "SUBSCRIPTION_STATE_PENDING", OLD));
  await h.verify(NEW, PLUS);
  h.replies.set(NEW, subscription(PLUS, A, "SUBSCRIPTION_STATE_EXPIRED", OLD));
  assert.equal((await h.notify(NEW, PLUS)).active, false);
  assert.equal(h.purchase(OLD).supersededBy, undefined);
  assert.equal(h.current().googlePurchaseTokenHash, h.hash(OLD));
});

test("expired monthly entitlement preserves a verified legacy ad removal", async () => {
  const h = fixture();
  h.replies.set(LEGACY, {
    productLineItem: [{ productId: "ad_remove", productOfferDetails: { refundableQuantity: 1 } }],
    purchaseStateContext: { purchaseState: "PURCHASED" },
    obfuscatedExternalAccountId: A,
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
  });
  await h.verify(LEGACY, "ad_remove");
  h.replies.set(OLD, subscription(PRO));
  await h.verify(OLD, PRO);
  h.replies.set(OLD, subscription(PRO, A, "SUBSCRIPTION_STATE_EXPIRED"));
  assert.equal((await h.notify(OLD, PRO)).active, false);
  assert.equal(h.current().productId, "ad_remove");
  assert.equal(h.product("ad_remove").status, "active");
});

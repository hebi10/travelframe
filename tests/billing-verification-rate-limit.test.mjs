import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const billingRequire = createRequire(new URL("../functions/google-play-billing.js", import.meta.url));
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const createHarness = () => {
  const state = new Map();
  let calls = 0;
  let events = 0;
  let responseGate = null;
  let fail = false;
  let active = true;
  const snapshot = (path) => ({ exists: state.has(path), data: () => structuredClone(state.get(path)) });
  const doc = (path) => ({ path, get: async () => snapshot(path) });
  let queue = Promise.resolve();
  const db = {
    doc,
    collection: (path) => ({ doc: () => doc(`${path}/${++events}`) }),
    runTransaction: (body) => {
      const run = queue.then(async () => {
        const writes = [];
        const result = await body({
          get: async (ref) => snapshot(ref.path),
          set: (ref, data, options) => writes.push(() => state.set(ref.path,
            structuredClone(options?.merge ? { ...state.get(ref.path), ...data } : data)))
        });
        writes.forEach((write) => write());
        return result;
      });
      queue = run.catch(() => {});
      return run;
    }
  };
  const context = {
    module: { exports: {} },
    require: (name) => name === "google-auth-library" ? {
      GoogleAuth: class {
        async getClient() { return { request: async () => {
          calls++;
          if (responseGate) await responseGate.promise;
          if (fail) throw new Error("provider unavailable");
          return { data: {
            productLineItem: [{ productId: "ad_remove" }],
            purchaseStateContext: { purchaseState: active ? "PURCHASED" : "CANCELLED" },
            obfuscatedExternalAccountId: "user-a",
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
          } };
        } }; }
      }
    } : billingRequire(name)
  };
  vm.runInNewContext(fs.readFileSync(new URL("../functions/google-play-billing.js", import.meta.url), "utf8"), context);
  const service = context.module.exports.createGooglePlayBillingService({ db, FieldValue: { serverTimestamp: () => 1 }, HttpsError });
  const verify = (extra = {}) => service.syncGooglePlayPurchase({
    uid: "user-a", productId: "ad_remove", purchaseToken: "fake-test-purchase-token-00001", ...extra
  });
  return { state, verify, calls: () => calls,
    events: () => [...state.keys()].filter((key) => key.includes("/paymentEvents/")).length,
    gate: (value) => { responseGate = value; }, fail: (value) => { fail = value; },
    active: (value) => { active = value; } };
};

{
  const h = createHarness();
  const first = await h.verify();
  const second = await h.verify();
  assert.equal(second.active, first.active);
  assert.equal(h.calls(), 1, "identical verified requests must reuse short-lived server result");
  assert.equal(h.events(), 1, "duplicate client verification must not create duplicate payment events");
  await assert.rejects(h.verify({ uid: "user-b" }), { code: "permission-denied" });
  assert.equal(h.calls(), 1, "cached result must never cross account ownership");
  const purchase = [...h.state.entries()].find(([key]) => key.startsWith("googlePlayPurchases/"))[1];
  purchase.verifiedAtMs -= 15_001;
  await h.verify();
  assert.equal(h.calls(), 2, "expired cache must refresh from Google");
  h.active(false);
  await h.verify({ source: "rtdn" });
  assert.equal(h.calls(), 3, "RTDN must reverify Google even during client cache TTL");
  const current = await h.verify();
  assert.equal(current.active, false, "refund RTDN must invalidate cached active result");
}
{
  const h = createHarness();
  const gate = deferred();
  h.gate(gate);
  const first = h.verify();
  while (!h.calls()) await new Promise((done) => setImmediate(done));
  await assert.rejects(h.verify(), { code: "resource-exhausted" });
  assert.equal(h.calls(), 1, "concurrent identical requests must not multiply provider calls");
  gate.resolve();
  await first;
}
{
  const h = createHarness();
  h.fail(true);
  await assert.rejects(h.verify(), /provider unavailable/);
  h.fail(false);
  await h.verify();
  assert.equal(h.calls(), 2, "provider failure must release in-flight token lease");
}
{
  const h = createHarness();
  h.fail(true);
  for (let index = 0; index < 20; index++) {
    await assert.rejects(h.verify({ purchaseToken: `fake-distinct-token-${String(index).padStart(8, "0")}` }), /provider unavailable/);
  }
  await assert.rejects(h.verify({ purchaseToken: "fake-distinct-token-after-limit" }), { code: "resource-exhausted" });
  assert.equal(h.calls(), 20, "UID rate limit must also charge failed and distinct token attempts");
  h.state.get("billingVerificationLimits/user-a").windowStartedAtMs -= 60_001;
  h.fail(false);
  await h.verify();
  assert.equal(h.calls(), 21, "fresh minute must allow retry after rate limit");
  const serializedLimit = JSON.stringify(h.state.get("billingVerificationLimits/user-a"));
  assert.equal(serializedLimit.includes("fake-"), false, "rate-limit state must not store raw purchase tokens");
}
{
  const h = createHarness();
  const gate = deferred();
  h.gate(gate);
  const attempts = Array.from({ length: 21 }, (_, index) =>
    h.verify({ purchaseToken: `fake-concurrent-token-${String(index).padStart(8, "0")}` })
      .then(() => "ok", (error) => error.code));
  while (h.calls() < 20) await new Promise((done) => setImmediate(done));
  gate.resolve();
  const outcomes = await Promise.all(attempts);
  assert.equal(outcomes.filter((outcome) => outcome === "resource-exhausted").length, 1);
  assert.equal(h.calls(), 20, "parallel calls must share the same transactional UID limit");
}
console.log("ok - billing verification limits, deduplication, ownership and RTDN freshness");

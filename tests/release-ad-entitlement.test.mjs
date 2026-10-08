import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const load = (file, dependencies, clock) => {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (id) => {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
    Date: clock,
    console
  }, { filename: file });
  return module.exports;
};

const fixture = (options = {}) => {
  let now = Date.parse("2026-10-01T00:00:00Z");
  class Clock extends Date { static now() { return now; } }
  const empty = { adRemove: null, creatorMonthly: null, plusMonthly: null, expertMonthly: null };
  const subscription = load("lib/subscription.ts", {
    "@/lib/local-storage": { localStorageAdapter: {
      getItem: async () => {
        if (options.cacheReadFails) throw new Error("cache read failed");
        return options.cache ? JSON.stringify(options.cache) : null;
      },
      setItem: async () => {
        if (options.cacheWriteFails) throw new Error("cache write failed");
      }
    } },
    "firebase/firestore": {
      doc: (_db, ...parts) => parts.at(-1),
      getDoc: async (id) => {
        if (options.serverFails) throw new Error("server failed");
        const value = options.documents?.[id];
        return { exists: () => Boolean(value), data: () => value };
      }
    },
    "@/lib/firebase": { firestore: {} },
    "@/lib/subscription-products": { emptySubscriptionProducts: empty }
  }, Clock);
  const ads = load("lib/ad-entitlement.ts", { "@/lib/subscription": subscription }, Clock);
  return { ...subscription, ...ads, advance: (ms) => { now += ms; } };
};

const paid = (productId, expiresAt = null) => ({
  plan: "premium", status: "active", provider: "google_play", productId,
  startedAt: null, expiresAt, lastPaymentAt: null, priceLabel: "test", productName: productId
});
const user = { uid: "release-test-user" };
const cases = [];
const check = async (name, fn) => {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (error) { cases.push(name); console.error(`not ok - ${name}: ${error.message}`); }
};

await check("verified free users may request ads", () => {
  const f = fixture();
  assert.equal(f.shouldShowAds(f.freeSubscription, "verified"), true);
});
for (const status of ["loading", "failed", undefined]) {
  await check(`unverified entitlement (${status}) blocks ad requests`, () => {
    const f = fixture();
    assert.equal(f.shouldShowAds(f.freeSubscription, status), false);
  });
}
await check("missing entitlement blocks ad requests", () => {
  assert.equal(fixture().shouldShowAds(null, "verified"), false);
});
for (const product of ["ad_remove", "creator_monthly", "plus_monthly", "expert_monthly"]) {
  await check(`${product} excludes ads`, () => {
    assert.equal(fixture().shouldShowAds(paid(product), "verified"), false);
  });
}
await check("cache write failure cannot discard verified purchase", async () => {
  const f = fixture({ cacheWriteFails: true, documents: { ad_remove: paid("ad_remove") } });
  const state = await f.getUserSubscriptionState(user);
  assert.equal(state.subscriptionStatus, "verified");
  assert.equal(state.verifiedSubscription.productId, "ad_remove");
  assert.equal(f.shouldShowAds(state.verifiedSubscription, state.subscriptionStatus), false);
});
await check("cache read failure cannot prevent server verification", async () => {
  const f = fixture({ cacheReadFails: true, documents: { ad_remove: paid("ad_remove") } });
  const state = await f.getUserSubscriptionState(user);
  assert.equal(state.subscriptionStatus, "verified");
  assert.equal(state.verifiedSubscription.productId, "ad_remove");
});
await check("server failure blocks ads without granting paid server access", async () => {
  const f = fixture({ serverFails: true, cache: paid("ad_remove") });
  const state = await f.getUserSubscriptionState(user);
  assert.equal(state.subscriptionStatus, "failed");
  assert.equal(f.isPremiumSubscription(state.verifiedSubscription), false);
  assert.equal(f.shouldShowAds(state.verifiedSubscription, state.subscriptionStatus), false);
});
await check("monthly expiry preserves separately verified ad removal in the same session", async () => {
  const f = fixture({ documents: {
    ad_remove: paid("ad_remove"),
    creator_monthly: paid("creator_monthly", "2026-10-01T00:00:01Z")
  } });
  const state = await f.getUserSubscriptionState(user);
  assert.equal(state.verifiedSubscription.productId, "creator_monthly");
  f.advance(2000);
  assert.equal(f.isPremiumSubscription(state.verifiedSubscription), false);
  assert.equal(f.shouldShowAds(state.verifiedSubscription, "verified"), false);
});
await check("expired monthly without ad removal allows ads", async () => {
  const f = fixture({ documents: {
    creator_monthly: paid("creator_monthly", "2026-10-01T00:00:01Z")
  } });
  const state = await f.getUserSubscriptionState(user);
  f.advance(2000);
  assert.equal(f.shouldShowAds(state.verifiedSubscription, "verified"), true);
});
await check("refreshed revoked ad removal does not inherit stale cached entitlement", async () => {
  const f = fixture({ cache: paid("ad_remove"), documents: {
    ad_remove: { ...paid("ad_remove"), plan: "free", status: "inactive" }
  } });
  const state = await f.getUserSubscriptionState(user);
  assert.equal(f.shouldShowAds(state.verifiedSubscription, state.subscriptionStatus), true);
});
if (cases.length) throw new Error(`${cases.length} release ad entitlement regressions: ${cases.join("; ")}`);

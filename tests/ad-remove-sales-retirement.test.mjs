import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("features/account/hooks/useGooglePlayBilling.ts", "utf8");
const ast = ts.createSourceFile("billing.ts", source, ts.ScriptTarget.Latest, true);
const callbacks = new Map();
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.initializer &&
      ["purchaseProduct", "processVerifiedPurchase", "restorePurchases", "reloadProducts"].includes(node.name.getText(ast))) {
    callbacks.set(node.name.getText(ast), node.initializer.arguments[0].getText(ast));
  }
  ts.forEachChild(node, visit);
};
visit(ast);
const load = (name, dependencies) => {
  assert.ok(callbacks.has(name), `missing billing callback: ${name}`);
  const code = ts.transpileModule(`globalThis.callback = ${callbacks.get(name)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, dependencies);
  return dependencies.callback;
};

const planModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync("features/account/account-screen.constants.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module: planModule, exports: planModule.exports });
assert.deepEqual(Array.from(planModule.exports.paymentPlans, plan => plan.id), ["creator", "plus", "expert"]);
assert.deepEqual(Array.from(planModule.exports.paymentPlans, plan => plan.price), ["2,000원", "4,000원", "6,000원"]);

const requests = [];
const pendingPurchaseRef = { current: null };
const purchase = load("purchaseProduct", {
  Platform: { OS: "android" }, user: { uid: "legacy-buyer" }, connected: true,
  pendingPurchaseRef, products: [{ id: "ad_remove" }], subscriptionsById: new Map(),
  getGooglePlayProductType: id => id === "ad_remove" ? "in-app" : "subs",
  getAvailablePurchases: async () => [],
  setBillingMessage: () => {},
  requestPurchase: async request => { requests.push(request); pendingPurchaseRef.current.resolve(); }
});
await assert.rejects(purchase("ad_remove"), /판매.*종료|신규.*구매/);
assert.equal(requests.length, 0, "retired purchases must never open Google Play billing");

const queries = [];
const reload = load("reloadProducts", {
  user: { uid: "legacy-buyer" }, connected: true, Platform: { OS: "android" },
  productQueryVersionRef: { current: 0 },
  GOOGLE_PLAY_ONE_TIME_PRODUCT_IDS: ["ad_remove"],
  GOOGLE_PLAY_SUBSCRIPTION_IDS: ["creator_monthly", "plus_monthly", "expert_monthly"],
  fetchStoreProducts: async request => { queries.push(request); return request.skus.map(id => ({ id })); },
  setProducts: () => {}, setSubscriptions: () => {}, setProductLoadError: () => {}, setIsLoadingProducts: () => {}
});
await reload();
assert.deepEqual(queries.map(query => query.type), ["subs"]);
assert.deepEqual(Array.from(queries[0].skus), ["creator_monthly", "plus_monthly", "expert_monthly"]);

const billingModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync("lib/google-play-billing.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module: billingModule, exports: billingModule.exports,
    require: id => {
      if (id === "firebase/functions") return { httpsCallable: () => {} };
      if (id === "@/lib/firebase") return { firebaseFunctions: null };
      throw new Error(`Unexpected dependency: ${id}`);
    }
  });
const { isGooglePlayProductId } = billingModule.exports;
assert.equal(isGooglePlayProductId("ad_remove"), true, "legacy product recognition must remain available");

const calls = [];
const legacyPurchase = { productId: "ad_remove", purchaseToken: "legacy-purchase-token" };
const verify = load("processVerifiedPurchase", {
  isGooglePlayProductId,
  purchaseTokenFrom: item => item.purchaseToken,
  verifyGooglePlayPurchase: async request => {
    calls.push(["verify", request.productId, request.purchaseToken]);
    return { verified: true, active: true, status: "active" };
  },
  finishTransactionRef: { current: async request => calls.push(["finish", request.isConsumable]) },
  refreshUser: async () => calls.push(["refresh"])
});
const restore = load("restorePurchases", {
  Platform: { OS: "android" }, user: { uid: "legacy-buyer" }, connected: true,
  setIsRestoring: () => {}, setBillingMessage: () => {},
  getAvailablePurchases: async () => [legacyPurchase],
  isGooglePlayProductId,
  processVerifiedPurchase: verify,
  refreshUser: async () => calls.push(["refresh"])
});
assert.equal(await restore(), 1, "existing permanent ad removal must remain restorable");
assert.deepEqual(calls[0], ["verify", "ad_remove", "legacy-purchase-token"]);
assert.deepEqual(calls[1], ["finish", false]);
assert.ok(calls.some(call => call[0] === "refresh"));
console.log("ok - only monthly plans are sold while existing permanent ad removal still verifies and restores");

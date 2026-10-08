import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("features/account/hooks/useGooglePlayBilling.ts", "utf8");
const parsed = ts.createSourceFile("billing.ts", source, ts.ScriptTarget.Latest, true);
let callback;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "purchaseProduct") {
    callback = node.initializer.arguments[0].getText(parsed);
  }
  ts.forEachChild(node, visit);
};
visit(parsed);
assert.ok(callback, "real billing purchase callback is required");
const runnable = ts.transpileModule(`globalThis.purchase = ${callback};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;

const execute = async (oldProductId, productId, confirm = true) => {
  const requests = [];
  const alerts = [];
  const pendingPurchaseRef = { current: null };
  const products = ["creator_monthly", "plus_monthly", "expert_monthly"];
  const context = {
    Platform: { OS: "android" }, user: { uid: "billing-test-user" }, connected: true,
    pendingPurchaseRef, products: [{ id: "ad_remove" }],
    subscriptionsById: new Map(products.map(id => [id, { id }])),
    getGooglePlayProductType: id => id === "ad_remove" ? "in-app" : "subs",
    getGooglePlaySubscriptionOfferToken: () => "test-offer",
    getAvailablePurchases: async () => oldProductId ? [{
      productId: oldProductId, purchaseState: "purchased", purchaseToken: "test-old-purchase"
    }] : [],
    setBillingMessage: () => {},
    Alert: { alert: (title, message, buttons, options) => {
      alerts.push({ title, message });
      if (confirm) buttons.find(button => button.style !== "cancel").onPress();
      else (buttons.find(button => button.style === "cancel")?.onPress ?? options?.onDismiss)?.();
    } },
    requestPurchase: async request => {
      requests.push(request);
      pendingPurchaseRef.current.resolve();
    }
  };
  vm.runInNewContext(runnable, context);
  let error = null;
  try { await context.purchase(productId); }
  catch (caught) { error = caught; }
  return { requests, alerts, error };
};

let failures = 0;
const check = async (name, action) => {
  try { await action(); console.log(`ok - ${name}`); }
  catch (error) { failures++; console.error(`not ok - ${name}: ${error.message}`); }
};
const plans = ["creator_monthly", "plus_monthly", "expert_monthly"];
for (const oldProductId of plans) {
  for (const productId of plans.filter(id => id !== oldProductId)) {
    await check(`${oldProductId} -> ${productId} uses immediate time credit with disclosure`, async () => {
      const { requests, alerts, error } = await execute(oldProductId, productId);
      assert.equal(error, null);
      assert.equal(requests.length, 1);
      const google = requests[0].request.google;
      assert.equal(google.purchaseToken, "test-old-purchase");
      assert.equal(google.subscriptionProductReplacementParams.oldProductId, oldProductId);
      assert.equal(google.subscriptionProductReplacementParams.replacementMode, "with-time-proration");
      assert.equal(alerts.length, 1);
      assert.match(alerts[0].message, /즉시/);
      assert.match(alerts[0].message, /기간/);
    });
  }
}
await check("declining a plan change cannot open billing or report purchase success", async () => {
  const result = await execute("expert_monthly", "creator_monthly", false);
  assert.equal(result.requests.length, 0);
  assert.match(result.error?.message ?? "", /취소/);
});
await check("new subscription does not send old purchase parameters", async () => {
  const result = await execute(null, "creator_monthly");
  assert.equal(result.error, null);
  assert.equal(result.alerts.length, 0);
  assert.equal(result.requests[0].request.google.subscriptionProductReplacementParams, undefined);
});
await check("ad removal stays a non-subscription purchase", async () => {
  const result = await execute(null, "ad_remove");
  assert.equal(result.error, null);
  assert.equal(result.requests[0].type, "in-app");
  assert.equal(result.alerts.length, 0);
});
if (failures) throw new Error(`${failures} billing replacement regressions`);

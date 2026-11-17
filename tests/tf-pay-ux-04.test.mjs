import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => fs.readFileSync(path, "utf8");
const plan = read("features/account/PlanScreen.tsx");
const navigation = read("lib/plan-navigation.ts");
const account = read("features/account/AccountScreen.tsx");
const billing = read("features/account/hooks/useGooglePlayBilling.ts");

test("TF-PAY-UX-04: purchase selection keeps an allowlisted context and starts the existing checkout", () => {
  const parsed = ts.createSourceFile("PlanScreen.tsx", plan, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0);
  assert.ok(plan.includes("purchasePlan: plan.id"));
  const accountParsed = ts.createSourceFile("AccountScreen.tsx", account, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(accountParsed.parseDiagnostics.length, 0, "account paywall must parse");
  assert.ok(plan.includes("checkoutId: String(Date.now())"));
  assert.ok(plan.includes('pathname: "/account"'));
  assert.ok(account.includes("handledCheckoutRef.current = checkoutId"), "login must reopen only the selected checkout request");
  assert.ok(account.includes("router.replace(getPlanReturnPath(returnSource))"), "post-payment return must use allowlisted routes");
  assert.ok(account.includes('getStorePrice(getPaymentProductId(selectedPaymentPlan))'), "store price is required to enable purchase");
  assert.ok(account.includes('subscriptionStatus === "verified"'), "unverified entitlement must not open checkout");
  for (const target of ['return "/camera"', 'return "/studio"', 'return "/video-create"', 'return "/settings"', 'return "/plans"']) {
    assert.ok(navigation.includes(target), target);
  }
});

test("TF-PAY-UX-04: checkout stays server verified with no optimistic entitlement grant", () => {
  for (const contract of ["useGooglePlayBilling", "purchaseProduct(", "restorePurchases", "getStorePrice"]) {
    assert.ok(account.includes(contract), contract);
  }
  assert.ok(billing.indexOf("verifyGooglePlayPurchase") < billing.lastIndexOf("finishTransaction"));
  assert.doesNotMatch(plan + account, /activateMockSubscription|saveLocalCheckoutSubscription/);
});

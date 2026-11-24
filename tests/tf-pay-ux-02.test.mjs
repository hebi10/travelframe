import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const plans = fs.readFileSync("features/account/PlanScreen.tsx", "utf8");
const constants = fs.readFileSync("features/account/account-screen.constants.ts", "utf8");
const entitlements = fs.readFileSync("lib/plan-entitlements.ts", "utf8");

test("TF-PAY-UX-02: PlanScreen parses as TSX and is browsable without login", () => {
  const parsed = ts.createSourceFile("PlanScreen.tsx", plans, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0);
  assert.ok(plans.includes('SectionBlock title="Pro · Plus · Expert 비교"'));
  assert.ok(plans.includes('currentTier === "guest"'));
  assert.ok(plans.includes('"로그인 후 구독하기"'));
  assert.ok(plans.includes('isLoggedIn ? "구독 안내 보기"') ||
    plans.includes('isLoggedIn ? "Google Play에서 구독하기"'));
  assert.ok(plans.includes('subscriptionStatus !== "verified"'));
});

test("TF-PAY-UX-02: paid plan values derive from existing server entitlement policy", () => {
  for (const value of ['creator: "pro"', 'plus: "plus"', 'expert: "expert"', "PLAN_ENTITLEMENTS[tier]", "backupStorageBytes / GIB"]) {
    assert.ok(plans.includes(value), value);
  }
  for (const sku of ["creator_monthly", "plus_monthly", "expert_monthly"]) {
    assert.ok(entitlements.includes(sku), sku);
  }
  for (const price of ['2,000원', '4,000원', '6,000원']) {
    assert.ok(constants.includes(price), price);
  }
  assert.ok(plans.includes("실제 청구 금액은 Google Play 확인"));
  assert.doesNotMatch(plans, /saveLocalCheckoutSubscription|activateMockSubscription/);
});

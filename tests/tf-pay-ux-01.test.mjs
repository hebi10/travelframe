import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(p, "utf8");
const tabs = read("app/(tabs)/_layout.tsx");
const glyph = read("components/tab-glyph.tsx");
const plans = read("features/account/PlanScreen.tsx");

test("TF-PAY-UX-01: five primary tabs expose plans and retain hidden account", () => {
  assert.match(tabs, /name="plans"/);
  assert.match(tabs, /title: "플랜"/);
  assert.match(tabs, /kind="plans"/);
  assert.equal((tabs.match(/tabBarIcon:/g) ?? []).length, 5);
  assert.match(glyph, /plans: "credit-card"/);
  assert.match(tabs, /name="account"[\s\S]*?href: null/);
  assert.equal(read("app/(tabs)/plans.tsx").includes("PlanScreen"), true);
});

test("TF-PAY-UX-01: billing remains server controlled and old account is routable", () => {
  assert.match(plans, /subscriptionStatus !== "verified"/);
  assert.match(plans, /router.push\("\/account"\)/);
  assert.doesNotMatch(plans, /saveLocalCheckoutSubscription|activateMockSubscription/);
});

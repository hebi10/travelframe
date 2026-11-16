import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => fs.readFileSync(path, "utf8");
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loadModule = (path, requireModule = () => { throw new Error("Unexpected import"); }) => {
  const module = { exports: {} };
  vm.runInNewContext(compile(read(path)), { module, exports: module.exports, require: requireModule, Date });
  return module.exports;
};

test("TF-PAY-UX-05: login/free/legacy/pro/plus/expert rights remain canonical", () => {
  const { getPlanTier, getPlanEntitlements, PLAN_ENTITLEMENTS, GIB } =
    loadModule("lib/plan-entitlements.ts");
  const active = productId => ({
    plan: "premium", status: "active", productId,
    expiresAt: new Date(Date.now() + 86400_000).toISOString()
  });
  assert.equal(getPlanTier({ isLoggedIn: false, subscription: active("expert_monthly") }), "guest");
  assert.equal(getPlanTier({ isLoggedIn: true, subscription: null }), "free");
  for (const [product, tier] of [
    ["ad_remove", "ad_remove"],
    ["creator_monthly", "pro"],
    ["plus_monthly", "plus"],
    ["expert_monthly", "expert"]
  ]) {
    assert.equal(getPlanTier({ isLoggedIn: true, subscription: active(product) }), tier);
  }
  assert.equal(getPlanTier({ isLoggedIn: true, subscription: {
    ...active("expert_monthly"), expiresAt: new Date(Date.now() - 1000).toISOString()
  } }), "free");
  const free = getPlanEntitlements({ isLoggedIn: true, subscription: null });
  assert.equal(free.maxProjectCount, 1);
  assert.equal(free.maxProgressPhotos, 100);
  assert.equal(free.canBackupToCloud, false);
  const legacy = PLAN_ENTITLEMENTS.ad_remove;
  assert.equal(legacy.maxProjectCount, 2);
  assert.equal(legacy.showAds, false);
  assert.equal(legacy.canBackupToCloud, false);
  for (const [tier, slots, storage] of [
    ["pro", 1, 2], ["plus", 3, 6], ["expert", 5, 10]
  ]) {
    assert.equal(PLAN_ENTITLEMENTS[tier].maxCloudBackupProjects, slots);
    assert.equal(PLAN_ENTITLEMENTS[tier].backupStorageBytes, storage * GIB);
    assert.equal(PLAN_ENTITLEMENTS[tier].showWatermark, false);
    assert.equal(PLAN_ENTITLEMENTS[tier].canBackupToCloud, true);
  }
});

test("TF-PAY-UX-05: paywall return paths are allowlisted, not user-controlled arbitrary URIs", () => {
  const pushes = [];
  const { openPlans, getPlanReturnPath } = loadModule("lib/plan-navigation.ts", id => {
    if (id === "expo-router") return { router: { push: value => pushes.push(value) } };
    throw new Error(id);
  });
  openPlans("camera", "Pro");
  openPlans("backup", "Expert");
  assert.equal(pushes.length, 2);
  assert.equal(pushes[0].pathname, "/plans");
  assert.equal(pushes[0].params.plan, "pro");
  assert.equal(pushes[1].params.plan, "expert");
  const targets = {
    camera: "/camera", records: "/studio", project: "/studio",
    video: "/video-create", backup: "/settings", settings: "/settings",
    unknown: "/plans", "https://fake.example": "/plans"
  };
  for (const [source, expected] of Object.entries(targets)) {
    assert.equal(getPlanReturnPath(source), expected);
  }
});

test("TF-PAY-UX-05: paywall/UI follow current appearance and purchase safety contracts", () => {
  for (const file of [
    "features/account/PlanScreen.tsx",
    "features/account/AccountScreen.tsx",
    "features/account/CloudBackupProjectSlotsSection.tsx",
    "features/trip-clip/BodyFrameVideoHomeScreen.tsx"
  ]) {
    const source = read(file);
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, file + " parse");
    assert.doesNotMatch(source, /border(?:Top|Bottom|Left|Right)Width\s*:|shadowOpacity|shadowColor|LinearGradient/);
  }
  const plan = read("features/account/PlanScreen.tsx");
  assert.ok(plan.includes("ScreenShell"));
  assert.ok(plan.includes("useAppAppearance"));
  assert.ok(plan.includes('subscriptionStatus !== "verified"'));
  const account = read("features/account/AccountScreen.tsx");
  assert.ok(account.includes("canSubmitSelectedPlan"));
  assert.ok(account.includes("subscriptionStatus === \"verified\""));
  assert.ok(account.includes("getStorePrice(getPaymentProductId(selectedPaymentPlan))"));
  assert.ok(account.includes("router.replace(getPlanReturnPath(returnSource))"));
  assert.ok(read("features/account/hooks/useGooglePlayBilling.ts").includes("verifyGooglePlayPurchase"));
});

test("TF-PAY-UX-05: native camera/recording/backup screenshots include Plans for every matrix", () => {
  const capture = read("scripts/capture-stage13-android.py");
  const verifier = read("scripts/verify-frame-journal-c7.py");
  const workflow = read(".github/workflows/body-frame-device-qa.yml");
  assert.match(capture, /\("plans", "플랜 비교", "plans"/);
  assert.match(capture, /"plans"/);
  assert.ok(verifier.includes('"plans"'));
  assert.ok(workflow.includes("'feature/tf-pay-ux-05-'"));
  assert.ok(workflow.includes("profile: [phone-360dp, phone-412dp, tablet-600dp, tablet-750dp]"));
});

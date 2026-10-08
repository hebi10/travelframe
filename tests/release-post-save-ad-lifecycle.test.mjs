import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync("lib/use-post-save-ad.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const fixture = (authOverride = {}, consentAllowed = true) => {
  const auth = { isLoggedIn: true, isAuthLoading: false, subscriptionStatus: "verified", subscription: { paid: false }, ...authOverride };
  const consent = { canRequestAds: consentAllowed };
  const requests = [];
  const refs = [];
  const effects = [];
  let cursor = 0;
  let onFocus;
  let onBackground;
  let cancelled = 0;
  const AppState = { currentState: "active", addEventListener: (_type, fn) => { onBackground = fn; return { remove() {} }; } };
  const dependencies = {
    react: {
      useRef: value => { const index = cursor++; refs[index] ??= { current: value }; return refs[index]; },
      useCallback: fn => fn,
      useEffect: fn => { effects.push(fn); }
    },
    "expo-router": { useFocusEffect: fn => { onFocus = fn; } },
    "react-native": { AppState },
    "@/components/google-mobile-interstitial": { showGoogleMobileInterstitialAd: input => { requests.push(input); return () => { cancelled++; }; } },
    "@/lib/ad-consent": { adConsent: { getSnapshot: () => consent } },
    "@/lib/ad-entitlement": { shouldShowAds: (subscription, status) => status === "verified" && !subscription.paid },
    "@/lib/admob-config": { canUseNativeAdMob: () => true, getInterstitialAdUnitId: () => "test-unit" },
    "@/lib/auth-context": { useAuth: () => auth },
    "@/lib/use-ad-consent": { useAdConsent: () => consent }
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: id => {
    assert.ok(Object.hasOwn(dependencies, id)); return dependencies[id];
  } });
  const render = () => { cursor = 0; effects.length = 0; const hook = module.exports.usePostSaveAd(); effects.forEach(fn => fn()); return hook; };
  let hook = render();
  const blur = onFocus();
  return {
    request: () => hook.requestPostSaveAd(), requests, auth, consent, blur,
    rerender: () => { hook = render(); },
    background: () => { AppState.currentState = "background"; onBackground("background"); },
    get cancelled() { return cancelled; }
  };
};
let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { failures++; console.error(`not ok - ${name}: ${error.message}`); }
};
for (const [name, auth] of [
  ["guest", { isLoggedIn: false }],
  ["auth loading", { isAuthLoading: true }],
  ["entitlement loading", { subscriptionStatus: "loading" }],
  ["entitlement failed", { subscriptionStatus: "failed" }],
  ["paid", { subscription: { paid: true } }]
]) {
  check(`${name} cannot request a post-save ad`, () => {
    const f = fixture(auth); f.request(); assert.equal(f.requests.length, 0);
  });
}
check("missing consent cannot request a post-save ad", () => {
  const f = fixture({}, false); f.request(); assert.equal(f.requests.length, 0);
});
check("eligible foreground save supplies a live authorization callback", () => {
  const f = fixture(); f.request(); assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].canShow(), true);
  f.consent.canRequestAds = false;
  assert.equal(f.requests[0].canShow(), false);
});
check("navigation cancels a loading ad and rejects later save requests", () => {
  const f = fixture(); f.request(); f.blur();
  assert.equal(f.cancelled, 1); assert.equal(f.requests[0].canShow(), false);
  f.request(); assert.equal(f.requests.length, 1);
});
check("backgrounding cancels a loading ad and rejects later save requests", () => {
  const f = fixture(); f.request(); f.background();
  assert.equal(f.cancelled, 1); assert.equal(f.requests[0].canShow(), false);
  f.request(); assert.equal(f.requests.length, 1);
});
check("purchase entitlement changes cancel an already loading ad", () => {
  const f = fixture(); f.request(); f.auth.subscription = { paid: true }; f.rerender();
  assert.equal(f.cancelled, 1); assert.equal(f.requests[0].canShow(), false);
});
check("a second export cancels the previous pending ad", () => {
  const f = fixture(); f.request(); f.request(); assert.equal(f.cancelled, 1);
});
const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
assert.ok(app.expo.plugins.includes("./plugins/with-ad-consent"));
const rules = fs.readFileSync("android/app/proguard-rules.pro", "utf8");
assert.ok(rules.includes("-keep class com.google.android.gms.internal.consent_sdk.** { *; }"));
assert.ok(rules.includes("-keep class com.google.android.ump.** { *; }"));
const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
assert.match(manifest, /android:name="com\.google\.android\.gms\.ads\.DELAY_APP_MEASUREMENT_INIT"[^>]*android:value="true"/);
if (failures) throw new Error(`${failures} post-save lifecycle regressions`);

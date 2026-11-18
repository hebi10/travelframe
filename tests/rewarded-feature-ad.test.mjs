import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (path) => ts.transpileModule(fs.readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const load = (path) => {
  const module = { exports: {} };
  vm.runInNewContext(compile(path), {
    module,
    exports: module.exports,
    require: () => { throw new Error("Unexpected native SDK access"); },
    setTimeout,
    clearTimeout
  });
  return module.exports;
};

const { createGoogleMobileRewardedAdPresenter } = load("lib/rewarded-feature-ad.ts");
const { resolveRewardedAdUnitId, ADMOB_TEST_REWARDED_AD_UNIT_ID } = load("lib/admob-units.ts");

assert.equal(
  resolveRewardedAdUnitId({ isAndroid: true, isDev: true }),
  "ca-app-pub-3940256099942544/5224354917"
);
assert.equal(ADMOB_TEST_REWARDED_AD_UNIT_ID, "ca-app-pub-3940256099942544/5224354917");
assert.equal(resolveRewardedAdUnitId({ isAndroid: true, isDev: false }), null);
assert.equal(resolveRewardedAdUnitId({
  isAndroid: true,
  isDev: false,
  androidRewardedAdUnitId: " test-reward-unit "
}), "test-reward-unit");
assert.equal(resolveRewardedAdUnitId({
  isAndroid: false,
  isDev: true,
  androidRewardedAdUnitId: "test-reward-unit"
}), null);

const fixture = () => {
  const handlers = new Map();
  let loadCount = 0;
  let showCount = 0;
  const ad = {
    addAdEventListener: (type, listener) => {
      handlers.set(type, listener);
      return () => handlers.delete(type);
    },
    load: () => { loadCount += 1; },
    show: async () => { showCount += 1; }
  };
  const sdk = {
    AdEventType: { CLOSED: "closed", ERROR: "error" },
    RewardedAdEventType: { LOADED: "loaded", EARNED_REWARD: "earned" },
    RewardedAd: {
      createForAdRequest: (_id, options) => {
        assert.equal(options.requestNonPersonalizedAdsOnly, true);
        return ad;
      }
    }
  };
  const results = [];
  const presenter = createGoogleMobileRewardedAdPresenter(() => sdk);
  const cancel = presenter({
    adUnitId: "test-unit",
    canShow: () => true,
    onComplete: (result) => results.push(result)
  });
  return { handlers, cancel, results, get loadCount() { return loadCount; }, get showCount() { return showCount; } };
};

{
  const f = fixture();
  assert.equal(f.loadCount, 1);
  f.handlers.get("loaded")();
  f.handlers.get("earned")();
  f.handlers.get("closed")();
  assert.deepEqual(f.results, ["earned"], "reward is required before export");
}
{
  const f = fixture();
  f.handlers.get("loaded")();
  f.handlers.get("closed")();
  assert.deepEqual(f.results, ["dismissed"], "closing early does not unlock export");
}
{
  const f = fixture();
  f.handlers.get("error")();
  assert.deepEqual(f.results, ["unavailable"], "failed loading does not claim a reward");
}
{
  const f = fixture();
  f.cancel();
  assert.deepEqual(f.results, ["cancelled"], "navigation cancels the request");
}
{
  const results = [];
  createGoogleMobileRewardedAdPresenter(() => null)({
    adUnitId: "test-unit",
    canShow: () => true,
    onComplete: (result) => results.push(result)
  });
  assert.deepEqual(results, ["unavailable"]);
}

const hook = fs.readFileSync("lib/use-rewarded-feature-ad.ts", "utf8");
assert.ok(hook.includes("shouldShowAds(subscription, subscriptionStatus)"));
assert.ok(hook.includes("adConsent.getSnapshot().canRequestAds"));
assert.ok(hook.includes('text: "광고 보기"'));
assert.ok(hook.includes('outcome === "earned"'));
assert.ok(hook.includes('outcome === "unavailable"'));
assert.ok(hook.includes("cancelRef.current?.()"));

const body = fs.readFileSync("features/trip-clip/BodyFrameVideoScreen.tsx", "utf8");
const legacy = fs.readFileSync("features/trip-clip/TripClipScreen.tsx", "utf8");
assert.ok(body.includes('requestRewardedFeatureAd("변화 영상 만들기")'));
assert.ok(body.indexOf("requestRewardedFeatureAd(") < body.indexOf("recordProjectVideo(controller.signal)"));
assert.equal(body.includes("requestPostSaveAd("), false);
assert.ok(legacy.includes('requestRewardedFeatureAd(exportFormat === "mp4" ? "영상 저장" : "이미지 저장")'));
assert.ok(legacy.includes('requestRewardedFeatureAd(exportFormat === "mp4" ? "영상 공유" : "이미지 공유")'));
assert.equal(legacy.includes("setIsPostSaveAdVisible"), false);
console.log("ok - rewarded export ad requires explicit opt-in, earned reward, and verified ad-free bypass");

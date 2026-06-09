import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";

const nativeModuleName = "react-native-google-mobile-ads";
const nativeFiles = [
  "components/google-mobile-banner.tsx",
  "components/google-mobile-interstitial.ts",
  "lib/admob-native.ts"
];

for (const filePath of nativeFiles) {
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(
    source.includes(`from "${nativeModuleName}"`),
    false,
    `${filePath} must not statically import the AdMob native module`
  );
  assert.ok(
    source.includes(`require("${nativeModuleName}")`),
    `${filePath} should lazy require the AdMob native module`
  );
  assert.ok(
    /try\s*\{[\s\S]*require\("react-native-google-mobile-ads"\)[\s\S]*\}\s*catch/.test(source),
    `${filePath} should catch missing native module errors`
  );
}

const importTsModule = async (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const tempPath = path.join(
    os.tmpdir(),
    `picture-${path.basename(filePath).replace(/\W+/g, "-")}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`
  );

  fs.writeFileSync(tempPath, output);
  return import(pathToFileURL(tempPath).href);
};

const interstitialModule = await importTsModule("components/google-mobile-interstitial.ts");
assert.equal(
  typeof interstitialModule.createGoogleMobileInterstitialAdPresenter,
  "function",
  "interstitial wrapper should expose an injectable presenter for runtime behavior tests"
);

let completions = 0;
const showMissingInterstitial = interstitialModule.createGoogleMobileInterstitialAdPresenter(
  () => null
);
const unsubscribeMissing = showMissingInterstitial({
  adUnitId: "unit",
  onComplete: () => {
    completions += 1;
  }
});
assert.equal(completions, 1, "missing native module should complete immediately");
assert.equal(typeof unsubscribeMissing, "function", "missing native module should return cleanup");

const listeners = new Map();
let showCalls = 0;
let loadCalls = 0;
const showWithFailingShow = interstitialModule.createGoogleMobileInterstitialAdPresenter(() => ({
  AdEventType: { LOADED: "loaded", CLOSED: "closed", ERROR: "error" },
  InterstitialAd: {
    createForAdRequest: () => ({
      addAdEventListener: (eventType, listener) => {
        listeners.set(eventType, listener);
        return () => listeners.delete(eventType);
      },
      load: () => {
        loadCalls += 1;
      },
      show: () => {
        showCalls += 1;
        throw new Error("show failed");
      }
    })
  }
}));

completions = 0;
showWithFailingShow({
  adUnitId: "unit",
  onComplete: () => {
    completions += 1;
  }
});
assert.equal(loadCalls, 1, "interstitial should call load once");
listeners.get("loaded")();
assert.equal(showCalls, 1, "loaded interstitial should call show once");
assert.equal(completions, 1, "show failure should complete once");
listeners.get("closed")?.();
listeners.get("error")?.();
assert.equal(completions, 1, "CLOSED/ERROR after completion should not complete again");

const showWithFailingLoad = interstitialModule.createGoogleMobileInterstitialAdPresenter(() => ({
  AdEventType: { LOADED: "loaded", CLOSED: "closed", ERROR: "error" },
  InterstitialAd: {
    createForAdRequest: () => ({
      addAdEventListener: () => () => undefined,
      load: () => {
        throw new Error("load failed");
      },
      show: () => undefined
    })
  }
}));

completions = 0;
showWithFailingLoad({
  adUnitId: "unit",
  onComplete: () => {
    completions += 1;
  }
});
assert.equal(completions, 1, "load failure should complete once");

let duplicateCompletions = 0;
const duplicateListeners = new Map();
const showWithDuplicateTerminalEvents =
  interstitialModule.createGoogleMobileInterstitialAdPresenter(() => ({
    AdEventType: { LOADED: "loaded", CLOSED: "closed", ERROR: "error" },
    InterstitialAd: {
      createForAdRequest: () => ({
        addAdEventListener: (eventType, listener) => {
          duplicateListeners.set(eventType, listener);
          return () => undefined;
        },
        load: () => undefined,
        show: () => undefined
      })
    }
  }));

showWithDuplicateTerminalEvents({
  adUnitId: "unit",
  onComplete: () => {
    duplicateCompletions += 1;
  }
});
duplicateListeners.get("closed")();
duplicateListeners.get("error")();
duplicateListeners.get("closed")();
assert.equal(
  duplicateCompletions,
  1,
  "CLOSED/ERROR duplicate events should call onComplete only once"
);

const admobModule = await importTsModule("lib/admob-native.ts");
assert.equal(
  typeof admobModule.createNativeAdMobInitializer,
  "function",
  "AdMob initializer should expose an injectable initializer for runtime behavior tests"
);

let initialized = 0;
await admobModule.createNativeAdMobInitializer(() => null)();
await admobModule.createNativeAdMobInitializer(() => () => ({
  initialize: () => {
    initialized += 1;
  }
}))();
assert.equal(initialized, 1, "native initializer should initialize when the module is present");

const bannerSource = fs.readFileSync("components/google-mobile-banner.tsx", "utf8");
assert.ok(
  bannerSource.includes("return null"),
  "banner wrapper should render nothing when the native module is unavailable"
);

console.log("ok - AdMob native module is lazy-loaded and interstitial fallbacks execute safely");

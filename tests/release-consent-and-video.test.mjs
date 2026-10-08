import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let failures = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (error) { failures++; console.error(`not ok - ${name}: ${error.message}`); }
};
const loadController = () => {
  const file = "lib/ad-consent.ts";
  assert.ok(fs.existsSync(file), "consent controller must exist");
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module, exports: module.exports,
    require: id => {
      assert.equal(id, "@/lib/admob-native");
      return { initializeNativeAdMob: async () => {} };
    }
  });
  return module.exports.createAdConsentController;
};
const consentFixture = (options = {}) => {
  const events = [];
  let info = { canRequestAds: !options.denied, privacyOptionsRequirementStatus: "REQUIRED" };
  const api = {
    gatherConsent: async () => {
      events.push("gather");
      if (options.gatherFails) throw new Error("offline");
      return info;
    },
    getConsentInfo: async () => {
      if (options.infoFails) throw new Error("no info");
      return info;
    },
    showPrivacyOptionsForm: async () => {
      events.push("privacy");
      assert.equal(controller.getSnapshot().canRequestAds, false, "block requests while privacy form is open");
      info = { ...info, canRequestAds: false };
    }
  };
  const controller = loadController()(
    () => options.missing ? null : api,
    async () => { events.push("initialize"); }
  );
  return { controller, events };
};
await check("denied consent never initializes Mobile Ads", async () => {
  const { controller, events } = consentFixture({ denied: true });
  assert.equal(await controller.prepareAds(), false);
  assert.deepEqual(events, ["gather"]);
});
await check("consent is gathered before one deduplicated initialization", async () => {
  const { controller, events } = consentFixture();
  await Promise.all([controller.prepareAds(), controller.prepareAds()]);
  assert.deepEqual(events, ["gather", "initialize"]);
  assert.equal(controller.getSnapshot().canRequestAds, true);
});
await check("unavailable consent and absent SDK fail closed", async () => {
  for (const options of [{ gatherFails: true, infoFails: true }, { missing: true }]) {
    const { controller, events } = consentFixture(options);
    assert.equal(await controller.prepareAds(), false);
    assert.equal(events.includes("initialize"), false);
  }
});
await check("previous SDK consent is checked after a transient info refresh failure", async () => {
  const { controller, events } = consentFixture({ gatherFails: true });
  assert.equal(await controller.prepareAds(), true);
  assert.deepEqual(events, ["gather", "initialize"]);
});
await check("privacy withdrawal blocks new requests without reinitializing SDK", async () => {
  const { controller, events } = consentFixture();
  await controller.prepareAds();
  await controller.showPrivacyOptions();
  assert.equal(controller.getSnapshot().canRequestAds, false);
  assert.deepEqual(events, ["gather", "initialize", "privacy"]);
});
await check("Expo config delays automatic ad measurement", () => {
  const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const plugin = app.expo.plugins.find(item => Array.isArray(item) && item[0] === "react-native-google-mobile-ads");
  assert.equal(plugin[1].delayAppMeasurementInit, true);
});

const video = fs.readFileSync("features/trip-clip/BodyFrameVideoScreen.tsx", "utf8");
const ast = ts.createSourceFile("video.tsx", video, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "createVideo") {
    callback = node.initializer.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(callback);
const runnable = ts.transpileModule(`globalThis.run = ${callback};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const exportFixture = async ({ saveFails = false, adThrows = false } = {}) => {
  const events = [];
  const messages = [];
  const context = {
    activeProject: { id: "test-project", name: "test" }, projectPhotos: [{ id: "photo", uri: "file:///photo.jpg" }],
    isExporting: false, isLoggedIn: true, guestUsage: null,
    planEntitlements: { canExportVideo: true, localVideoLimit: 30, label: "무료", weeklyVideoExportLimit: 0 },
    videoLimitState: { allowed: true }, previewPhoto: null, videoOptions: { ratio: "9:16" }, totalDuration: 1,
    durations: [], BODY_FRAME_VIDEO_TEMPLATE: "basic", BODY_FRAME_VIDEO_TRANSITION: "none", BODY_FRAME_VIDEO_TRANSITION_DURATION: 0,
    formatDuration: value => `${value}초`, setIsExporting: value => { if (!value) events.push("finished"); },
    setExportProgress: () => {}, setMessage: value => messages.push(value), setGuestUsage: () => {},
    getMadeVideos: async () => [], assertLocalLibraryCapacity: () => {},
    recordProjectVideo: async () => "file:///video.mp4",
    saveVideoToLibrary: async () => events.push("album"),
    saveMadeVideo: async () => { if (saveFails) throw new Error("save failed"); events.push("local"); },
    recordGuestWeeklyVideoExport: async () => ({}), getUserFacingErrorMessage: error => error.message,
    cancelPostSaveAd: () => {},
    requestPostSaveAd: () => { events.push("ad"); if (adThrows) throw new Error("ad failed"); }
  };
  vm.runInNewContext(runnable, context);
  await context.run();
  return { events, messages };
};
await check("current Body Frame export requests an ad only after durable save and completion", async () => {
  const { events } = await exportFixture();
  assert.deepEqual(events, ["album", "local", "finished", "ad"]);
});
await check("failed local video save never requests an ad", async () => {
  const { events } = await exportFixture({ saveFails: true });
  assert.equal(events.includes("ad"), false);
});
await check("unexpected ad failure cannot overwrite successful save feedback", async () => {
  const { messages, events } = await exportFixture({ adThrows: true });
  assert.equal(events.includes("ad"), true);
  assert.match(messages.at(-1), /저장했습니다/);
});
if (failures) throw new Error(`${failures} consent/video regressions`);

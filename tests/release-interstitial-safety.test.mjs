import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(fs.readFileSync("components/google-mobile-interstitial.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const fixture = ({ createThrows = false } = {}) => {
  let now = 1000000;
  let completed = 0;
  const timers = new Map();
  const ads = [];
  const module = { exports: {} };
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(source, {
    module, exports: module.exports, require: () => null, Date: Clock,
    setTimeout: (fn, ms) => { const id = {}; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  const native = {
    AdEventType: { LOADED: "loaded", CLOSED: "closed", ERROR: "error" },
    InterstitialAd: { createForAdRequest: () => {
      if (createThrows) throw new Error("native unavailable");
      const ad = { events: {}, shown: 0, removed: 0, load() {}, show() { this.shown++; },
        addAdEventListener(type, listener) { this.events[type] = listener; return () => { this.removed++; }; }
      };
      ads.push(ad);
      return ad;
    } }
  };
  const present = module.exports.createGoogleMobileInterstitialAdPresenter(() => native);
  const start = (canShow = () => true) => present({ adUnitId: "test-unit", canShow, onComplete: () => { completed++; } });
  const advance = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) { timers.delete(id); timer.fn(); }
    }
  };
  return { start, ads, timers, advance, get completed() { return completed; } };
};
let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { failures++; console.error(`not ok - ${name}: ${error.message}`); }
};
check("native creation failure completes without throwing into video save", () => {
  const f = fixture({ createThrows: true });
  assert.doesNotThrow(() => f.start());
  assert.equal(f.completed, 1);
});
check("denied entitlement or consent cannot create an ad", () => {
  const f = fixture(); f.start(() => false);
  assert.equal(f.ads.length, 0); assert.equal(f.completed, 1);
});
check("authorization is checked again when loading finishes", () => {
  const f = fixture(); let allowed = true; f.start(() => allowed); allowed = false;
  f.ads[0].events.loaded(); assert.equal(f.ads[0].shown, 0); assert.equal(f.completed, 1);
});
check("screen cleanup rejects already queued late callbacks", () => {
  const f = fixture(); const cancel = f.start(); const late = f.ads[0].events.loaded;
  cancel(); late(); assert.equal(f.ads[0].shown, 0); assert.equal(f.timers.size, 0);
});
check("stalled loading expires within three seconds and rejects late success", () => {
  const f = fixture(); f.start(); const late = f.ads[0].events.loaded;
  f.advance(3000); assert.equal(f.completed, 1); late(); assert.equal(f.ads[0].shown, 0);
});
check("only one interstitial may be loading or visible", () => {
  const f = fixture(); f.start(); f.start(); assert.equal(f.ads.length, 1);
});
check("successful display enforces a two-minute interval", () => {
  const f = fixture(); f.start(); f.ads[0].events.loaded(); f.ads[0].events.closed();
  f.start(); assert.equal(f.ads.length, 1);
  f.advance(120000); f.start(); assert.equal(f.ads.length, 2);
});
check("SDK errors complete once and clear pending timers", () => {
  const f = fixture(); f.start(); f.ads[0].events.error(); f.ads[0].events.closed();
  assert.equal(f.completed, 1); assert.equal(f.timers.size, 0);
});
if (failures) throw new Error(`${failures} interstitial safety regressions`);

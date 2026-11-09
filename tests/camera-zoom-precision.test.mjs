import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Run the actual model, settings and project persistence; only the native storage boundary is replaced.
const stored = new Map();
const modules = new Map();
const storage = {
  async getItem(key) { return stored.get(key) ?? null; },
  async setItem(key, value) { stored.set(key, value); }
};
function loadModule(relativePath) {
  if (modules.has(relativePath)) return modules.get(relativePath);
  const exports = {};
  modules.set(relativePath, exports);
  const source = fs.readFileSync(relativePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === "@/lib/local-storage") return { localStorageAdapter: storage };
      if (name.startsWith("@/")) return loadModule(path.posix.normalize(`${name.slice(2)}.ts`));
      throw new Error(`Unexpected runtime dependency: ${name}`);
    }
  }, { filename: relativePath });
  return exports;
}

const model = loadModule("features/camera/camera-screen.model.ts");
const settings = loadModule("lib/app-settings.ts");
const capture = loadModule("lib/body-frame-capture-context.ts");

test("preset factor roundtrips stay within 0.001x even with a 1000x native maximum", () => {
  for (const maxZoom of [100, 1000]) {
    const device = { minZoom: 0.5, maxZoom };
    const presets = model.getCameraZoomPresets("back", ["wide-angle", "ultra-wide-angle"], device);
    assert.deepEqual(Array.from(presets, preset => preset.factor), [0.5, 1, 3, 5, 10]);
    for (const preset of presets) {
      const percent = model.getCameraZoomPercentFromFactor(preset.factor, device);
      const restoredFactor = model.getCameraZoomFactorFromPercent(percent, device);
      assert.ok(
        Math.abs(restoredFactor - preset.factor) <= 0.001,
        `${preset.label} at maximum ${maxZoom}: restored ${restoredFactor}x from ${percent}%`
      );
    }
  }
  assert.equal(model.getCameraZoomPercentFromFactor(1, { minZoom: 0.5, maxZoom: 100 }), 0.5025);
});

test("settings JSON save and reload preserve four-place zoom without changing other settings or the v1 key", async () => {
  stored.clear();
  const input = {
    ...settings.defaultAppSettings,
    cameraZoomPercent: 0.502512563,
    cameraFacing: "front",
    cameraRatio: "4:5",
    cameraSaveScope: "app",
    cameraExposureBias: -0.75,
    guideVisible: false
  };
  await settings.saveAppSettings(input);
  const serialized = JSON.parse(stored.get("travel-frame.settings.v1"));
  assert.equal(serialized.cameraZoomPercent, 0.5025);
  const restored = await settings.getAppSettings();
  assert.equal(restored.cameraZoomPercent, 0.5025);
  const { cameraZoomPercent: ignored, ...otherInput } = input;
  const { cameraZoomPercent: restoredZoom, ...otherRestored } = restored;
  assert.equal(ignored, 0.502512563);
  assert.equal(restoredZoom, 0.5025);
  assert.deepEqual(JSON.parse(JSON.stringify(otherRestored)), JSON.parse(JSON.stringify(otherInput)));
  assert.deepEqual([...stored.keys()], ["travel-frame.settings.v1"]);
});

test("project context JSON save and reload preserve fractional zoom and independent project policy", async () => {
  stored.clear();
  await capture.updateBodyCaptureContextEnabled("current-project", false);
  const context = capture.createBodyCaptureContextFromAppSettings({
    ...settings.defaultAppSettings,
    cameraZoomPercent: 0.502512563,
    cameraFacing: "front",
    cameraRatio: "4:5",
    cameraExposureBias: -0.75
  });
  await capture.saveBodyCaptureContext("other-project", { ...context, cameraZoomPercent: 42 });
  await capture.saveBodyCaptureContext("current-project", context);
  const serialized = JSON.parse(stored.get("body.frame.capture.context.v1"));
  assert.equal(serialized["current-project"].context.cameraZoomPercent, 0.5025);
  const restored = await capture.getBodyCaptureContextState("current-project");
  assert.equal(restored.context.cameraZoomPercent, 0.5025);
  assert.equal(restored.enabled, false);
  assert.equal(restored.context.cameraFacing, "front");
  assert.equal(restored.context.cameraRatio, "4:5");
  assert.equal(restored.context.cameraExposureBias, -0.75);
  assert.equal((await capture.getBodyCaptureContextState("other-project")).context.cameraZoomPercent, 42);
  assert.equal((await capture.getBodyCaptureContextState("other-project")).enabled, true);
  assert.deepEqual([...stored.keys()], ["body.frame.capture.context.v1"]);
});

test("normalization keeps legacy integer zoom and existing finite, clamp and fallback behavior", async () => {
  for (const [input, expected] of [[0, 0], [37, 37], [100, 100], [-1, 0], [101, 100], [1.234567, 1.2346], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0]]) {
    await settings.saveAppSettings({ ...settings.defaultAppSettings, cameraZoomPercent: input });
    assert.equal((await settings.getAppSettings()).cameraZoomPercent, expected, `settings zoom ${input}`);
    assert.equal(capture.createBodyCaptureContextFromAppSettings({
      ...settings.defaultAppSettings,
      cameraZoomPercent: input
    }).cameraZoomPercent, expected, `project zoom ${input}`);
  }
});

test("high zoom remains accurate after settings and project serialization together", async () => {
  for (const maxZoom of [100, 1000]) {
    const device = { minZoom: 0.5, maxZoom };
    for (const factor of [0.5, 1, 3, 5, 10]) {
      const percent = model.getCameraZoomPercentFromFactor(factor, device);
      await settings.saveAppSettings({ ...settings.defaultAppSettings, cameraZoomPercent: percent });
      const restoredSettings = await settings.getAppSettings();
      await capture.saveBodyCaptureContext("roundtrip-project", capture.createBodyCaptureContextFromAppSettings(restoredSettings));
      const restored = await capture.getBodyCaptureContextState("roundtrip-project");
      const restoredFactor = model.getCameraZoomFactorFromPercent(restored.context.cameraZoomPercent, device);
      assert.ok(Math.abs(restoredFactor - factor) <= 0.001, `${factor}x at maximum ${maxZoom}: restored ${restoredFactor}x`);
    }
  }
});

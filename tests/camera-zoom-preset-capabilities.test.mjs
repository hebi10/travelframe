import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const modelExports = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync("features/camera/camera-screen.model.ts", "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
).outputText, {
  exports: modelExports,
  require(moduleName) {
    // The model only needs this unrelated color constant at module initialization.
    if (moduleName === "@/lib/app-settings") return { DEFAULT_GUIDE_COLOR: "#FFFFFF" };
    throw new Error(`Unexpected model dependency: ${moduleName}`);
  }
});

const { getCameraZoomPresets, getCameraZoomPresetFactor } = modelExports;
const wide = ["wide-angle"];
const ultraWide = ["wide-angle", "ultra-wide-angle"];

// These fixtures catch candidates whose label promises a factor the native device cannot accept.
for (const { name, facing = "back", lenses = wide, device, expected } of [
  { name: "fixed rear camera", device: { minZoom: 1, maxZoom: 1 }, expected: ["1x"] },
  { name: "rear maximum below the next preset", device: { minZoom: 1, maxZoom: 2 }, expected: ["1x"] },
  { name: "rear maximum between presets", device: { minZoom: 1, maxZoom: 4 }, expected: ["1x", "3x"] },
  { name: "inclusive maximum", device: { minZoom: 1, maxZoom: 5 }, expected: ["1x", "3x", "5x"] },
  { name: "minimum excludes lower presets", device: { minZoom: 2, maxZoom: 10 }, expected: ["3x", "5x", "10x"] },
  { name: "supported ultra-wide", lenses: ultraWide, device: { minZoom: 0.5, maxZoom: 10 }, expected: ["0.5x", "1x", "3x", "5x", "10x"] },
  { name: "ultra-wide lens without half zoom", lenses: ultraWide, device: { minZoom: 1, maxZoom: 10 }, expected: ["1x", "3x", "5x", "10x"] },
  { name: "half zoom without ultra-wide lens", device: { minZoom: 0.5, maxZoom: 10 }, expected: ["1x", "3x", "5x", "10x"] },
  { name: "fixed front camera", facing: "front", device: { minZoom: 1, maxZoom: 1 }, expected: ["1x"] },
  { name: "front maximum below three", facing: "front", device: { minZoom: 1, maxZoom: 2 }, expected: ["1x"] },
  { name: "front keeps its reduced candidate set", facing: "front", lenses: ultraWide, device: { minZoom: 0.5, maxZoom: 100 }, expected: ["1x", "3x"] },
  { name: "high maximum does not invent more presets", lenses: ultraWide, device: { minZoom: 0.5, maxZoom: 100 }, expected: ["0.5x", "1x", "3x", "5x", "10x"] },
  { name: "no candidate within a valid range", device: { minZoom: 2, maxZoom: 2 }, expected: [] },
  { name: "no device", device: undefined, expected: [] },
  { name: "unknown native bounds", device: { minZoom: 0, maxZoom: 0 }, expected: [] },
  { name: "invalid minimum", device: { minZoom: Number.NaN, maxZoom: 10 }, expected: [] },
  { name: "invalid maximum", device: { minZoom: 1, maxZoom: Number.POSITIVE_INFINITY }, expected: [] },
  { name: "inverted bounds", device: { minZoom: 4, maxZoom: 1 }, expected: [] }
]) {
  const presets = Array.from(getCameraZoomPresets(facing, lenses, device));
  assert.deepEqual(presets.map(preset => preset.label), expected, name);
  const factors = presets.map(preset => getCameraZoomPresetFactor(preset, device));
  assert.deepEqual(factors, presets.map(preset => preset.factor), `${name}: displayed factors must not be clamped`);
  assert.equal(new Set(factors).size, presets.length, `${name}: each visible preset has a distinct target`);
}

console.log("ok - camera zoom presets expose only distinct factors supported by the selected device");

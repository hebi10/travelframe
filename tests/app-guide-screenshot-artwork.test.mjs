import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function loadTs(filename, requireAsset = () => { throw new Error("Unexpected runtime import"); }) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("require", "module", "exports", compiled)(requireAsset, module, module.exports);
  return module.exports;
}

const { APP_GUIDE_STEPS } = loadTs("constants/app-guide-steps.ts");
const loadedAssets = new Set();
const { getAppGuideArtwork } = loadTs("constants/app-guide-artwork.ts", (relativePath) => {
  const filename = path.resolve("constants", relativePath);
  assert.ok(filename.startsWith(path.resolve("assets/ui/guides") + path.sep), "Guide images must use the dedicated screenshot assets");
  const png = fs.readFileSync(filename);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${filename} must be a real PNG`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.ok(width >= 800 && height >= 500, `${filename} must remain readable after enlargement`);
  assert.ok(width / height >= 1.3 && width / height <= 1.8, `${filename} must be a landscape detail, not a tiny full-phone screenshot`);
  loadedAssets.add(filename);
  return filename;
});

for (const steps of Object.values(APP_GUIDE_STEPS)) {
  for (const step of steps) {
    assert.ok(getAppGuideArtwork(step.id), `Missing screenshot guidance for ${step.id}`);
  }
}
assert.equal(getAppGuideArtwork("unknown-guide"), null, "Unknown guides must not display unrelated instructions");
assert.equal(loadedAssets.size, 7, "Shared guide steps should reuse the seven relevant captured details");
console.log("ok - every guide step has a readable real-screen PNG, including welcome replay and account guidance");

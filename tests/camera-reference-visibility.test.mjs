import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("features/camera/CameraScreen.tsx", "utf8");
const ast = ts.createSourceFile("camera.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function runHandler(name, scope) {
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer, `${name} exists`);
  const js = ts.transpileModule(`const handler = ${initializer.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function(...Object.keys(scope), `${js}; handler();`)(...Object.values(scope));
}

let visible = true;
let locked = true;
let setup = true;
let resets = 0;
const persistedPatches = [];

const scope = {
  setReferencePhotoVisible: value => { visible = value; },
  queueAppSettingsUpdate: patch => { persistedPatches.push(patch); },
  setOverlayLocked: value => { locked = value; },
  setOverlaySetupActive: value => { setup = value; },
  setOverlayOpacity: () => {},
  defaultOverlayOpacity: { current: 0.4 },
  referenceOverlayRef: { current: { reset: () => { resets++; } } },
  setOverlayResetKey: () => { assert.fail("Hiding must not reassign a stale manual guide to the current project"); },
  setReferenceUri: () => { assert.fail("Hiding must retain the current guide for restoring"); }
};

runHandler("removeReferenceOverlay", scope);
assert.equal(visible, false);
assert.deepEqual(persistedPatches.at(-1), { referencePhotoVisible: false });
assert.equal(setup, false);
assert.equal(locked, false);
assert.equal(resets, 1);

runHandler("reopenOverlaySetup", {
  ...scope,
  referenceOverlayVisible: false,
  hasReferenceSource: true
});
assert.equal(visible, true);
assert.deepEqual(persistedPatches.at(-1), { referencePhotoVisible: true });
assert.equal(setup, true);

console.log("ok - reference guide visibility persists while retaining the current guide image");

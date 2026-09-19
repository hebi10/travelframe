import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function handler(file, name, scope) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let node;
  function visit(item) {
    if (ts.isVariableDeclaration(item) && item.name.getText(ast) === name) node = item.initializer;
    ts.forEachChild(item, visit);
  }
  visit(ast);
  assert.ok(node, `${name} must exist`);
  const js = ts.transpileModule(`const fn = ${node.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return fn;`)(...Object.values(scope));
}

for (const mode of ["first", "latest"]) {
  let resolve;
  let projectId = "a";
  let changes = 0;
  let cleared = 0;
  const lock = { current: false };
  const toggle = handler("features/camera/CameraScreen.tsx", "toggleProjectReference", {
    projectReferenceMode: mode,
    onProjectReferenceModeChange: async (id, nextMode) => {
      assert.equal(id, "a");
      assert.equal(nextMode, mode === "first" ? "latest" : "first");
      changes++;
      await new Promise(done => { resolve = done; });
    },
    bodyFrameCameraSession: { projectId: "a", projectPhotoCount: 2 },
    referenceModeChangeInProgressRef: lock,
    setIsReferenceModeChanging: () => {},
    setErrorMessage: () => {},
    getBodyFrameCameraSessionSnapshot: () => ({ projectId }),
    setReferenceUri: () => { cleared++; },
    referenceOverlayRef: { current: { reset: () => {} } },
    setOverlayLocked: () => {},
    getUserFacingErrorMessage: error => error.message
  });
  const pending = toggle();
  await toggle();
  assert.equal(changes, 1, "double taps must not race project setting writes");
  if (mode === "first") projectId = "b";
  resolve();
  await pending;
  assert.equal(cleared, mode === "first" ? 0 : 1, "completion must not clear another project's guide");
  assert.equal(lock.current, false);
}
let projects = [{ id: "a", referenceMode: "latest" }, { id: "b", referenceMode: "latest" }];
const changeMode = handler("features/camera/BodyFrameCameraScreen.tsx", "handleChangeReferenceMode", {
  useCallback: fn => fn,
  activeProject: projects[0],
  updateBodyProject: async (id, patch) => ({ id, ...patch }),
  setProjects: update => { projects = update(projects); }
});
await changeMode("a", "first");
assert.equal(projects[0].referenceMode, "first");
assert.equal(projects[1].referenceMode, "latest");
await assert.rejects(() => changeMode("b", "first"));
console.log("ok - project guide toggles first/latest, persists only the selected project and guards project changes");

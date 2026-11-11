import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const helper = fs.readFileSync("features/records/comparison-pan-gesture.ts", "utf8");
const compiled = ts.transpileModule(helper, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true
});
assert.deepEqual(compiled.diagnostics ?? [], [], "comparison gesture helper must compile");
const exports = {};
vm.runInNewContext(compiled.outputText, { exports });
const shouldClaim = exports.shouldStartComparisonPan;

test("vertical drags and minor touches are left to the page ScrollView", () => {
  for (const [dx, dy] of [[0, 0], [0, 40], [4, 30], [-6, -60], [8, 0], [-8, 0], [10, 25], [15, 20]]) {
    assert.equal(shouldClaim(dx, dy), false, `dx=${dx}, dy=${dy}`);
  }
});

test("clear horizontal motion activates the comparison slider in either direction", () => {
  for (const [dx, dy] of [[9, 0], [-9, 0], [32, 4], [-40, 8], [18, 10], [-25, -5]]) {
    assert.equal(shouldClaim(dx, dy), true, `dx=${dx}, dy=${dy}`);
  }
});

test("diagonal motion must favor the horizontal axis to claim the slider", () => {
  assert.equal(shouldClaim(20, 17), false);
  assert.equal(shouldClaim(20, 16), true);
  assert.equal(shouldClaim(-20, -17), false);
  assert.equal(shouldClaim(-20, -16), true);
});

test("comparison view waits for movement before claiming responder and keeps its controls", () => {
  const screen = fs.readFileSync("features/records/BodyFrameCompareScreen.tsx", "utf8");
  assert.match(screen, /onStartShouldSetPanResponder:\s*\(\) => false/);
  assert.match(screen, /onMoveShouldSetPanResponder:\s*\(_event, gesture\) =>\s*shouldStartComparisonPan\(gesture.dx, gesture.dy\)/);
  assert.doesNotMatch(screen, /onMoveShouldSetPanResponder:\s*\(\) => true/);
  assert.match(screen, /gestureStartRef.current \+ gesture.dx \/ widthRef.current/);
  assert.match(screen, /accessibilityRole="adjustable"/);
  assert.match(screen, /onAccessibilityAction/);
  assert.match(screen, /\[0\.25, 0\.5, 0\.75\]/);
  assert.match(screen, /<ScrollView/);
});

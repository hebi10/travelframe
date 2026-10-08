import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/body-frame-photo-compare.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);

test("compare first and last project photos by sequence without mutating input", () => {
  const original = [
    { id: "last", projectId: "a", sequence: 4, createdAt: "2026-02-02" },
    { id: "other", projectId: "b", sequence: 1, createdAt: "2026-01-01" },
    { id: "first", projectId: "a", sequence: 1, createdAt: "2026-02-01" },
    { id: "middle", projectId: "a", sequence: 3, createdAt: "2026-02-01" }
  ];
  const result = context.exports.getBodyFrameComparisonPhotos(original, "a");
  assert.equal(result.before.id, "first");
  assert.equal(result.after.id, "last");
  assert.equal(original[0].id, "last");
});

test("no comparison until a project has two valid photos", () => {
  assert.equal(context.exports.getBodyFrameComparisonPhotos([{ id: "x", projectId: "a", sequence: 1 }], "a"), null);
  assert.equal(context.exports.getBodyFrameComparisonPhotos([
    { id: "x", projectId: "a", sequence: 1 },
    { id: "y", projectId: "a", sequence: 0 }
  ], "a"), null);
});

test("comparison route uses the existing account-aware image component", () => {
  const screen = fs.readFileSync("features/records/BodyFrameCompareScreen.tsx", "utf8");
  const detail = fs.readFileSync("features/records/BodyFrameProjectDetailScreen.tsx", "utf8");
  const layout = fs.readFileSync("app/_layout.tsx", "utf8");
  assert.ok(screen.includes("@/components/private-media-image"));
  assert.ok(screen.includes("PanResponder.create"));
  assert.ok(detail.includes("전후 사진 비교"));
  assert.ok(layout.includes('name="project/[id]/compare"'));
});

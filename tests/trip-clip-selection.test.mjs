import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/trip-clip-selection.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const { deselectTripClipPhoto } = await import(
  `data:text/javascript,${encodeURIComponent(transpiled)}`
);

const result = deselectTripClipPhoto({
  photoId: "photo-2",
  selectedIds: ["photo-1", "photo-2", "photo-3"],
  durations: {
    "photo-1": 3,
    "photo-2": 4,
    "photo-3": 5
  },
  activeIndex: 2
});

assert.deepEqual(result.selectedIds, ["photo-1", "photo-3"]);
assert.deepEqual(result.durations, {
  "photo-1": 3,
  "photo-3": 5
});
assert.equal(result.activeIndex, 1);

console.log("ok - trip clip photo deselection keeps library photos intact");

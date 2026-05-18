import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourceUrl = new URL("../lib/media-library-availability.ts", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const {
  assertCanSaveToMediaLibrary,
  canSaveToMediaLibrary,
  MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE
} = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

assert.equal(canSaveToMediaLibrary(undefined), false);
assert.equal(canSaveToMediaLibrary({}), false);
assert.equal(canSaveToMediaLibrary({ saveToLibraryAsync: undefined }), false);
assert.equal(canSaveToMediaLibrary({ saveToLibraryAsync: async () => {} }), true);

assert.throws(
  () => assertCanSaveToMediaLibrary({}),
  new RegExp(MEDIA_LIBRARY_SAVE_UNAVAILABLE_MESSAGE)
);

console.log("ok - media library save availability is guarded");

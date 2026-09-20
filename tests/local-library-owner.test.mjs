import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const data = new Map();
const exports = {};
const source = fs.readFileSync("lib/local-library-owner.ts", "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports, require: () => ({ localStorageAdapter: {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); }
  } })
});
const { checkLocalLibraryAccess: check, claimLocalLibrary: claim, assertLocalLibraryOwner: assertOwner } = exports;
assert.equal(await check(null), "allowed");
assert.equal(await check("A"), "allowed");
await assertOwner("A");
assert.equal(await check(null), "locked");
assert.equal(await check("B"), "locked");
await assert.rejects(claim("B"), /다른 계정/);
await assert.rejects(assertOwner("B"));
data.clear();
data.set("travel-frame.photos.v1", JSON.stringify([{ id: "private-photo" }]));
assert.equal(await check("A"), "claim-required");
assert.equal(data.has("body-frame.local-library-owner.v1"), false);
await assert.rejects(assertOwner("A"));
await claim("A");
assert.equal(await check("A"), "allowed");
assert.equal(data.get("travel-frame.photos.v1"), '[{"id":"private-photo"}]');
data.clear();
data.set("body-frame.measurements.v1", "broken-json");
assert.equal(await check("A"), "claim-required", "malformed existing records must not be automatically claimed");
data.clear();
const results = await Promise.all([check("A"), check("B")]);
assert.deepEqual(results, ["allowed", "locked"], "concurrent claims must preserve the first owner");
console.log("ok - library ownership preserves data and rejects implicit cross-account use");

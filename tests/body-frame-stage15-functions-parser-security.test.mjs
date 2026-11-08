import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const json = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const functions = json("functions/package.json");
const lock = json("functions/package-lock.json");
const version = (name) => lock.packages["node_modules/" + name]?.version;
test("Firebase Functions uses patched body-parser and qs while preserving Node/Firebase SDKs", () => {
  assert.equal(functions.engines.node, "22");
  assert.equal(functions.dependencies["firebase-admin"], "^14.5.0");
  assert.equal(functions.dependencies["firebase-functions"], "^7.4.0");
  assert.equal(functions.overrides["body-parser"], "1.20.9");
  assert.equal(functions.overrides.qs, "6.16.1");
  assert.equal(version("body-parser"), "1.20.9");
  assert.equal(version("qs"), "6.16.1");
  assert.equal(lock.packages[""].dependencies["firebase-functions"], "^7.4.0");
  assert.equal(lock.packages[""].dependencies["firebase-admin"], "^14.5.0");
});

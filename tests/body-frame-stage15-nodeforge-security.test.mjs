import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Expo certificate library uses patched Forge while preserving compatible SDK lines", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  assert.equal(pkg.overrides["node-forge"], "1.4.3");
  assert.equal(lock.packages["node_modules/node-forge"]?.version, "1.4.3");
  assert.equal(pkg.overrides.compression, "1.8.2");
  assert.equal(lock.packages["node_modules/compression"]?.version, "1.8.2");
  assert.equal(lock.packages["node_modules/expo"]?.version, "55.0.26");
  assert.equal(lock.packages["node_modules/expo-router"]?.version, "55.0.14");
  assert.equal(lock.packages["node_modules/react-native"]?.version, "0.83.6");
  assert.equal(lock.packages["node_modules/expo/node_modules/@expo/cli"]?.version, "55.0.32");
  const parentRange = lock.packages["node_modules/@expo/code-signing-certificates"]?.dependencies?.["node-forge"];
  assert.equal(parentRange, "^1.3.3");
});

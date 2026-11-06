import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Expo CLI compression security patch does not replace current SDK or React Native dependency overrides", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  assert.equal(pkg.overrides.compression, "1.8.2");
  assert.equal(lock.packages["node_modules/compression"].version, "1.8.2");
  assert.equal(pkg.dependencies.expo, "^55.0.0");
  assert.equal(pkg.dependencies["expo-router"], "^55.0.0");
  assert.equal(pkg.dependencies["react-native"], "0.83.6");
  assert.equal(pkg.overrides["react-native"], "0.83.6");
  assert.equal(pkg.overrides["@react-native/community-cli-plugin"].metro, "0.83.8");
  assert.equal(lock.packages["node_modules/expo/node_modules/@expo/cli"].version, "55.0.32");
  assert.equal(lock.packages["node_modules/expo/node_modules/@expo/cli"].dependencies.compression, "^1.7.4");
});

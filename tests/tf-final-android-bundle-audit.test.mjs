import assert from "node:assert/strict";
import test from "node:test";
import { analyzeAndroidSources, collectSourcePaths, packageFromSource } from "../scripts/report-android-dependency-reachability.mjs";

const map = sources => ({ version: 3, sources, sourcesContent: sources.map(() => "must-not-appear") });
const anchors = ["node_modules/react/index.js", "node_modules/react-native/index.js", "node_modules/expo-router/entry.js"];
const audit = {
  "@grpc/grpc-js": { severity: "high", nodes: ["node_modules/@grpc/grpc-js"] },
  "decode-uri-component": { severity: "high", nodes: ["node_modules/decode-uri-component"] },
  "zod": { severity: "moderate", nodes: ["node_modules/zod"] }
};
const lock = {
  "node_modules/@grpc/grpc-js": { version: "1.9.16" },
  "node_modules/decode-uri-component": { version: "0.2.2" }
};

test("scoped, nested and Windows source paths identify the actual package", () => {
  assert.equal(packageFromSource("node_modules/@firebase/firestore/dist/index.js"), "@firebase/firestore");
  assert.equal(packageFromSource("node_modules/firebase/node_modules/@grpc/grpc-js/index.js"), "@grpc/grpc-js");
  assert.equal(packageFromSource("C:\\repo\\node_modules\\query-string\\index.js"), "query-string");
  assert.equal(packageFromSource("app/node_modules-other/index.ts"), null);
  assert.equal(packageFromSource("node_modules/.cache/index.js"), null);
});

test("indexed maps and sourceRoot are handled without serializing sourcesContent", () => {
  assert.deepEqual(collectSourcePaths({ version: 3, sections: [{ map: { ...map(["react/index.js"]), sourceRoot: "node_modules" } }] }), ["node_modules/react/index.js"]);
  const report = analyzeAndroidSources([map([...anchors, "node_modules/decode-uri-component/index.js"]), map(["node_modules/decode-uri-component/index.js"])], audit, lock);
  assert.equal(report.packages.length, 2);
  assert.equal(report.packages.find(item => item.name === "decode-uri-component").androidExportSourceCount, 1);
  assert.equal(report.packages.find(item => item.name === "@grpc/grpc-js").presence, "not-observed-in-maps");
  assert.equal(report.packages[0].affectedLockLocations[0].version, "1.9.16");
  assert.ok(!JSON.stringify(report).includes("must-not-appear"));
});

test("missing maps, coverage anchors, malformed sections and mismatched lock evidence fail closed", () => {
  assert.throws(() => analyzeAndroidSources([], audit, lock), /No Android/);
  assert.throws(() => analyzeAndroidSources([map(["app/index.tsx"])], audit, lock), /Incomplete/);
  assert.throws(() => collectSourcePaths({ version: 3, sections: [{ url: "external.map" }] }), /Unresolved/);
  assert.throws(() => analyzeAndroidSources([map(anchors)], audit, {}), /mismatch/);
});

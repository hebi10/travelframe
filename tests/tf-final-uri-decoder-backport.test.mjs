import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { patchUriDecoder, verifyUriDecoderPatch } from "../scripts/patch-uri-decoder.mjs";

const require = createRequire(import.meta.url);
const queryString = require("query-string");
const queryRequire = createRequire(require.resolve("query-string"));
const installedPath = queryRequire.resolve("decode-uri-component");
const metadata = JSON.parse(fs.readFileSync(path.join(path.dirname(installedPath), "package.json"), "utf8"));
const installed = fs.readFileSync(installedPath, "utf8");
const decode = queryRequire("decode-uri-component");

test("npm postinstall patches the decoder actually loaded by query-string v7", () => {
  assert.equal(metadata.version, "0.2.2");
  verifyUriDecoderPatch(installed, metadata.version);
  assert.equal(patchUriDecoder(installed, metadata.version), installed);
  assert.throws(() => patchUriDecoder(installed, "0.5.1"), /reviewed CommonJS version/);
  assert.throws(() => patchUriDecoder("unexpected source", "0.2.2"), /unexpected installed source/);
  assert.throws(() => verifyUriDecoderPatch("unexpected source", "0.2.2"), /not installed/);
  assert.throws(() => decode(123), TypeError);
});

test("legacy CommonJS query decoding preserves plus, Korean text, UTF-8 and percent literals", () => {
  for (const [encoded, expected] of [
    ["a+b+c", "a b c"],
    ["%2B", "+"],
    ["%ED%95%9C%EA%B8%80", "한글"],
    ["%F0%9F%98%80", "\u{1F600}"],
    ["%2525", "%25"],
    ["%FE%FF", "\uFFFD\uFFFD"],
    ["%C2x", "\uFFFDx"],
    ["%C2%B5%", "µ%"],
    ["%7B%ab%7C%de%7D", "{%ab|%de}"],
    ["%%25%%", "%%%%"],
    ["%C3%5A%A5", "%C3Z%A5"]
  ]) assert.equal(decode(encoded), expected, encoded);
  const parsed = queryString.parse("name=%ED%95%9C%EA%B8%80+Test&tab=records&tag=a&tag=b&literal=%2525");
  assert.equal(parsed.name, "한글 Test");
  assert.equal(parsed.tab, "records");
  assert.deepEqual(parsed.tag, ["a", "b"]);
  assert.equal(parsed.literal, "%25");
});

test("malformed escapes decode once without recursion or rescanning replacements", () => {
  assert.equal(decode("%25%34%31%zz"), "%41%zz");
  assert.equal(decode("%25C2%zz"), "%C2%zz");
  const malformed = "%A5".repeat(2048) + "%41%zz";
  assert.equal(decode(malformed), "%A5".repeat(2048) + "A%zz");
  assert.equal(queryString.parse("name=%E0%A4%A&tab=records").tab, "records");
});

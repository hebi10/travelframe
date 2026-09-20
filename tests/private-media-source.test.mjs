import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const file = new URL("../lib/private-media-source.ts", import.meta.url);
assert.ok(fs.existsSync(file), "private image sources must resolve before native rendering");
const calls = [];
const context = { exports: {}, require: () => ({ resolvePrivateMediaUri: async (uri) => {
  calls.push(uri);
  if (uri.includes("forbidden")) throw new Error("denied");
  return uri.startsWith("https:") ? "file:///private/cache.jpg" : uri;
} }) };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, context);
const { resolvePrivateImageSource, hasRemoteImageSource } = context.exports;
assert.equal(await resolvePrivateImageSource(7), 7);
assert.equal(hasRemoteImageSource({ uri: "file:///local.jpg" }), false);
const item = await resolvePrivateImageSource({ uri: "https://storage/photo", width: 80 });
assert.equal(item.uri, "file:///private/cache.jpg");
assert.equal(item.width, 80);
assert.equal(hasRemoteImageSource([{ uri: "file:///local.jpg" }, { uri: "https://storage/photo" }]), true);
const array = await resolvePrivateImageSource([{ uri: "https://storage/photo" }, 7]);
assert.equal(array[0].uri, "file:///private/cache.jpg");
assert.equal(array[1], 7);
await assert.rejects(resolvePrivateImageSource({ uri: "https://storage/forbidden" }), /denied/);
assert.equal(await resolvePrivateImageSource("https://storage/photo"), "file:///private/cache.jpg");
console.log("ok - private media sources resolve arrays and reject denied media without fallback");

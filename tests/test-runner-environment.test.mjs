import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

test("source preload normalizes CRLF text, including split sources, without changing buffers", () => {
  const binary = Buffer.from("first\r\nsecond\r\n");
  const mockFs = { readFileSync: (file, encoding) => {
    if (!encoding) return binary;
    return String(file).endsWith("legacy-photo-library.ts") ? "legacy\r\n" : "wrapper\r\n";
  } };
  const source = fs.readFileSync("tests/source-split-compat-preload.mjs", "utf8");
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, ""), {
    fs: mockFs, path, process, syncBuiltinESMExports: () => {}
  });
  assert.equal(mockFs.readFileSync("source.ts", "utf8"), "wrapper\n");
  assert.equal(mockFs.readFileSync("lib/photo-library.ts", "utf8"), "legacy\n\nwrapper\n");
  assert.equal(mockFs.readFileSync("source.ts"), binary);
});

const runWithMissingAndroid = (testFile) => {
  const source = fs.readFileSync("scripts/run-tests.mjs", "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replaceAll("import.meta.url", '"file:///workspace/scripts/run-tests.mjs"');
  const messages = [];
  const children = [];
  let status = 0;
  try {
    vm.runInNewContext(source, {
      fs: { readdirSync: () => [testFile], existsSync: () => false },
      path, URL, fileURLToPath: () => process.cwd(),
      process: { argv: ["node", "runner", testFile], execPath: "node", exit: (code) => {
        status = code; throw new Error("exit");
      } },
      console: { info: (...args) => messages.push(args.join(" ")), error: (...args) => messages.push(args.join(" ")) },
      spawnSync: (...args) => { children.push(args); return { status: 0 }; }
    });
  } catch (error) {
    if (error.message !== "exit") throw error;
  }
  return { status, messages: messages.join("\n"), children };
};

test("missing Android generated inputs fail with a prebuild instruction", () => {
  const result = runWithMissingAndroid("camera-color-adjustment-save.test.mjs");
  assert.equal(result.status, 1);
  assert.match(result.messages, /npx expo prebuild --platform android --no-install/);
  assert.match(result.messages, /MainApplication\.kt/);
  assert.match(result.messages, /camera-color-adjustment-save\.test\.mjs/);
  assert.equal(result.children.length, 0);
});

test("a selected JavaScript-only test still runs without Android output", () => {
  const result = runWithMissingAndroid("test-runner-script.test.mjs");
  assert.equal(result.status, 0);
  assert.equal(result.children.length, 1);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const sourceFiles = [
  "features/camera/CameraScreen.tsx",
  "lib/app-settings.ts",
  "app.json",
  "README.md",
  "AGENTS.md"
];

for (const filePath of sourceFiles) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    false,
    `${filePath} should be UTF-8 without BOM`
  );
}

const textExtensions = new Set([
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".rules",
  ".toml",
  ".ts",
  ".tsx"
]);
const ignoredFiles = new Set(["package-lock.json", "functions/package-lock.json"]);
const trackedTextFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter((filePath) => textExtensions.has(path.extname(filePath)) && !ignoredFiles.has(filePath));
const filesWithMojibake = trackedTextFiles.filter((filePath) =>
  /[\u4E00-\u9FFF]/u.test(fs.readFileSync(filePath, "utf8"))
);

assert.deepEqual(filesWithMojibake, [], "source files should not contain mojibake CJK fragments");

console.log("ok - source files use UTF-8 without BOM");

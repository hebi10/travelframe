import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const forbiddenTerms = [
  ["ff", "mpeg"].join(""),
  ["render", "server"].join("-"),
  ["request", "Trip", "Clip", "Render"].join(""),
  ["EXPO_PUBLIC", "RENDER", "SERVER", "URL"].join("_"),
  ["EXPO_PUBLIC", "DIRECT", "EXPORT", "ENABLED"].join("_")
];

const ignoredDirectories = new Set([
  ".git",
  ".tmp",
  "dist",
  "dist-preview",
  "node_modules"
]);
const ignoredFiles = new Set(["tests/no-legacy-renderer.test.mjs"]);

const collectFiles = (directory) => {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }

    if (!ignoredFiles.has(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
};

const textFiles = collectFiles(process.cwd()).filter((file) =>
  /\.(js|mjs|ts|tsx|json|md|env|example|ps1|html|css)$/.test(file)
);

for (const file of textFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const term of forbiddenTerms) {
    assert.equal(
      content.includes(term),
      false,
      `${file} still references legacy renderer term: ${term}`
    );
  }
}

console.log("ok - legacy video render path is not referenced");

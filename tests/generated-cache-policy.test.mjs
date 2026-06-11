import assert from "node:assert/strict";
import fs from "node:fs";

const gitignore = fs.readFileSync(".gitignore", "utf8");
const eslintConfig = fs.readFileSync("eslint.config.js", "utf8");

for (const snippet of [
  ".firebase/hosting.*.cache",
  "dist-preview/",
  "expo-*.log",
  "expo-*.out.log",
  "expo-*.err.log",
  "static-dist-*.out.log",
  "static-dist-*.err.log"
]) {
  assert.ok(gitignore.includes(snippet), `generated or local runtime output should be ignored: ${snippet}`);
}

assert.ok(
  eslintConfig.includes("dist-preview/**"),
  "ESLint should ignore generated dist-preview output"
);

assert.equal(
  fs.existsSync(".firebase/hosting.YWRtaW4.cache"),
  false,
  "Firebase Hosting generated cache file should be removed from the worktree"
);

console.log("ok - Firebase Hosting generated cache files stay out of git");

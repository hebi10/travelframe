import assert from "node:assert/strict";
import fs from "node:fs";

const gitignore = fs.readFileSync(".gitignore", "utf8");

assert.ok(
  gitignore.includes(".firebase/hosting.*.cache"),
  "Firebase Hosting generated cache files should be ignored"
);

assert.equal(
  fs.existsSync(".firebase/hosting.YWRtaW4.cache"),
  false,
  "Firebase Hosting generated cache file should be removed from the worktree"
);

console.log("ok - Firebase Hosting generated cache files stay out of git");

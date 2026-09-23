import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--check", "admin/admin.js"], {
  encoding: "utf8"
});

assert.equal(
  result.status,
  0,
  `admin/admin.js should remain valid JavaScript syntax:\n${result.stderr || result.stdout}`
);

console.log("ok - admin JavaScript syntax is valid");

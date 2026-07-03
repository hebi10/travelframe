import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("functions/index.js", "utf8");
const completeAdminBackupUpload = source.slice(
  source.indexOf("exports.completeAdminBackupUpload"),
  source.indexOf("const getBackupItemRef")
);

assert.match(
  completeAdminBackupUpload,
  /session\.expiresAt\?\.toMillis[\s\S]*Date\.now\(\)/,
  "admin upload completion should reject expired upload sessions"
);
assert.match(
  completeAdminBackupUpload,
  /db\.runTransaction/,
  "admin upload completion should reserve the completed item id in a transaction"
);
assert.doesNotMatch(
  completeAdminBackupUpload,
  /const itemId = `\$\{session\.itemType\}-\$\{Date\.now\(\)\}`;/,
  "admin upload completion should not create a fresh item id on every retry"
);

console.log("ok - admin backup upload completion is guarded");

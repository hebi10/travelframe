import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync("admin/admin.js", "utf8");
const firebaseConfig = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
const cspHeader = firebaseConfig.hosting?.headers
  ?.flatMap((entry) => entry.headers ?? [])
  .find((header) => header.key === "Content-Security-Policy");

assert.doesNotMatch(
  adminSource,
  /getDocs\(\s*collection\(\s*db\s*,\s*"users"\s*\)\s*\)/,
  "admin console should not load the full users collection"
);
assert.match(
  adminSource,
  /getDocs\(\s*query\(\s*collection\(\s*db\s*,\s*"users"\s*\)[\s\S]*limit\(usersPageSize\)/,
  "admin console initial user list should use a limited query"
);
assert.ok(cspHeader, "Firebase Hosting should define a Content-Security-Policy header");
assert.match(cspHeader.value, /script-src 'self' https:\/\/www\.gstatic\.com/, "CSP should allow Firebase module scripts");
assert.match(cspHeader.value, /connect-src [^;]*https:\/\/\*\.googleapis\.com/, "CSP should allow Firebase API calls");

console.log("ok - admin console avoids full user scans and defines CSP");

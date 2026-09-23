import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");

assert.ok(
  adminSource.includes("const getUserSearchText = (user) =>"),
  "admin user search should share one searchable text builder"
);
assert.ok(
  adminSource.includes("[user.email, user.displayName, user.id]"),
  "admin user search text should include displayName with email and UID"
);
assert.ok(
  adminSource.includes("const findLoadedUserBySearchTerm = (term) =>"),
  "direct admin search should check the loaded user list before remote lookup"
);
assert.ok(
  adminSource.includes('where("displayName", "==", term)'),
  "direct admin search should query Firestore displayName when the loaded list has no match"
);
assert.ok(
  adminHtml.includes("이름, 이메일 또는 UID 검색"),
  "single user search should explain all supported fields"
);
assert.ok(
  adminHtml.includes('placeholder="이름, user@example.com 또는 uid"'),
  "search placeholder should include name, email, and UID"
);
assert.equal(
  adminHtml.includes("userFilterInput"),
  false,
  "admin user sidebar should expose only one search input"
);
assert.ok(
  adminSource.includes('$("searchInput").addEventListener("input"'),
  "the single search input should filter the loaded user list immediately"
);

console.log("ok - admin uses one name/email/UID user search");

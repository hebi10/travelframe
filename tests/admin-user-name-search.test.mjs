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
  adminHtml.includes("이메일, 이름 또는 UID"),
  "direct search label should tell admins that name search is supported"
);
assert.ok(
  adminHtml.includes('placeholder="이름, user@example.com 또는 uid"'),
  "direct search placeholder should include name search"
);

console.log("ok - admin direct user search supports display names");

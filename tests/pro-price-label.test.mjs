import assert from "node:assert/strict";
import fs from "node:fs";

const accountConstants = fs.readFileSync("features/account/account-screen.constants.ts", "utf8");
const adminSource = fs.readFileSync("admin/admin.js", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");

assert.match(
  accountConstants,
  /id:\s*"creator"[\s\S]*?title:\s*"Pro"[\s\S]*?price:\s*"월 990원"/,
  "Pro plan card should show the monthly 990 won price"
);
assert.doesNotMatch(
  accountConstants,
  /id:\s*"creator"[\s\S]*?price:\s*"월 2,900원"/,
  "Pro plan card should not keep the old monthly 2,900 won price"
);

for (const [name, source] of [
  ["admin product metadata", adminSource],
  ["functions product metadata", functionsSource]
]) {
  assert.match(
    source,
    /creator_monthly:\s*\{[\s\S]*?priceLabel:\s*"월 990원"/,
    `${name} should store the Pro monthly 990 won price label`
  );
  assert.doesNotMatch(
    source,
    /creator_monthly:\s*\{[\s\S]*?priceLabel:\s*"월 2,900원"/,
    `${name} should not keep the old Pro monthly 2,900 won price label`
  );
}

console.log("ok - Pro price labels use monthly 990 won");

import assert from "node:assert/strict";
import fs from "node:fs";

const accountConstants = fs.readFileSync(
  "features/account/account-screen.constants.ts",
  "utf8"
);
const billingHookSource = fs.readFileSync(
  "features/account/hooks/useGooglePlayBilling.ts",
  "utf8"
);
const billingSource = fs.readFileSync("lib/google-play-billing.ts", "utf8");
const adminSource = fs.readFileSync("admin/admin.js", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");

assert.match(
  accountConstants,
  /id:\s*"creator"[\s\S]*?title:\s*"Pro"[\s\S]*?price:\s*"Google Play 가격"/,
  "Pro plan card fallback should defer to Google Play pricing"
);
assert.match(
  accountConstants,
  /id:\s*"expert"[\s\S]*?price:\s*"Google Play 가격"/,
  "Expert plan card fallback should defer to Google Play pricing"
);
assert.ok(
  billingHookSource.includes("getGooglePlayStorePrice") &&
    billingHookSource.includes("getStorePrice") &&
    billingSource.includes("displayPrice"),
  "account pricing should prefer the store-provided Google Play display price"
);
assert.doesNotMatch(
  accountConstants,
  /id:\s*"creator"[\s\S]*?price:\s*"월 (?:990|2,900)원"/,
  "client plan cards should not hard-code a monthly Pro price"
);

for (const [name, source] of [
  ["admin product metadata", adminSource],
  ["functions product metadata", functionsSource]
]) {
  assert.match(
    source,
    /creator_monthly:\s*\{[\s\S]*?priceLabel:\s*"월 990원"/,
    `${name} should retain the existing internal product metadata label`
  );
  assert.doesNotMatch(
    source,
    /creator_monthly:\s*\{[\s\S]*?priceLabel:\s*"월 2,900원"/,
    `${name} should not restore the old monthly 2,900 won metadata`
  );
}

console.log("ok - client plan pricing uses Google Play while internal metadata stays compatible");

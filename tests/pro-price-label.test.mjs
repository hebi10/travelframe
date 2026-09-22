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

for (const [id, title, fallback] of [
  ["creator", "Pro", "2,000원"],
  ["plus", "Plus", "4,000원"],
  ["expert", "Expert", "6,000원"]
]) {
  assert.match(
    accountConstants,
    new RegExp(`id:\\s*"${id}"[\\s\\S]*?title:\\s*"${title}"[\\s\\S]*?price:\\s*"${fallback}"`),
    `${title} fallback price should match the configured Play price`
  );
}

assert.ok(
  billingHookSource.includes("getGooglePlayStorePrice") &&
    billingHookSource.includes("getStorePrice") &&
    billingSource.includes("displayPrice"),
  "account pricing should prefer the store-provided Google Play display price"
);

for (const [name, source] of [
  ["admin product metadata", adminSource],
  ["functions product metadata", functionsSource]
]) {
  for (const [productId, price] of [
    ["creator_monthly", "월 2,000원"],
    ["plus_monthly", "월 4,000원"],
    ["expert_monthly", "월 6,000원"]
  ]) {
    assert.match(
      source,
      new RegExp(`${productId}:\\s*\\{[\\s\\S]*?priceLabel:\\s*"${price}"`),
      `${name} should use the new ${productId} price`
    );
  }
}

console.log("ok - project-slot plan pricing is consistent while Google Play remains authoritative");

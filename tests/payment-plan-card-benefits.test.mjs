import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const constantsSource = fs.readFileSync("features/account/account-screen.constants.ts", "utf8");

const paymentCardsStart = source.indexOf("{paymentPlans.map((plan) => (");
assert.notEqual(paymentCardsStart, -1, "account payment cards should render payment plans");

const paymentCardsEnd = source.indexOf("</Pressable>", paymentCardsStart);
assert.notEqual(paymentCardsEnd, -1, "account payment card should close inside payment plan map");

const paymentCardBlock = source.slice(paymentCardsStart, paymentCardsEnd);
assert.ok(
  paymentCardBlock.includes("plan.benefits.map((benefit) => ("),
  "account payment cards should show each plan benefit before opening the payment modal"
);

assert.ok(
  constantsSource.includes('id: "expert"'),
  "account payment plans should include the Expert plan"
);

assert.ok(
  /id:\s*"expert"[\s\S]*?price:\s*"1,990원"/.test(constantsSource),
  "Expert payment plan should show the 1,990 won price"
);

assert.ok(
  source.includes('return "expert_monthly";'),
  "Expert payment plan should purchase expert_monthly"
);

assert.ok(
  source.includes('label="Expert"'),
  "account history should expose Expert purchase status"
);

console.log("ok - account payment cards show plan benefits and Expert status");

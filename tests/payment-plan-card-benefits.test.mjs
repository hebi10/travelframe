import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");

const paymentCardsStart = source.indexOf("{paymentPlans.map((plan) => (");
assert.notEqual(paymentCardsStart, -1, "account payment cards should render payment plans");

const paymentCardsEnd = source.indexOf("</Pressable>", paymentCardsStart);
assert.notEqual(paymentCardsEnd, -1, "account payment card should close inside payment plan map");

const paymentCardBlock = source.slice(paymentCardsStart, paymentCardsEnd);
assert.ok(
  paymentCardBlock.includes("plan.benefits.map((benefit) => ("),
  "account payment cards should show each plan benefit before opening the payment modal"
);

console.log("ok - account payment cards show plan benefits");

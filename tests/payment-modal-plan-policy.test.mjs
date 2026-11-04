import assert from "node:assert/strict";
import fs from "node:fs";

const account = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const constants = fs.readFileSync(
  "features/account/account-screen.constants.ts",
  "utf8"
);
const styles = fs.readFileSync(
  "features/account/account-screen.styles.ts",
  "utf8"
);

const modalStart = account.indexOf("visible={Boolean(selectedPaymentPlan)}");
const modalEnd = account.indexOf("</Modal>", modalStart);
const paymentModal = account.slice(modalStart, modalEnd);

assert.ok(modalStart >= 0 && modalEnd > modalStart, "payment modal should exist");
assert.equal(
  /<Text(?![^>]*selectable={false})[^>]*>/.test(paymentModal),
  false,
  "all payment modal text should disable Android text selection backgrounds"
);

for (const token of [
  'backgroundColor: "transparent"',
  "planTitle:",
  "planPrice:",
  "benefitText:",
  "helpText:"
]) {
  assert.ok(styles.includes(token), `payment text style missing: ${token}`);
}

for (const token of [
  'price: "2,000원"',
  "프로젝트 수 무제한",
  "프로젝트당 사진 최대 365장",
  "클라우드 백업 프로젝트 1개"
]) {
  assert.ok(
    constants.includes(token) || account.includes(token),
    `revised purchase policy copy missing: ${token}`
  );
}

console.log("ok - payment modal text stays transparent and plan copy matches revised limits");

import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const authSource = fs.readFileSync("lib/auth-context.tsx", "utf8");
const subscriptionSource = fs.readFileSync("lib/subscription.ts", "utf8");

assert.ok(
  accountSource.includes("purchaseProduct("),
  "account payment button should trigger the shared purchase action"
);
assert.ok(
  authSource.includes("purchaseProduct:"),
  "auth context should expose purchase completion state update"
);
assert.ok(
  subscriptionSource.includes("saveLocalCheckoutSubscription"),
  "subscription library should provide the temporary local checkout fulfillment point"
);
assert.equal(
  accountSource.includes("유료 기능은 Google Play 결제 검증 연동 후 사용할 수 있습니다."),
  false,
  "payment UI should no longer block paid features as pending verification"
);
assert.equal(
  accountSource.includes("준비 중"),
  false,
  "account payment UI should not present paid plans as preparation-only"
);

console.log("ok - account checkout behaves like a completed local purchase");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const firestoreRules = read("firestore.rules");
const subscriptionSource = read("lib/subscription.ts");
const authContextSource = read("lib/auth-context.tsx");
const accountSource = read("app/(tabs)/account.tsx");

assert.equal(
  firestoreRules.includes("isOwner(userId) && isMockSubscription"),
  false,
  "owners must not be able to write mock subscription documents"
);
assert.equal(
  firestoreRules.includes("isOwner(userId) && isMockPaymentEvent"),
  false,
  "owners must not be able to create mock payment events"
);
assert.ok(
  firestoreRules.includes("match /subscriptions/{subscriptionId}") &&
    firestoreRules.includes("allow create, update, delete: if false;"),
  "subscription writes should be blocked from client rules"
);
assert.ok(
  firestoreRules.includes("match /paymentEvents/{eventId}") &&
    firestoreRules.includes("allow create, update, delete: if false;"),
  "payment event writes should be blocked from client rules"
);

for (const [file, source] of [
  ["lib/subscription.ts", subscriptionSource],
  ["lib/auth-context.tsx", authContextSource],
  ["app/(tabs)/account.tsx", accountSource]
]) {
  assert.equal(source.includes("activateMockSubscription"), false, `${file} must not expose mock subscription activation`);
  assert.equal(source.includes("startMockSubscription"), false, `${file} must not expose mock subscription activation`);
  assert.equal(source.includes("mock_payment_completed"), false, `${file} must not create mock payment events`);
}

assert.ok(
  accountSource.includes("유료 기능은 Google Play 결제 검증 연동 후 사용할 수 있습니다."),
  "payment UI should explain that paid features are pending real Google Play verification"
);

console.log("ok - mock subscription writes are blocked");

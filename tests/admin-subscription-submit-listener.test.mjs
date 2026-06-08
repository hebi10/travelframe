import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../admin/admin.js", import.meta.url), "utf8");

const submitListeners = adminSource.match(
  /\$\("subscriptionForm"\)\.addEventListener\("submit"/g
) ?? [];

assert.equal(
  submitListeners.length,
  1,
  "subscriptionForm must register exactly one submit listener"
);
assert.ok(
  adminSource.includes('$("subscriptionForm").addEventListener("submit", saveProductSubscription);'),
  "subscriptionForm should use the product subscription save handler"
);
assert.ok(
  adminSource.includes('const setAdminProductSubscription = httpsCallable(functions, "setAdminProductSubscription");'),
  "admin subscription saves should use the server callable"
);
assert.ok(
  adminSource.includes("await setAdminProductSubscription({"),
  "admin subscription submit should call the server callable"
);
assert.equal(
  adminSource.includes('doc(db, "users", currentUserDoc.id, "subscriptions", productId)'),
  false,
  "admin subscription submit should not write subscription documents directly"
);
assert.equal(
  adminSource.includes('addDoc(collection(db, "users", currentUserDoc.id, "paymentEvents")'),
  false,
  "admin subscription submit should not write payment events directly"
);
assert.equal(
  adminSource.includes("stopImmediatePropagation"),
  false,
  "subscription submit handling should not rely on stopImmediatePropagation"
);

const functionsSource = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
assert.ok(
  functionsSource.includes("exports.setAdminProductSubscription = secureOnCall"),
  "server should expose admin product subscription management"
);

console.log("ok - admin subscription submit listener is registered once");

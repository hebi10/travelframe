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
assert.equal(
  adminSource.includes("stopImmediatePropagation"),
  false,
  "subscription submit handling should not rely on stopImmediatePropagation"
);

console.log("ok - admin subscription submit listener is registered once");

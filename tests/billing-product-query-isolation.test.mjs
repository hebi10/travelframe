import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("features/account/hooks/useGooglePlayBilling.ts", "utf8");
const ast = ts.createSourceFile("billing.ts", source, ts.ScriptTarget.Latest, true);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "reloadProducts") initializer = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(initializer, "product queries need an independently handled reload path");
const code = ts.transpileModule(`const reload = ${initializer.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function setup(user, query) {
  const state = { products: [], subscriptions: [], error: null, loading: false };
  const version = { current: 0 };
  let calls = 0;
  const deps = {
    useCallback: fn => fn, user, connected: true, Platform: { OS: "android" },
    productQueryVersionRef: version,
    fetchStoreProducts: args => { calls++; return query(args); },
    GOOGLE_PLAY_ONE_TIME_PRODUCT_IDS: ["ad_remove"], GOOGLE_PLAY_SUBSCRIPTION_IDS: ["creator_monthly"],
    setProducts: value => { state.products = value; },
    setSubscriptions: value => { state.subscriptions = value; },
    setProductLoadError: value => { state.error = value; },
    setIsLoadingProducts: value => { state.loading = value; }
  };
  return { reload: new Function(...Object.keys(deps), `${code}; return reload;`)(...Object.values(deps)), state, version, calls: () => calls };
}
const guest = setup(null, async () => { throw new Error("must not query"); });
await guest.reload();
assert.equal(guest.calls(), 0);
const failed = setup({ uid: "a" }, async () => { throw new Error("Failed to query product"); });
await failed.reload();
assert.match(failed.state.error, /Google Play/);
assert.equal(failed.state.loading, false);
let fail = true;
const retry = setup({ uid: "a" }, async ({ type }) => {
  if (fail) throw new Error("store unavailable");
  return [{ id: type === "subs" ? "creator_monthly" : "ad_remove" }];
});
await retry.reload();
fail = false;
await retry.reload();
assert.equal(retry.state.error, null);
assert.equal(retry.state.products[0].id, "ad_remove");
assert.equal(retry.state.subscriptions[0].id, "creator_monthly");
// A shared deferred promise lets both product types finish after logout.
let resolvePendingResult;
const pendingResult = new Promise((resolve) => {
  resolvePendingResult = resolve;
});
const staleBoth = setup({ uid: "a" }, () => pendingResult);
const pending = staleBoth.reload();
staleBoth.version.current++;
resolvePendingResult([{ id: "old" }]);
await pending;
assert.deepEqual(staleBoth.state.products, []);
const account = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
assert.ok(!account.includes("setMessage(billingMessage)"), "billing errors must not replace auth messages");
console.log("ok - guests skip product queries; store errors, retry and stale results stay isolated from login");

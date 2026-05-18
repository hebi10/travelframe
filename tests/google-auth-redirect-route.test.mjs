import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = fs.readFileSync("app/(tabs)/account.tsx", "utf8");
const routeSource = fs.readFileSync("app/oauthredirect.tsx", "utf8");
const layoutSource = fs.readFileSync("app/_layout.tsx", "utf8");

for (const snippet of [
  "com.haebi.photoguide:/oauthredirect",
  "path: \"oauthredirect\"",
  "AuthRequest"
]) {
  assert.ok(accountSource.includes(snippet), `google auth request missing: ${snippet}`);
}

for (const snippet of [
  "OAuthRedirectScreen",
  "Redirect",
  "\"/account\""
]) {
  assert.ok(routeSource.includes(snippet), `oauth redirect route missing: ${snippet}`);
}

assert.ok(
  layoutSource.includes('name="oauthredirect"') &&
    layoutSource.includes("headerShown: false"),
  "root layout should register the oauth redirect route without a header"
);

console.log("ok - google auth redirect route is handled by the app");

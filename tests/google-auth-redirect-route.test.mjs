import assert from "node:assert/strict";
import fs from "node:fs";

const accountSource = fs.readFileSync("features/account/AccountScreen.tsx", "utf8");
const helperSource = fs.readFileSync("lib/google-auth.ts", "utf8");
const routeSource = fs.readFileSync("app/oauthredirect.tsx", "utf8");
const layoutSource = fs.readFileSync("app/_layout.tsx", "utf8");

for (const snippet of [
  "com.haebi.photoguide:/oauthredirect",
  "AuthRequest"
]) {
  assert.ok(helperSource.includes(snippet), `google auth helper missing: ${snippet}`);
}

assert.ok(
  accountSource.includes("signInWithGoogleAuthSession"),
  "account should delegate Google auth request handling to the shared helper"
);

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

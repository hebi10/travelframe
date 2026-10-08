import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Firebase Hosting serves a matching AdMob app-ads.txt artifact at the site root", () => {
  const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const firebase = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
  const adsPlugin = app.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads"
  );
  const appId = adsPlugin?.[1]?.androidAppId;
  const publisherId = /^ca-app-pub-(\d+)~\d+$/.exec(appId ?? "")?.[1];
  assert.ok(publisherId, "AdMob publisher ID missing from app.json");
  assert.equal(appId, app.expo.extra.admob.androidAppId);
  assert.equal(firebase.hosting.public, "admin");
  assert.equal(
    fs.readFileSync("admin/app-ads.txt", "utf8").trim(),
    `google.com, pub-${publisherId}, DIRECT, f08c47fec0942fa0`
  );
});

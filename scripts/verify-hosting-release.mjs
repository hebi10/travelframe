import assert from "node:assert/strict";
import fs from "node:fs";

export const verifyHostingReleaseSource = (root = process.cwd()) => {
  const read = (file) => fs.readFileSync(new URL(file, `file://${root.endsWith("/") ? root : root + "/"}`), "utf8");
  const firebase = JSON.parse(read("firebase.json"));
  const aliases = JSON.parse(read(".firebaserc"));
  const app = JSON.parse(read("app.json"));
  const seller = read("admin/app-ads.txt").trim();
  const appId = app.expo.plugins.find((value) => Array.isArray(value) &&
    value[0] === "react-native-google-mobile-ads")?.[1]?.androidAppId;
  const publisher = /^ca-app-pub-(\d+)~\d+$/.exec(appId ?? "")?.[1];

  assert.equal(firebase.hosting.public, "admin", "Hosting must publish current admin directory");
  assert.equal(aliases.projects.default, "travelframe-4e1fb", "Wrong Firebase project");
  assert.ok(publisher, "Missing AdMob publisher ID");
  assert.equal(seller, `google.com, pub-${publisher}, DIRECT, f08c47fec0942fa0`);
  assert.ok(read("admin/privacy/index.html").includes("개인정보처리방침"));
  assert.ok(read("admin/privacy/photo-guide-delete-account.html").includes("삭제"));
  return { project: aliases.projects.default, publicDirectory: firebase.hosting.public };
};

if (process.argv[1]?.endsWith("verify-hosting-release.mjs")) {
  console.log("hosting source verified", verifyHostingReleaseSource());
}

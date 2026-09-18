import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const fail = (message) => {
  console.error(`release verification failed - ${message}`);
  process.exit(1);
};
const requireFile = (relativePath) => {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`missing required file: ${relativePath}`);
  }
};

const app = readJson("app.json");
const eas = readJson("eas.json");
const packageJson = readJson("package.json");
const appExpo = app.expo ?? {};

if (appExpo.name !== "바디 프레임") fail("app display name must be 바디 프레임");
if (appExpo.android?.package !== "com.haebi.photoguide") {
  fail("Android package must remain com.haebi.photoguide");
}
if (!eas.build?.production || eas.build.production.autoIncrement !== true) {
  fail("EAS production build must keep autoIncrement enabled");
}

const iconPaths = [
  appExpo.icon ?? "assets/icons/app-icon.png",
  appExpo.android?.adaptiveIcon?.foregroundImage ?? "assets/icons/adaptive-icon.png",
  appExpo.splash?.image ?? "assets/icons/splash-icon.png"
];
for (const assetPath of iconPaths) requireFile(assetPath);

for (const file of [
  "privacy/privacy-policy.md",
  "privacy/photo-guide-delete-account.html",
  "docs/release-assets/README.md"
]) {
  requireFile(file);
}

const billing = fs.readFileSync(path.join(root, "lib/google-play-billing.ts"), "utf8");
for (const productId of ["ad_remove", "creator_monthly", "expert_monthly"]) {
  if (!billing.includes(productId)) {
    fail(`Google Play product mapping missing: ${productId}`);
  }
}

if (packageJson.scripts?.["android:prebuild:ci"] !== "node scripts/prebuild-android-ci.mjs") {
  fail("android:prebuild:ci script is missing");
}

console.log("ok - Body Frame release source invariants are ready");

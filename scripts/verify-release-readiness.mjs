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
  const normalized = relativePath.replace(/^\.\//, "");
  if (!fs.existsSync(path.join(root, normalized))) {
    fail(`missing required file: ${normalized}`);
  }
};

const app = readJson("app.json");
const eas = readJson("eas.json");
const packageJson = readJson("package.json");
const firebaseConfig = readJson("firebase.json");
const functionsPackageJson = readJson("functions/package.json");
const appExpo = app.expo ?? {};

if (appExpo.name !== "바디 프레임") fail("app display name must be 바디 프레임");
if (appExpo.android?.package !== "com.haebi.photoguide") {
  fail("Android package must remain com.haebi.photoguide");
}
if (!eas.build?.production || eas.build.production.autoIncrement !== true) {
  fail("EAS production build must keep autoIncrement enabled");
}
if (appExpo.android?.adaptiveIcon?.backgroundColor !== "#151719") {
  fail("Body Frame adaptive icon background must remain #151719");
}

for (const assetPath of [
  appExpo.icon ?? "./assets/icons/app-icon.png",
  appExpo.android?.adaptiveIcon?.foregroundImage ?? "./assets/icons/adaptive-icon.png",
  appExpo.splash?.image ?? "./assets/icons/splash-icon.png"
]) {
  requireFile(assetPath);
}

for (const file of [
  "privacy/privacy-policy.md",
  "privacy/terms-of-service.md",
  "privacy/photo-guide-delete-account.html",
  "admin/terms/index.html",
  "docs/release-assets/README.md",
  "docs/body-frame-release-checklist.md",
  ".gitleaksignore"
]) {
  requireFile(file);
}

const billing = fs.readFileSync(path.join(root, "lib/google-play-billing.ts"), "utf8");
const serverBilling = fs.readFileSync(
  path.join(root, "functions/google-play-billing.js"),
  "utf8"
);
if (!serverBilling.includes('const GOOGLE_PLAY_TOPIC = "body-frame-play-billing"')) {
  fail("Google Play RTDN Pub/Sub topic must be body-frame-play-billing");
}
if (serverBilling.includes('const GOOGLE_PLAY_TOPIC = "google-play-billing"')) {
  fail("Google Play RTDN Pub/Sub topic must not start with reserved goog prefix");
}
for (const productId of ["ad_remove", "creator_monthly", "expert_monthly"]) {
  if (!billing.includes(productId)) {
    fail(`Google Play product mapping missing: ${productId}`);
  }
}

if (packageJson.scripts?.["android:prebuild:ci"] !== "node scripts/prebuild-android-ci.mjs") {
  fail("android:prebuild:ci script is missing");
}
if (packageJson.scripts?.["release:verify"] !== "node scripts/verify-release-readiness.mjs") {
  fail("release:verify script is missing");
}
if (packageJson.scripts?.["firebase:prepare-functions"] !== "npm ci --prefix functions") {
  fail("Firebase Functions dependency preparation script is missing");
}
if (functionsPackageJson.engines?.node !== "22") {
  fail("Firebase Functions package runtime must be Node 22");
}
if (firebaseConfig.functions?.runtime !== "nodejs22") {
  fail("Firebase Functions runtime must be nodejs22");
}
const functionsPredeploy = Array.isArray(firebaseConfig.functions?.predeploy)
  ? firebaseConfig.functions.predeploy
  : [firebaseConfig.functions?.predeploy].filter(Boolean);
if (!functionsPredeploy.includes("npm ci --prefix functions")) {
  fail("Firebase Functions predeploy must install functions dependencies");
}

if (packageJson.dependencies?.["react-native-health-connect"] !== "4.1.3") {
  fail("react-native-health-connect must remain pinned to 4.1.3");
}
if (!appExpo.plugins?.includes("react-native-health-connect")) {
  fail("Health Connect Expo plugin is missing");
}
if (!appExpo.plugins?.includes("./plugins/with-body-pose-alignment")) {
  fail("Body Frame pose alignment Expo plugin is missing");
}

const androidPermissions = appExpo.android?.permissions ?? [];
for (const permission of [
  "android.permission.health.READ_WEIGHT",
  "android.permission.health.READ_BODY_FAT"
]) {
  if (!androidPermissions.includes(permission)) {
    fail(`Health Connect read permission missing: ${permission}`);
  }
}
for (const forbiddenPermission of [
  "android.permission.health.WRITE_WEIGHT",
  "android.permission.health.WRITE_BODY_FAT",
  "android.permission.health.READ_HEALTH_DATA_HISTORY",
  "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
]) {
  if (androidPermissions.includes(forbiddenPermission)) {
    fail(`Health Connect permission should not be requested: ${forbiddenPermission}`);
  }
}

const androidPlugin = fs.readFileSync(
  path.join(root, "plugins/with-android-release-manifest.js"),
  "utf8"
);
if (
  !androidPlugin.includes('key === "android.minSdkVersion"') ||
  !androidPlugin.includes('value = "26"')
) {
  fail("Health Connect requires generated Android minSdk 26");
}

const healthConnectSource = fs.readFileSync(
  path.join(root, "lib/body-health-connect.ts"),
  "utf8"
);
for (const token of [
  '"Weight"',
  '"BodyFat"',
  "days = 30",
  "requestBodyHealthConnectReadPermissions",
  "readLatestBodyHealthConnectMeasurements"
]) {
  if (!healthConnectSource.includes(token)) {
    fail(`Health Connect source invariant missing: ${token}`);
  }
}
for (const forbidden of [
  "LeanBodyMass",
  "insertRecords",
  "BackgroundAccessPermission",
  "ReadHealthDataHistoryPermission"
]) {
  if (healthConnectSource.includes(forbidden)) {
    fail(`Health Connect integration should not use ${forbidden}`);
  }
}

const privacyPolicy = fs.readFileSync(
  path.join(root, "privacy/privacy-policy.md"),
  "utf8"
);
for (const token of [
  "Health Connect",
  "몸무게",
  "체지방률",
  "최근 30일",
  "Firebase",
  "자동 업로드되지 않",
  "자세 맞춤 도움",
  "기기 내",
  "서버로 업로드하지 않습니다.",
  "임시 이미지"
]) {
  if (!privacyPolicy.includes(token)) {
    fail(`privacy policy Health Connect disclosure missing: ${token}`);
  }
}


const termsOfService = fs.readFileSync(
  path.join(root, "privacy/terms-of-service.md"),
  "utf8"
);
for (const token of [
  "Google Play",
  "1회성 구매",
  "월 단위 정기 결제",
  "자동으로 갱신",
  "정기 결제 관리 화면",
  "앱을 삭제하는 것만으로는 정기 결제가 취소되지 않습니다",
  "환불"
]) {
  if (!termsOfService.includes(token)) {
    fail(`terms of service billing disclosure missing: ${token}`);
  }
}

const posePlugin = fs.readFileSync(
  path.join(root, "plugins/with-body-pose-alignment.js"),
  "utf8"
);
for (const token of [
  "com.google.mlkit:pose-detection:18.0.0-beta5",
  "PoseDetectorOptions.STREAM_MODE",
  "AndroidPoseAlignmentModule"
]) {
  if (!posePlugin.includes(token)) {
    fail(`pose alignment release invariant missing: ${token}`);
  }
}

const releaseAssets = fs.readFileSync(
  path.join(root, "docs/release-assets/README.md"),
  "utf8"
);
for (const token of ["BF 모노그램 v2", "Google Play Console", "Firebase에 업로드하지 않습니다"]) {
  if (!releaseAssets.includes(token)) {
    fail(`release asset documentation missing: ${token}`);
  }
}

console.log("ok - Body Frame release source invariants are ready");

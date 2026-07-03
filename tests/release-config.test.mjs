import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const envExample = fs.readFileSync(".env.example", "utf8");
const releaseCheckSource = fs.readFileSync("scripts/check-release-config.mjs", "utf8");
const functionsSource = fs.readFileSync("functions/index.js", "utf8");

assert.match(
  functionsSource,
  /process\.env\.FUNCTIONS_ENFORCE_APP_CHECK !== "false"/,
  "Functions callable App Check should be enforced by default outside the emulator"
);

for (const scriptName of [
  "android:build-prod",
  "android:build-prod-local",
  "firebase:deploy-functions",
  "firebase:deploy-all",
  "deploy:firebase"
]) {
  assert.match(
    packageJson.scripts[scriptName],
    /npm run release:check:strict &&/,
    `${scriptName} should run the strict release check first`
  );
}

assert.match(
  packageJson.scripts.quality,
  /npm run quality:firebase-rules/,
  "quality should include Firebase Rules emulator checks"
);

assert.doesNotMatch(
  releaseCheckSource,
  /functionsSource\.includes/,
  "release config check should use structural source checks instead of exact string includes"
);

for (const envName of [
  "FUNCTIONS_ENFORCE_APP_CHECK",
  "EXPO_PUBLIC_ENABLE_LOCAL_CHECKOUT",
  "ANDROID_KEYSTORE_PATH",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD"
]) {
  assert.match(envExample, new RegExp(`^${envName}=`, "m"), `.env.example should document ${envName}`);
}

console.log("ok - release commands and quality gates include strict checks");

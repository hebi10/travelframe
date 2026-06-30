import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
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

console.log("ok - release commands run strict App Check config checks");

import fs from "node:fs";

const strict = process.argv.includes("--strict");
const failures = [];

const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));

const hasEnforcedCallableRuntime = (source) =>
  /CALLABLE_RUNTIME_OPTIONS\s*=\s*SHOULD_ENFORCE_APP_CHECK\s*\?\s*\{\s*enforceAppCheck\s*:\s*true\s*\}\s*:\s*\{\s*\}/s.test(
    source
  ) &&
  /secureOnCall\s*=\s*\(\s*handler\s*\)\s*=>\s*onCall\s*\(\s*CALLABLE_RUNTIME_OPTIONS\s*,\s*handler\s*\)/s.test(
    source
  );

const hasDefaultAppCheckEnforcement = (source) =>
  /SHOULD_ENFORCE_APP_CHECK\s*=[\s\S]*?FUNCTIONS_EMULATOR\s*===\s*"true"[\s\S]*?FUNCTIONS_ENFORCE_APP_CHECK\s*===\s*"true"[\s\S]*?FUNCTIONS_ENFORCE_APP_CHECK\s*!==\s*"false"/.test(
    source
  );

if (!hasEnforcedCallableRuntime(functionsSource)) {
  failures.push("functions/index.js must keep enforceAppCheck enabled for callable functions.");
}

if (!hasDefaultAppCheckEnforcement(functionsSource)) {
  failures.push("Functions App Check must be enforced by default outside the emulator.");
}

if (appConfig.expo?.android?.package !== "com.haebi.photoguide") {
  failures.push("Android package id changed; verify Firebase App Check app registration before release.");
}

if (strict && process.env.FUNCTIONS_ENFORCE_APP_CHECK !== "true") {
  failures.push("Set FUNCTIONS_ENFORCE_APP_CHECK=true before production build/deploy.");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `release-check - ${failure}`).join("\n"));
  process.exit(1);
}

console.log("ok - release config checks passed");

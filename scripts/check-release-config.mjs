import fs from "node:fs";

const strict = process.argv.includes("--strict");
const failures = [];

const functionsSource = fs.readFileSync("functions/index.js", "utf8");
const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));

if (!functionsSource.includes("enforceAppCheck: true")) {
  failures.push("functions/index.js must keep enforceAppCheck enabled for callable functions.");
}

if (!functionsSource.includes('process.env.FUNCTIONS_ENFORCE_APP_CHECK !== "false"')) {
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

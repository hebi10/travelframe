import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const script = fs.readFileSync(path.join(root, "scripts/build-android-aab.ps1"), "utf8");

const loaderIndex = script.indexOf("Import-SigningEnvFile");
const defaultEnvIndex = script.indexOf('credentials\\android\\signing.env');
const missingEnvIndex = script.indexOf("$missingEnv = @()");

assert.notEqual(loaderIndex, -1, "build script should define a signing env file loader");
assert.notEqual(defaultEnvIndex, -1, "build script should look for credentials\\android\\signing.env by default");
assert.notEqual(missingEnvIndex, -1, "build script should still validate required signing values");
assert.ok(
  loaderIndex < missingEnvIndex && defaultEnvIndex < missingEnvIndex,
  "signing env file should be loaded before required signing values are validated"
);

const localSigningEnvPath = path.join(root, "credentials/android/signing.env");
if (fs.existsSync(localSigningEnvPath)) {
  const localSecrets = fs
    .readFileSync(localSigningEnvPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(line.indexOf("=") + 1).trim())
    .filter(Boolean);

  for (const secret of localSecrets) {
    assert.equal(script.includes(secret), false, "build script must not hardcode signing secrets");
  }
}

console.log("ok - android signing env file loader is configured");

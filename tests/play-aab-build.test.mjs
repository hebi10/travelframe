import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const scriptPath = path.resolve("scripts/prepare-play-aab.mjs");
assert.ok(fs.existsSync(scriptPath), "Play AAB input/signing preparation is not implemented");
const { validateBuildInputs, validateAppConfiguration, patchBuildGradle, configureSourceVersion, decodeKeystore } = await import(scriptPath);
const valid = {
  sourceSha: "9103b26b94e19f40c2302873e2dd0d4c39c9db25",
  versionCode: "26092623",
  lastPlayVersionCode: "26092622",
  versionName: "1.0.32",
  certificateSha256: "ab:".repeat(31) + "ab"
};

test("rejects invalid source refs and reused, understated or overflowing Play version codes", () => {
  const result = validateBuildInputs(valid);
  assert.equal(result.versionCode, 26092623);
  assert.equal(result.certificateSha256, "ab".repeat(32));
  for (const changes of [
    { sourceSha: "main" }, { sourceSha: "$(id)" },
    { versionCode: "26092622" }, { versionCode: "26092621" },
    { versionCode: "2100000001" }, { versionCode: "1e8" },
    { lastPlayVersionCode: "1" }, { lastPlayVersionCode: "26092623" },
    { versionName: "1.0.32\nanything" }, { certificateSha256: "" }
  ]) assert.throws(() => validateBuildInputs({ ...valid, ...changes }));
});

test("rejects malformed or empty keystore base64 before creating a file", () => {
  assert.deepEqual(decodeKeystore("YWJj\n"), Buffer.from("abc"));
  for (const value of ["", "not base64!", "abc", "===="]) assert.throws(() => decodeKeystore(value));
});

test("rejects missing production Firebase and Android sign-in settings without leaking values", () => {
  const configured = {
    EXPO_PUBLIC_FIREBASE_API_KEY: "AIza" + "x".repeat(35),
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "travelframe-4e1fb.firebaseapp.com",
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: "travelframe-4e1fb",
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "travelframe-4e1fb.firebasestorage.app",
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456",
    EXPO_PUBLIC_FIREBASE_APP_ID: "1:123456:web:abcdef123456",
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "123456-abcdef.apps.googleusercontent.com"
  };
  assert.doesNotThrow(() => validateAppConfiguration(configured, "travelframe-4e1fb"));
  for (const name of Object.keys(configured)) assert.throws(() => validateAppConfiguration({ ...configured, [name]: "" }, "travelframe-4e1fb"), new RegExp(name));
  assert.throws(() => validateAppConfiguration({ ...configured, EXPO_PUBLIC_FIREBASE_PROJECT_ID: "other-project" }, "travelframe-4e1fb"));
  assert.throws(() => validateAppConfiguration({ ...configured, EXPO_PUBLIC_FIREBASE_APP_ID: "1:999:web:abcdef" }, "travelframe-4e1fb"));
});

test("changes only generated release signing and version metadata without embedding credentials", () => {
  const original = `android {\n defaultConfig { versionCode 1\n versionName "1.0.30" }\n signingConfigs { debug { storeFile file('debug.keystore') } }\n buildTypes { debug { signingConfig signingConfigs.debug }\n release { signingConfig signingConfigs.debug\n minifyEnabled enableMinifyInReleaseBuilds\n proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro' } }\n}`;
  const patched = patchBuildGradle(original, validateBuildInputs(valid));
  assert.match(patched, /versionCode 26092623/);
  assert.match(patched, /versionName "1\.0\.32"/);
  assert.match(patched, /release \{ signingConfig signingConfigs\.release/);
  assert.match(patched, /debug \{ signingConfig signingConfigs\.debug/);
  assert.match(patched, /System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.throws(() => patchBuildGradle(original.replace("versionCode 1", "unknownVersion 1"), validateBuildInputs(valid)));
  assert.throws(() => patchBuildGradle(original.replace("signingConfig signingConfigs.debug\n minify", "missingSigning\n minify"), validateBuildInputs(valid)));
  assert.throws(() => patchBuildGradle(original + "\n versionCode 2", validateBuildInputs(valid)));
});

test("updates app and package build versions together without changing unrelated fields", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-version-test-"));
  try {
    fs.writeFileSync(path.join(directory, "app.json"), JSON.stringify({ expo: { version: "1.0.30", android: { package: "com.haebi.photoguide" } } }));
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version: "1.0.30", name: "travel-frame" }));
    configureSourceVersion(directory, "1.0.32");
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "app.json"))).expo.version, "1.0.32");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "app.json"))).expo.android, { package: "com.haebi.photoguide" });
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "package.json"))).version, "1.0.32");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("missing signing secrets fail without printing provided secret values or producing artifacts", () => {
  const marker = "sensitive-value-must-not-be-logged";
  const result = spawnSync(process.execPath, [scriptPath, "signing"], {
    encoding: "utf8", env: { ...process.env, ANDROID_KEYSTORE_BASE64: marker, ANDROID_KEYSTORE_PASSWORD: marker, ANDROID_KEY_ALIAS: "", ANDROID_KEY_PASSWORD: "" }
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(marker));
});

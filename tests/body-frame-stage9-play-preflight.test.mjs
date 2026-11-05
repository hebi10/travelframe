import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { requirePlayPublishWindow, EARLIEST_PLAY_PUBLISH_AT } from "../scripts/publish-play-release.mjs";
import { verifyUploadCertificateDer, checkUploadCertificate } from "../scripts/check-play-upload-certificate.mjs";

const minTime = Date.parse(EARLIEST_PLAY_PUBLISH_AT);

test("Play publish is blocked before 2026-11-07 00:00 KST even with an approval variable", () => {
  assert.equal(EARLIEST_PLAY_PUBLISH_AT, "2026-11-06T15:00:00.000Z");
  assert.throws(() => requirePlayPublishWindow("publish", minTime - 1), /2026-11-07/);
  assert.doesNotThrow(() => requirePlayPublishWindow("publish", minTime));
  assert.doesNotThrow(() => requirePlayPublishWindow("publish", minTime + 86400000));
  assert.doesNotThrow(() => requirePlayPublishWindow("inventory", minTime - 86400000));
  assert.throws(() => requirePlayPublishWindow("other", minTime + 86400000));
  assert.throws(() => requirePlayPublishWindow("publish", NaN));
});

test("manual keystore preflight verifies a real private key, expiry and pinned/Console certificates without revealing secrets", { timeout: 60_000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "travel-frame-stage9-cert-test-"));
  const keystore = path.join(dir, "fixture.p12");
  const tempRoot = path.join(dir, "temp");
  fs.mkdirSync(tempRoot);
  const env = {
    ...process.env,
    ANDROID_KEYSTORE_PASSWORD: "fixture-key-store-pass",
    ANDROID_KEY_PASSWORD: "fixture-key-store-pass",
    ANDROID_KEY_ALIAS: "test-upload",
    RUNNER_TEMP: tempRoot
  };
  const run = (args) => {
    const result = spawnSync("keytool", args, { encoding: null, env, timeout: 25_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, "Temporary fixture keytool call must succeed");
    return result.stdout;
  };
  try {
    run([
      "-genkeypair", "-alias", env.ANDROID_KEY_ALIAS,
      "-keyalg", "RSA", "-keysize", "2048",
      "-validity", "3", "-dname", "CN=Body Frame Stage9 Test Fixture",
      "-keystore", keystore, "-storetype", "PKCS12",
      "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
      "-keypass:env", "ANDROID_KEY_PASSWORD", "-noprompt"
    ]);
    const certificate = run([
      "-exportcert", "-alias", env.ANDROID_KEY_ALIAS,
      "-keystore", keystore, "-storepass:env", "ANDROID_KEYSTORE_PASSWORD"
    ]);
    const fingerprint = crypto.createHash("sha256").update(certificate).digest("hex");
    const pin = fingerprint.toUpperCase().match(/.{2}/g).join(":");
    assert.equal(verifyUploadCertificateDer(certificate, pin).matchesConfiguredFingerprint, true);
    assert.equal(verifyUploadCertificateDer(certificate, fingerprint, pin).matchesSuppliedPlayConsoleFingerprint, true);
    assert.throws(() => verifyUploadCertificateDer(certificate, "ff".repeat(32)), /fingerprint/);
    assert.throws(() => verifyUploadCertificateDer(certificate, fingerprint, "00".repeat(32)), /Play Console/);
    assert.throws(() => verifyUploadCertificateDer(certificate, fingerprint, "", 0), /valid/);
    const configured = {
      ...env,
      ANDROID_UPLOAD_CERT_SHA256: fingerprint,
      ANDROID_KEYSTORE_BASE64: fs.readFileSync(keystore).toString("base64")
    };
    assert.deepEqual(checkUploadCertificate(configured), {
      matchesConfiguredFingerprint: true,
      matchesSuppliedPlayConsoleFingerprint: false,
      certificateCurrentlyValid: true,
      debugCertificate: false,
      privateKeyAccessible: true
    });
    assert.equal(fs.readdirSync(tempRoot).length, 0, "Temporary keystore and certificate requests must be removed");
    assert.equal(checkUploadCertificate({ ...configured, PLAY_CONSOLE_UPLOAD_CERT_SHA256: pin }).matchesSuppliedPlayConsoleFingerprint, true);
    assert.throws(() => checkUploadCertificate({ ...configured, ANDROID_KEYSTORE_PASSWORD: "incorrect-store-pass" }), /Keytool certificate\/key verification failed/);
    assert.equal(fs.readdirSync(tempRoot).length, 0);
    assert.throws(() => checkUploadCertificate({ ...configured, ANDROID_UPLOAD_CERT_SHA256: "00".repeat(32) }), /configured upload-certificate/);
    assert.equal(fs.readdirSync(tempRoot).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 9 preflight cannot publish and cannot automatically activate upload approval", () => {
  const workflow = fs.readFileSync(".github/workflows/body-frame-play-preflight.yml", "utf8");
  const publishWorkflow = fs.readFileSync(".github/workflows/android-play-aab.yml", "utf8");
  const publishScript = fs.readFileSync("scripts/publish-play-release.mjs", "utf8");
  assert.ok(workflow.includes("workflow_dispatch:"));
  assert.ok(!workflow.includes("\n  push:") && !workflow.includes("\n  schedule:"));
  assert.ok(workflow.includes("github.ref == 'refs/heads/main'"));
  assert.ok(workflow.includes("PLAY_CONSOLE_UPLOAD_CERT_SHA256"));
  assert.ok(workflow.includes("scripts/check-play-upload-certificate.mjs"));
  assert.ok(workflow.includes("INPUT_OPERATION: inventory"));
  assert.ok(workflow.includes("scripts/publish-play-release.mjs plan"));
  assert.ok(!workflow.includes("scripts/publish-play-release.mjs publish"));
  assert.ok(!workflow.includes("prepare-play-aab.mjs signing"));
  assert.ok(!workflow.includes("bundleRelease"));
  assert.ok(!workflow.includes("BODY_FRAME_PLAY_SIGNING_APPROVED_20261107: true"));
  assert.ok(publishWorkflow.includes("BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'"));
  for (const marker of [
    'requirePlayPublishWindow(request.operation);',
    'requirePlayPublishWindow("publish");'
  ]) assert.ok(publishScript.includes(marker), "All publishing entrypoints must respect the calendar gate");
  assert.ok(publishScript.includes("2026-11-06T15:00:00.000Z"));
});

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodeKeystore } from "./prepare-play-aab.mjs";

const validSha256 = (value, label) => {
  const normalized = String(value ?? "").replace(/[:\s]/g, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error(`${label} must contain a valid SHA-256 certificate fingerprint`);
  return normalized;
};

export function verifyUploadCertificateDer(certificateDer, pinnedSha256, playConsoleSha256 = "", at = Date.now()) {
  const certificate = new crypto.X509Certificate(certificateDer);
  const pinned = validSha256(pinnedSha256, "ANDROID_UPLOAD_CERT_SHA256");
  const actual = crypto.createHash("sha256").update(certificate.raw).digest("hex");
  if (actual !== pinned) throw new Error("Keystore certificate does not match the configured upload-certificate fingerprint");
  if (/android debug/i.test(certificate.subject)) throw new Error("Debug certificates are forbidden for Play uploads");
  if (!Number.isFinite(at) || at < Date.parse(certificate.validFrom) || at > Date.parse(certificate.validTo)) {
    throw new Error("Upload certificate is not valid at the preflight time");
  }

  const consoleFingerprint = String(playConsoleSha256 ?? "").trim();
  if (consoleFingerprint && validSha256(consoleFingerprint, "PLAY_CONSOLE_UPLOAD_CERT_SHA256") !== actual) {
    throw new Error("Play Console upload-certificate fingerprint does not match the keystore certificate");
  }
  return {
    matchesConfiguredFingerprint: true,
    matchesSuppliedPlayConsoleFingerprint: Boolean(consoleFingerprint),
    certificateCurrentlyValid: true,
    debugCertificate: false
  };
}

const KEYTOOL_STAGE_MESSAGE = Object.freeze({
  "keystore-open": "Upload keystore cannot be opened: check the stored keystore file and store password",
  "alias-lookup": "Upload alias not found or inaccessible in the opened keystore: check the configured key alias",
  "certificate-export": "Upload certificate could not be exported from the configured key alias",
  "private-key-check": "Upload private key could not produce a certificate request: check private-key access and key password"
});

function runKeytool(arguments_, environment, stage) {
  if (!Object.hasOwn(KEYTOOL_STAGE_MESSAGE, stage)) throw new Error("Unknown signing preflight stage");
  const result = spawnSync("keytool", arguments_, {
    encoding: null,
    env: environment,
    timeout: 25_000,
    maxBuffer: 2 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    // Never print keytool stdout/stderr, the alias, certificate bytes, or secret values.
    throw new Error(KEYTOOL_STAGE_MESSAGE[stage]);
  }
  return result.stdout;
}

export function checkUploadCertificate(environment = process.env) {
  for (const name of [
    "ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD", "ANDROID_UPLOAD_CERT_SHA256"
  ]) {
    if (!environment[name]) throw new Error(`Missing required preflight configuration: ${name}`);
  }
  const temporary = fs.mkdtempSync(path.join(environment.RUNNER_TEMP || os.tmpdir(), "body-frame-upload-preflight-"));
  const keystore = path.join(temporary, "upload.jks");
  const csr = path.join(temporary, "private-key-check.csr");
  try {
    fs.writeFileSync(keystore, decodeKeystore(environment.ANDROID_KEYSTORE_BASE64), { mode: 0o600 });
    const base = [
      "-alias", environment.ANDROID_KEY_ALIAS,
      "-keystore", keystore,
      "-storepass:env", "ANDROID_KEYSTORE_PASSWORD"
    ];
    runKeytool(
      ["-list", "-keystore", keystore, "-storepass:env", "ANDROID_KEYSTORE_PASSWORD"],
      environment, "keystore-open"
    );
    runKeytool(["-list", ...base], environment, "alias-lookup");
    const certificate = runKeytool(["-exportcert", ...base], environment, "certificate-export");
    const verified = verifyUploadCertificateDer(
      certificate,
      environment.ANDROID_UPLOAD_CERT_SHA256,
      environment.PLAY_CONSOLE_UPLOAD_CERT_SHA256
    );
    runKeytool(["-certreq", ...base, "-keypass:env", "ANDROID_KEY_PASSWORD", "-file", csr], environment, "private-key-check");
    if (!fs.existsSync(csr) || fs.statSync(csr).size <= 0) {
      throw new Error("Keystore private key could not produce a certificate request");
    }
    return { ...verified, privateKeyAccessible: true };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkUploadCertificate();
    console.log("Upload certificate preflight succeeded: configured fingerprint, validity and private key access verified");
    console.log(result.matchesSuppliedPlayConsoleFingerprint
      ? "Manually supplied Play Console upload-certificate fingerprint also matches"
      : "Play Console upload-certificate fingerprint was not supplied; actual Play matching remains unverified");
    console.log("No AAB or APK was built, signed, uploaded or published");
  } catch (error) {
    console.error(`Upload certificate preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("real JAR verifier rejects unsigned, wrong-signer, tampered and debug/test-only release bundles", { timeout: 120_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "body-frame-signature-fixture-"));
  const execute = (command, arguments_, options = {}) => {
    const result = spawnSync(command, arguments_, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024, ...options });
    assert.equal(result.status, 0, `${command} fixture command failed`);
    return result.stdout;
  };
  const values = {
    EXPO_PUBLIC_FIREBASE_API_KEY: "fixture-api-key",
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "fixture.firebaseapp.com",
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: "fixture-project",
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "fixture.appspot.com",
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456",
    EXPO_PUBLIC_FIREBASE_APP_ID: "fixture-app-id",
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "fixture.apps.googleusercontent.com"
  };
  try {
    const keystore = path.join(directory, "test-only.p12");
    execute("keytool", ["-genkeypair", "-alias", "test-only", "-keyalg", "RSA", "-keysize", "2048", "-validity", "2", "-dname", "CN=Body Frame Ephemeral Test Fixture", "-keystore", keystore, "-storetype", "PKCS12", "-storepass", "test-only-password", "-keypass", "test-only-password", "-noprompt"]);
    const der = execute("keytool", ["-exportcert", "-alias", "test-only", "-keystore", keystore, "-storepass", "test-only-password"], { encoding: null });
    const fingerprint = crypto.createHash("sha256").update(der).digest("hex");
    const fixtureSource = path.join(directory, "SignFixture.java");
    fs.writeFileSync(fixtureSource, `import java.nio.file.*; import java.security.*; import java.io.*; import java.util.zip.*; import jdk.security.jarsigner.JarSigner;
class SignFixture { public static void main(String[] a) throws Exception {
 if(a[0].equals("create")) { try(var z=new ZipOutputStream(new FileOutputStream(a[1]))) {
  for(String name:new String[]{"BundleConfig.pb","base/manifest/AndroidManifest.xml","base/assets/index.android.bundle","base/dex/classes.dex","base/lib/arm64-v8a/libfixture.so"}) {
   z.putNextEntry(new ZipEntry(name)); z.write((name.contains("index.android.bundle") ? a[2] : "fixture-content").getBytes()); z.closeEntry(); }
 } } else if(a[0].equals("sign")) {
 var ks=KeyStore.getInstance(new File(a[1]), "test-only-password".toCharArray());
 var entry=(KeyStore.PrivateKeyEntry)ks.getEntry("test-only", new KeyStore.PasswordProtection("test-only-password".toCharArray()));
 try(var z=new ZipFile(a[2]); var output=new FileOutputStream(a[3])) { new JarSigner.Builder(entry).build().sign(z,output); }
 } else { try(var input=new ZipFile(a[1]); var output=new ZipOutputStream(new FileOutputStream(a[2]))) {
 var entries=input.entries(); while(entries.hasMoreElements()) { var e=entries.nextElement(); output.putNextEntry(new ZipEntry(e.getName()));
 output.write(e.getName().equals("base/dex/classes.dex") && a[0].equals("tamper") ? "tampered".getBytes() : input.getInputStream(e).readAllBytes()); output.closeEntry(); }
 if(a[0].equals("append")) { output.putNextEntry(new ZipEntry("base/assets/unsigned.txt")); output.write("unsigned".getBytes()); output.closeEntry(); }
 } }
} }`);
    const unsigned = path.join(directory, "unsigned.aab");
    const signed = path.join(directory, "signed.aab");
    execute("java", [fixtureSource, "create", unsigned, Object.values(values).join("\n")]);
    execute("java", [fixtureSource, "sign", keystore, unsigned, signed]);
    const manifest = path.join(directory, "manifest.xml");
    const normalManifest = '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.haebi.photoguide" android:versionCode="26092623" android:versionName="1.0.32"><application android:debuggable="false"/></manifest>';
    fs.writeFileSync(manifest, normalManifest);
    const verify = (bundle, expected = fingerprint, overrides = {}) => spawnSync("java", [path.resolve("scripts/VerifyPlayBundle.java"), bundle, expected, manifest, "26092623", "1.0.32"], { encoding: "utf8", env: { ...process.env, ...values, ...overrides } });
    assert.equal(verify(signed).status, 0);
    assert.notEqual(verify(unsigned).status, 0);
    assert.notEqual(verify(signed, "00".repeat(32)).status, 0);
    assert.notEqual(verify(signed, fingerprint, { EXPO_PUBLIC_FIREBASE_APP_ID: "missing-from-bundle" }).status, 0);
    for (const [label, subject, dateArguments] of [
      ["debug", "CN=Android Debug", []],
      ["expired", "CN=Expired Test Fixture", ["-startdate", "-3d"]]
    ]) {
      const testKeystore = path.join(directory, `${label}-test-only.p12`);
      execute("keytool", ["-genkeypair", "-alias", "test-only", "-keyalg", "RSA", "-keysize", "2048", "-validity", "1", "-dname", subject, "-keystore", testKeystore, "-storetype", "PKCS12", "-storepass", "test-only-password", "-keypass", "test-only-password", "-noprompt", ...dateArguments]);
      const certificate = execute("keytool", ["-exportcert", "-alias", "test-only", "-keystore", testKeystore, "-storepass", "test-only-password"], { encoding: null });
      const testBundle = path.join(directory, `${label}-test-only.aab`);
      execute("java", [fixtureSource, "sign", testKeystore, unsigned, testBundle]);
      assert.notEqual(verify(testBundle, crypto.createHash("sha256").update(certificate).digest("hex")).status, 0);
    }
    for (const mode of ["tamper", "append"]) {
      const modified = path.join(directory, `${mode}.aab`);
      execute("java", [fixtureSource, mode, signed, modified]);
      assert.notEqual(verify(modified).status, 0);
    }
    for (const change of [
      normalManifest.replace('debuggable="false"', 'debuggable="true"'),
      normalManifest.replace('debuggable="false"', 'testOnly="true"'),
      normalManifest.replace("26092623", "26092622"),
      normalManifest.replace("com.haebi.photoguide", "other.application")
    ]) { fs.writeFileSync(manifest, change); assert.notEqual(verify(signed).status, 0); }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

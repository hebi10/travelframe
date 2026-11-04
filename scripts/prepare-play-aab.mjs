import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const OBSERVED_PLAY_VERSION_CODE = 26092622;
const BUNDLETOOL_SHA256 = "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29";

export const APP_CONFIGURATION_NAMES = [
  "EXPO_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID", "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"
];

export function validateAppConfiguration(environment, expectedProjectId) {
  for (const name of APP_CONFIGURATION_NAMES) {
    if (!environment[name]?.trim()) throw new Error(`Required production app configuration is missing: ${name}`);
  }
  const valid = (name, expression) => {
    if (!expression.test(environment[name])) throw new Error(`Invalid production app configuration: ${name}`);
  };
  valid("EXPO_PUBLIC_FIREBASE_API_KEY", /^AIza[A-Za-z0-9_-]{35}$/);
  valid("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", /^[a-z0-9.-]+\.[a-z]{2,}$/i);
  valid("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", /^\d+$/);
  valid("EXPO_PUBLIC_FIREBASE_APP_ID", /^\d+:\d+:(web|android):[a-f0-9]+$/i);
  valid("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID", /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i);
  if (environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== expectedProjectId) throw new Error("EXPO_PUBLIC_FIREBASE_PROJECT_ID does not match the source Firebase project");
  if (![`${expectedProjectId}.appspot.com`, `${expectedProjectId}.firebasestorage.app`].includes(environment.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET)) throw new Error("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET does not match the source Firebase project");
  if (environment.EXPO_PUBLIC_FIREBASE_APP_ID.split(":")[1] !== environment.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) throw new Error("EXPO_PUBLIC_FIREBASE_APP_ID and EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID do not match");
}

export function validateBuildInputs(input) {
  if (!/^[a-f0-9]{40}$/i.test(input.sourceSha ?? "")) throw new Error("source_sha must be a full 40-character commit SHA");
  const integer = (value, name) => {
    if (!/^[1-9]\d{0,9}$/.test(value ?? "")) throw new Error(`${name} must be a positive decimal integer`);
    const number = Number(value);
    if (number > 2100000000) throw new Error(`${name} exceeds the Android versionCode limit`);
    return number;
  };
  const versionCode = integer(input.versionCode, "version_code");
  const lastPlayVersionCode = integer(input.lastPlayVersionCode, "last_play_version_code");
  if (lastPlayVersionCode < OBSERVED_PLAY_VERSION_CODE) throw new Error("last_play_version_code is below the confirmed Play versionCode floor");
  if (versionCode <= lastPlayVersionCode) throw new Error("version_code must exceed the latest versionCode in every Play track");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(input.versionName ?? "") || input.versionName.length > 50) {
    throw new Error("version_name must contain three numeric parts, for example 1.0.32");
  }
  const certificateSha256 = (input.certificateSha256 ?? "").replace(/[:\s]/g, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(certificateSha256)) throw new Error("ANDROID_UPLOAD_CERT_SHA256 must contain the existing Play upload certificate SHA-256");
  return { sourceSha: input.sourceSha.toLowerCase(), versionCode, lastPlayVersionCode, versionName: input.versionName, certificateSha256 };
}

export function decodeKeystore(value) {
  const normalized = (value ?? "").replace(/\s/g, "");
  if (!normalized || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) throw new Error("ANDROID_KEYSTORE_BASE64 is not valid base64");
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== normalized) throw new Error("ANDROID_KEYSTORE_BASE64 is not canonical base64");
  return decoded;
}

export function configureSourceVersion(sourceRoot, versionName) {
  const appPath = path.join(sourceRoot, "app.json");
  const packagePath = path.join(sourceRoot, "package.json");
  const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (app.expo?.android?.package !== "com.haebi.photoguide") throw new Error("Source package ID does not match Body Frame");
  app.expo.version = versionName;
  packageJson.version = versionName;
  fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
}

export function patchBuildGradle(original, inputs) {
  const replaceOnce = (text, expression, replacement, label) => {
    if ([...text.matchAll(new RegExp(expression.source, "g"))].length !== 1) throw new Error(`Expected exactly one generated Gradle ${label}`);
    return text.replace(expression, replacement);
  };
  if (original.includes("TRAVELFRAME_UPLOAD_STORE_FILE")) throw new Error("Expected a clean Android prebuild before release signing");
  let result = replaceOnce(original, /\bversionCode\s+\d+/, `versionCode ${inputs.versionCode}`, "versionCode");
  result = replaceOnce(result, /\bversionName\s+"[^"]*"/, `versionName "${inputs.versionName}"`, "versionName");
  result = replaceOnce(result, /\bsigningConfigs\s*\{/, `signingConfigs {
        release {
            // TRAVELFRAME_UPLOAD_STORE_FILE
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }`, "signingConfigs");
  result = replaceOnce(result, /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?signingConfig\s+(?:=\s*)?)signingConfigs\.(?:debug|release)\b/, "$1signingConfigs.release", "release signingConfig");
  if (!result.includes("minifyEnabled enableMinifyInReleaseBuilds") || !result.includes("proguardFiles getDefaultProguardFile")) throw new Error("Generated Gradle release R8 configuration is missing");
  return result;
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} verification failed; sensitive command output has been withheld`);
  return result.stdout;
}

const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const readInputs = () => JSON.parse(fs.readFileSync(process.env.AAB_BUILD_INPUTS, "utf8"));

function prepareInputs() {
  const inputs = validateBuildInputs({
    sourceSha: process.env.SOURCE_SHA, versionCode: process.env.VERSION_CODE,
    lastPlayVersionCode: process.env.LAST_PLAY_VERSION_CODE, versionName: process.env.VERSION_NAME,
    certificateSha256: process.env.ANDROID_UPLOAD_CERT_SHA256
  });
  const actualSha = run("git", ["rev-parse", "HEAD"], { cwd: process.env.SOURCE_DIR }).trim();
  if (actualSha !== inputs.sourceSha) throw new Error("Source checkout SHA does not match source_sha");
  const firebase = JSON.parse(fs.readFileSync(path.join(process.env.SOURCE_DIR, ".firebaserc"), "utf8"));
  validateAppConfiguration(process.env, firebase.projects?.default);
  const app = JSON.parse(fs.readFileSync(path.join(process.env.SOURCE_DIR, "app.json"), "utf8"));
  const ads = app.expo?.extra?.admob;
  if (!/^ca-app-pub-\d+~\d+$/.test(ads?.androidAppId ?? "") || !/^ca-app-pub-\d+\/\d+$/.test(ads?.androidBannerAdUnitId ?? "") || !/^ca-app-pub-\d+\/\d+$/.test(ads?.androidInterstitialAdUnitId ?? "") || JSON.stringify(ads).includes("3940256099942544")) throw new Error("Production AdMob app/banner/interstitial configuration is missing or uses sample IDs");
  configureSourceVersion(process.env.SOURCE_DIR, inputs.versionName);
  fs.writeFileSync(process.env.AAB_BUILD_INPUTS, JSON.stringify(inputs, null, 2) + "\n");
  console.log(`Validated source ${inputs.sourceSha}, version ${inputs.versionName} (${inputs.versionCode})`);
}

function requireSigningSecrets() {
  for (const name of ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]) {
    if (!process.env[name]) throw new Error(`Required repository signing secret is missing: ${name}`);
  }
}

function prepareSigning() {
  requireSigningSecrets();
  const inputs = readInputs();
  const directory = path.join(process.env.RUNNER_TEMP, "body-frame-upload-key");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keystore = path.join(directory, "upload-keystore.jks");
  fs.writeFileSync(keystore, decodeKeystore(process.env.ANDROID_KEYSTORE_BASE64), { mode: 0o600 });
  try {
    const certificate = run("keytool", ["-exportcert", "-alias", process.env.ANDROID_KEY_ALIAS, "-keystore", keystore, "-storepass:env", "ANDROID_KEYSTORE_PASSWORD"], { encoding: null });
    const parsed = new crypto.X509Certificate(certificate);
    const fingerprint = crypto.createHash("sha256").update(parsed.raw).digest("hex");
    if (fingerprint !== inputs.certificateSha256) throw new Error("Signing certificate does not match the Play upload certificate");
    if (/Android Debug/i.test(parsed.subject)) throw new Error("Android Debug signing certificates are not permitted");
    const now = Date.now();
    if (now < Date.parse(parsed.validFrom) || now > Date.parse(parsed.validTo)) throw new Error("Upload signing certificate is not currently valid");
    const gradle = path.join(process.env.SOURCE_DIR, "android/app/build.gradle");
    fs.writeFileSync(gradle, patchBuildGradle(fs.readFileSync(gradle, "utf8"), inputs));
    const properties = path.join(process.env.SOURCE_DIR, "android/gradle.properties");
    let content = fs.readFileSync(properties, "utf8");
    for (const name of ["android.enableMinifyInReleaseBuilds", "android.enableShrinkResourcesInReleaseBuilds"]) {
      content = content.replace(new RegExp(`^${name.replaceAll(".", "\\.")}=.*$`, "gm"), "");
      content += `\n${name}=true\n`;
    }
    fs.writeFileSync(properties, content);
    fs.appendFileSync(process.env.GITHUB_ENV, `ANDROID_KEYSTORE_PATH=${keystore}\n`);
    console.log("Existing Play upload certificate matched; release signing configured");
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function verifyBundle() {
  const inputs = readInputs();
  if (hash(process.env.BUNDLETOOL_JAR) !== BUNDLETOOL_SHA256) throw new Error("Pinned bundletool SHA-256 mismatch");
  const aab = path.join(process.env.SOURCE_DIR, "android/app/build/outputs/bundle/release/app-release.aab");
  const mapping = path.join(process.env.SOURCE_DIR, "android/app/build/outputs/mapping/release/mapping.txt");
  if (!fs.existsSync(mapping) || fs.statSync(mapping).size === 0) throw new Error("Release R8 mapping.txt is missing or empty");
  run("java", ["-jar", process.env.BUNDLETOOL_JAR, "validate", "--bundle", aab]);
  const manifest = run("java", ["-jar", process.env.BUNDLETOOL_JAR, "dump", "manifest", "--bundle", aab, "--module", "base"]);
  const manifestPath = path.join(process.env.RUNNER_TEMP, "body-frame-bundle-manifest.xml");
  fs.writeFileSync(manifestPath, manifest);
  run("java", [path.join(path.dirname(fileURLToPath(import.meta.url)), "VerifyPlayBundle.java"), aab, inputs.certificateSha256, manifestPath, String(inputs.versionCode), inputs.versionName]);
  const destination = process.env.AAB_ARTIFACT_DIR;
  fs.mkdirSync(destination, { recursive: true });
  const name = `BodyFrame-${inputs.versionName}-${inputs.versionCode}.aab`;
  fs.copyFileSync(aab, path.join(destination, name));
  fs.copyFileSync(mapping, path.join(destination, "mapping.txt"));
  fs.copyFileSync(manifestPath, path.join(destination, "AndroidManifest.xml"));
  const provenance = {
    repository: process.env.GITHUB_REPOSITORY, sourceSha: inputs.sourceSha,
    workflowSha: process.env.BUILD_WORKFLOW_SHA, workflowRef: process.env.GITHUB_WORKFLOW_REF,
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    packageId: "com.haebi.photoguide", versionName: inputs.versionName, versionCode: inputs.versionCode,
    confirmedPreviousPlayVersionCode: inputs.lastPlayVersionCode,
    uploadCertificateSha256: inputs.certificateSha256, aabSha256: hash(aab), mappingSha256: hash(mapping),
    bundletoolVersion: "1.18.3", bundletoolSha256: BUNDLETOOL_SHA256,
    embeddedAppConfigurationNames: APP_CONFIGURATION_NAMES,
    buildVersionOverrides: ["app.json:expo.version", "package.json:version", "android/app/build.gradle:versionCode/versionName"],
    validations: ["bundletool validate", "actual AAB manifest", "all payload JAR signatures and upload certificate", "embedded JavaScript", "ARM64 native libraries", "R8 mapping"]
  };
  fs.writeFileSync(path.join(destination, "build-provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
  fs.writeFileSync(path.join(destination, "SHA256SUMS"), `${provenance.aabSha256}  ${name}\n${provenance.mappingSha256}  mapping.txt\n`);
  console.log(`Verified Play AAB: ${name}; source ${inputs.sourceSha}`);
}

export function verifyApkSigner(output, expectedFingerprint) {
  const certificates = [...output.matchAll(/^Signer #\d+ certificate SHA-256 digest:\s*([a-f0-9]+)\s*$/gim)];
  if (certificates.length !== 1 || certificates[0][1].toLowerCase() !== expectedFingerprint) throw new Error("APK signer does not match the existing Play upload certificate");
}

function buildInstallApk() {
  requireSigningSecrets();
  const inputs = readInputs();
  const directory = path.join(process.env.RUNNER_TEMP, "body-frame-upload-key");
  const keystore = path.join(directory, "upload-keystore.jks");
  if (process.env.ANDROID_KEYSTORE_PATH !== keystore || !fs.existsSync(keystore)) throw new Error("Verified existing upload keystore is required for APK generation; debug fallback is forbidden");
  if (hash(process.env.BUNDLETOOL_JAR) !== BUNDLETOOL_SHA256) throw new Error("Pinned bundletool SHA-256 mismatch");
  const destination = process.env.AAB_ARTIFACT_DIR;
  const aab = path.join(destination, `BodyFrame-${inputs.versionName}-${inputs.versionCode}.aab`);
  const provenancePath = path.join(destination, "build-provenance.json");
  const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
  if (hash(aab) !== provenance.aabSha256) throw new Error("Verified AAB changed before APK generation");
  const storePassword = path.join(directory, "store-password.txt");
  const keyPassword = path.join(directory, "key-password.txt");
  for (const [file, value] of [[storePassword, process.env.ANDROID_KEYSTORE_PASSWORD], [keyPassword, process.env.ANDROID_KEY_PASSWORD]]) {
    if (/[\r\n]/.test(value)) throw new Error("APK password-file signing requires passwords without line breaks");
    fs.writeFileSync(file, value, { mode: 0o600 });
  }
  const archive = path.join(process.env.RUNNER_TEMP, "body-frame-universal.apks");
  run("java", ["-jar", process.env.BUNDLETOOL_JAR, "build-apks", `--bundle=${aab}`, `--output=${archive}`, "--mode=universal", "--overwrite", `--ks=${keystore}`, `--ks-key-alias=${process.env.ANDROID_KEY_ALIAS}`, `--ks-pass=file:${storePassword}`, `--key-pass=file:${keyPassword}`]);
  const apk = path.join(process.env.RUNNER_TEMP, "body-frame-universal.apk");
  run("python3", ["-c", "import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n e=z.getinfo('universal.apk')\n assert e.file_size > 0\n with z.open(e) as src, open(sys.argv[2], 'wb') as dst:\n  import shutil; shutil.copyfileobj(src,dst)", archive, apk]);
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error("Android SDK is required to verify the install APK");
  const buildTools = fs.readdirSync(path.join(sdk, "build-tools")).filter((name) => /^\d+\.\d+\.\d+$/.test(name)).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  if (!buildTools.length) throw new Error("Android apksigner is unavailable");
  const signature = run(path.join(sdk, "build-tools", buildTools[0], "apksigner"), ["verify", "--verbose", "--print-certs", apk]);
  verifyApkSigner(signature, inputs.certificateSha256);
  const manifest = run(path.join(sdk, "cmdline-tools/latest/bin/apkanalyzer"), ["manifest", "print", apk]);
  const manifestPath = path.join(process.env.RUNNER_TEMP, "body-frame-apk-manifest.xml");
  fs.writeFileSync(manifestPath, manifest);
  run("java", [path.join(path.dirname(fileURLToPath(import.meta.url)), "VerifyPlayBundle.java"), "--manifest", manifestPath, String(inputs.versionCode), inputs.versionName]);
  const name = `BodyFrame-${inputs.versionName}-${inputs.versionCode}-upload-key.apk`;
  fs.copyFileSync(apk, path.join(destination, name));
  provenance.apkSha256 = hash(apk);
  provenance.apkSourceAabSha256 = provenance.aabSha256;
  provenance.apkSigningCertificateSha256 = inputs.certificateSha256;
  provenance.apkPurpose = "Direct installation with upload-key signature; Play distributes APKs signed by the separate Play app signing key";
  provenance.validations.push("universal APK generated from the verified AAB", "apksigner verification and upload certificate", "actual APK package/version/release manifest");
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + "\n");
  fs.appendFileSync(path.join(destination, "SHA256SUMS"), `${provenance.apkSha256}  ${name}\n`);
  console.log(`Verified universal installation APK from the same AAB: ${name}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    if (command === "inputs") prepareInputs();
    else if (command === "check-signing") requireSigningSecrets();
    else if (command === "signing") prepareSigning();
    else if (command === "verify") verifyBundle();
    else if (command === "apk") buildInstallApk();
    else throw new Error("Expected inputs, check-signing, signing, verify or apk command");
  } catch (error) {
    console.error(`Play AAB preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

# GitHub Actions Play AAB build

`Android signed Play AAB` builds a signed Android App Bundle without Expo login or an Expo token. It uses the existing Google Play upload key. It does not upload to Play, deploy Firebase, create a signing key, or fall back to a debug key.

## Repository configuration

In Settings → Secrets and variables → Actions, configure these repository **secrets** using the existing release configuration. Do not put their values in source files, issues, pull requests, or build logs.

| Secret | Existing value to use |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the existing Play upload keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Existing keystore password |
| `ANDROID_KEY_ALIAS` | Existing upload key alias |
| `ANDROID_KEY_PASSWORD` | Existing upload key password |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Production Firebase client configuration |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production Firebase client configuration |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Production Firebase project from the source `.firebaserc` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | That project's Storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Production Firebase client configuration |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Production Firebase client configuration |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Existing Android Google sign-in OAuth client |

The `EXPO_PUBLIC_` settings are client configuration embedded in the app. They are stored as Actions secrets here so their values are masked in workflow logs. They are not Firebase service-account credentials. `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` are not required by the current Android sign-in path. Existing AdMob app, banner, and interstitial IDs come from `app.json`; the preflight rejects missing or Google sample IDs.

Configure repository **variable** `ANDROID_UPLOAD_CERT_SHA256` with the SHA-256 fingerprint under Play Console → App integrity → **Upload key certificate**. Use the upload certificate, not the separate app signing certificate. Colons and whitespace are accepted. The keystore certificate must match this fingerprint and be currently valid. An Android Debug certificate is rejected even if its fingerprint matches the variable.

No new keystore should be generated to fill a missing secret. Recover the existing upload key through its established owner/backup instead. This workflow cannot safely build a Play upload candidate until all required settings exist.

## Manual run

GitHub requires the workflow file to be present on the repository's default branch before the Run workflow UI is available. Merge the workflow/tool/test/documentation change into `main` first. A workflow-only integration does not require merging the product source branches: the workflow checks out build tools at its own immutable workflow commit and app source separately at `source_sha`.

Open Actions → Android signed Play AAB → Run workflow. Select the reviewed workflow branch and enter:

| Input | Rule / current candidate |
| --- | --- |
| `source_sha` | Full 40-character reviewed commit SHA; current ad-removal-sales candidate: `9103b26b94e19f40c2302873e2dd0d4c39c9db25` |
| `last_play_version_code` | Highest versionCode currently uploaded across every Play track; last confirmed floor is `26092622`, not a promise that it remains the latest |
| `version_code` | Unused positive integer greater than that Play maximum, at most `2100000000` |
| `version_name` | Three numeric parts; default `1.0.32` distinguishes this build from the older `1.0.30` bundle / `1.0.31` release label |

The workflow rejects refs such as `main` for `source_sha`, checks the actual checkout SHA, and passes inputs through environment variables rather than shell interpolation. It applies `version_name` to the build checkout's Expo/package metadata and applies `version_code` to the generated Android Gradle file. These build overrides do not change the repository or EAS remote version state and are recorded in the provenance file.

## Verification and output

The build performs clean Expo prebuild, release source verification, TypeScript, lint and app tests before introducing the upload key. Production Firebase and Android sign-in settings must be present and internally consistent. The resulting embedded JavaScript/Hermes bundle must contain each required configuration value; the checks never print those values.

Release signing is injected into the generated Gradle project using environment references only. R8 minification and resource shrinking are enabled. No architecture override is applied, preserving the source project's normal release architectures, and ARM64 libraries must be present.

Official `google/bundletool` version `1.18.3` is downloaded from its release URL and checked against SHA-256 `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29` before execution. `bundletool validate` and `dump manifest` verify the actual AAB structure and manifest. The JDK verifier reads every payload entry to completion, rejects unsigned/tampered entries or another signer, checks the upload certificate and validity, and rejects a debuggable/test-only manifest. The package, versionCode, versionName, embedded JS, native libraries and nonempty R8 mapping must match.

Only after all checks pass is artifact `body-frame-play-aab-<versionCode>-<runId>` uploaded, retained for 14 days. It contains:

- `BodyFrame-<versionName>-<versionCode>.aab`
- `mapping.txt`
- `AndroidManifest.xml` dumped from that AAB
- `SHA256SUMS`
- `build-provenance.json`: source/workflow commits, run, version overrides, public certificate fingerprint and output hashes; no environment values or signing credentials

The temporary keystore is removed on success and failure and is never an artifact. Regression tests use disposable, clearly named test-only certificates in temporary directories; those keys are deleted and cannot be selected by the production signing path.

A successful build proves configuration inclusion and artifact integrity. It does not prove production Functions/Rules deployment, Publisher API/RTDN access, Google sign-in OAuth certificate registration, purchase/refund/restore success, AdMob approval, or physical-device behavior. Validate those using the exact Play-installed candidate and the release checklist.

## Implementation checks

- Input, version, configuration and signing preparation tests: `node --test tests/play-aab-build.test.mjs`
- Real signed/unsigned/tampered fixture verification: `node --test tests/play-aab-signature.test.mjs` (JDK 17+ and `keytool`)
- Final repository CI: Quality and Secret Scan on the workflow PR
- Signed production build: remains blocked until the existing key and configuration are supplied; never replace that check with a QA APK

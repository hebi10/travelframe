# Body Frame Stage 8 Release Readiness Design

## Goal
Make the Body Frame Android repository release-ready by removing the known generated-Android CI baseline failures, preserving full secret-history scanning with exact legacy suppressions, adding deterministic release checks, and separating generated release artwork from Firebase.

## Release asset ownership
Body Frame release artwork is **not** a Firebase asset.

- App icon / adaptive icon / splash: source-controlled app bundle assets referenced by Expo app config.
- Google Play app icon / feature graphic / screenshots: uploaded directly to Google Play Console.
- Firebase Hosting/Storage is not required for those release images.
- Generated candidate artwork is stored externally in Google Drive for manual review/application before release.

The Stage 8 source branch does not replace launcher/splash binaries automatically because final visual approval is still manual.

## Android generated project
The repository intentionally ignores `android/`; native Android is generated with Expo prebuild.

CI must therefore generate Android before:
- tests that inspect generated `android/app/proguard-rules.pro`
- Kotlin compilation verification
- release-manifest verification

Add one cross-platform script:
- `npm run android:prebuild:ci`
- internally runs Expo prebuild for Android without package installation

The existing config plugin owns generated release requirements so every clean prebuild creates the same Android project.

## R8 / ProGuard
The Expo config plugin must append deterministic release keep rules to generated `android/app/proguard-rules.pro`:
- Nitro camera
- Nitro image
- VisionCamera
- Google Mobile Ads

The helper must be idempotent.

## Secret scan
Keep Gitleaks history scanning enabled.

Do not weaken the history workflow to current-tree-only scanning. Instead add exact fingerprint entries to `.gitleaksignore` for the already-known historical `firebase-debug.log` findings. New secrets and any different historical finding must still fail CI.

## Release verification
Add `npm run release:verify` to verify source-level release invariants:
- app display name: 바디 프레임
- Android package remains `com.haebi.photoguide`
- production EAS profile exists with autoIncrement
- Google Play Billing product IDs remain fixed
- required public privacy/delete pages exist
- release asset manifest exists
- app icon/adaptive/splash paths in app.json resolve to files
- generated artwork is documented as manual-review assets, not Firebase uploads

This is source-level verification. A signed production AAB still requires EAS/keystore/Play configuration.

## CI
Quality workflow:
1. npm ci
2. typecheck
3. lint
4. clean Android prebuild
5. test
6. current-tree secret scan
7. release verification

Android Windows workflow:
1. npm ci
2. clean Android prebuild
3. Kotlin verify
4. release manifest verify

Functions and Firebase Rules remain unchanged.

## Real release prerequisites
Source completion does not prove a store release. Final external steps remain:
- approve/copy Drive artwork into repository / Play Console
- configure Google Play products/base plans/offers
- configure Android Publisher API + RTDN
- deploy Functions/Rules
- build signed AAB through EAS production
- Play internal/closed testing
- physical Android visual/camera/video/purchase/restore/upgrade/refund QA

# Body Frame Stage 8 Release Readiness Design

## Goal
Complete the source-level release path after Body Frame product Stage 1–7 and UI Finalize Stage 1–7.

## Deterministic Android generation
The repository does not commit `android/`. CI and release checks must therefore run a clean Expo Android prebuild before any test or Gradle task that reads generated Android files.

`npm run android:prebuild:ci` must:
1. run clean Android prebuild,
2. let the Expo config plugin generate Body Frame native sources and R8 rules,
3. reapply local node_modules compatibility patches.

## Native compatibility
The local patch layer owns three required compatibility fixes:
- VisionCamera shutter-sound override,
- React Native Gradle plugin Foojay resolver `0.5.0 → 1.0.0` for the generated Gradle 9 project,
- Google Mobile Ads Expo config compatibility.

The patch script must be idempotent and rerun after prebuild.

## Generated release policy
The Expo Android config plugin owns:
- optional camera/microphone hardware features,
- removal of unwanted generated release permissions,
- generated Android image adjustment package/module,
- required R8 keep rules for Nitro camera/image, VisionCamera and Google Mobile Ads.

## Secret history
Full-history Gitleaks remains enabled. Only the four exact historical `firebase-debug.log` fingerprints are ignored. New findings still fail CI.

## Release source verification
`npm run release:verify` checks:
- display name `바디 프레임`,
- package `com.haebi.photoguide`,
- EAS production autoIncrement,
- approved icon paths and adaptive background,
- public privacy/delete files,
- billing IDs,
- release docs and exact secret baseline.

## Approved artwork
BF monogram v2 app icon and adaptive foreground were applied during UI Finalize Stage 7. The approved v2 package does not include a dedicated splash final, so the existing splash remains intentionally unchanged.

Release/store artwork is not uploaded to Firebase. Play listing graphics go directly to Google Play Console.

## External release prerequisites
Source CI completion does not prove a production store release. Remaining external steps include Google Play billing configuration, Android Publisher API/RTDN, Functions/Rules deployment, signed EAS AAB, Play internal/closed testing and physical Android QA.

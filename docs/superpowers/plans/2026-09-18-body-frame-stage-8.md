# Body Frame Stage 8 Implementation Plan

**Goal:** Remove known release-readiness CI blockers and create a deterministic source-level release verification path while keeping generated artwork outside Firebase.

## Task 1 — RED contract
- [ ] Add `tests/07-body-frame-stage-8.test.mjs`.
- [ ] Assert Android prebuild runs before generated-Android tests/verifiers.
- [ ] Assert config plugin generates required R8 rules.
- [ ] Assert exact historical Gitleaks fingerprint suppressions.
- [ ] Assert release verification script/package command.
- [ ] Assert release asset manifest states Firebase is not used for app/store artwork.
- [ ] Open Draft PR and verify RED.

## Task 2 — Deterministic Android prebuild
- [ ] Add cross-platform `scripts/prebuild-android-ci.mjs`.
- [ ] Add `android:prebuild:ci` npm script.
- [ ] Run it in Quality before `npm test`.
- [ ] Run it in Windows Android verification before Kotlin/manifest checks.

## Task 3 — Generated R8 rules
- [ ] Extend Expo Android config plugin to write/append required ProGuard rules.
- [ ] Keep operation idempotent.
- [ ] Preserve existing native image adjustment and manifest mods.

## Task 4 — Historical secret baseline
- [ ] Add `.gitleaksignore` for only the four known old `firebase-debug.log` fingerprints.
- [ ] Keep full history scan enabled.

## Task 5 — Release verification
- [ ] Add `scripts/verify-release-readiness.mjs`.
- [ ] Add `release:verify` npm script.
- [ ] Verify brand/package/EAS/billing/public policy/asset manifest/app image paths.

## Task 6 — Release artwork handoff
- [ ] Add `docs/release-assets/README.md` with exact repo/Play Console destinations.
- [ ] State app/store release images are not Firebase uploads.
- [ ] Record Google Drive folder for generated candidate artwork.
- [ ] Do not automatically replace approved app icon binaries.

## Task 7 — Verification
- [ ] Typecheck PASS.
- [ ] Lint PASS.
- [ ] Stage 1–8 contracts PASS.
- [ ] Full `npm test` proceeds past the former proguard baseline.
- [ ] Functions PASS.
- [ ] Firebase Rules PASS.
- [ ] Secret Scan history PASS after exact legacy ignores.
- [ ] Android clean-prebuild Kotlin/manifest verification PASS or document any new root cause discovered after prebuild.
- [ ] Release verification PASS.
- [ ] Keep PR against main until merge requested.

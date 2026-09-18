# Body Frame Stage 8 Final Implementation Plan

## 1. Clean Android CI
- [x] Add `android:prebuild:ci`.
- [x] Run clean prebuild before generated-Android tests.
- [x] Run clean prebuild before Windows Kotlin/manifest verification.
- [x] Reapply node_modules patches after prebuild.

## 2. Generated release policy
- [x] Generate required R8 keep rules from Expo config plugin.
- [x] Remove unwanted generated release permissions.
- [x] Keep native image adjustment generation deterministic.

## 3. Compatibility blockers
- [x] Patch React Native Gradle Foojay resolver to 1.0.0.
- [x] Harden VisionCamera shutter-sound patch.
- [x] Reapply patches in local AAB flow after prebuild.
- [x] Fix image-backup test data-URL alias for `@/constants/body-frame`.
- [x] Update onboarding regression test to the final Stage 6 UX.

## 4. Secret history
- [x] Keep full-history scan.
- [x] Ignore only four exact historical `firebase-debug.log` fingerprints.

## 5. Release verification
- [x] Add `release:verify`.
- [x] Verify brand/package/EAS/billing/policy/assets.
- [x] Record approved BF v2 artwork status.
- [x] Add final release checklist.

## 6. Final CI
- [ ] clean prebuild PASS
- [ ] release:verify PASS
- [ ] typecheck PASS
- [ ] lint PASS
- [ ] full npm test PASS
- [ ] Functions PASS
- [ ] Firebase Rules PASS
- [ ] Secret Scan history PASS
- [ ] Android Kotlin PASS
- [ ] release manifest PASS

## 7. After source CI
- [ ] signed EAS production AAB
- [ ] Play internal/closed track
- [ ] physical Android QA
- [ ] Google Play Billing / Publisher API / RTDN configuration and E2E

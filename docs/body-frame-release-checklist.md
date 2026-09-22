# Body Frame Release Checklist

## Source / UI
- [x] Body Frame product Stage 1–7 merged.
- [x] UI Finalize Stage 1–7 merged.
- [x] BF monogram v2 app icon applied.
- [x] BF adaptive foreground v2 applied.
- [x] Android adaptive background is `#151719`.
- [x] Final Android manual QA checklist updated.
- [x] Android generated project is produced by clean Expo prebuild in CI.
- [x] Required generated R8 keep rules are owned by the Expo config plugin.
- [x] Release source verifier checks brand, package, EAS, billing, policy and assets.
- [x] Pose alignment plugin generates bundled ML Kit Pose Detection and no extra runtime permission.
- [x] Pose alignment privacy disclosure states on-device temporary processing with no server upload.
- [x] Gitleaks full-history scan uses exact legacy fingerprint suppressions only.
- [x] Stage 8 final merged after green CI.
- [x] Firebase Functions runtime upgraded to Node.js 22 with deploy-time dependency install.

## Stage 8 CI
- [x] `npm run android:prebuild:ci` PASS.
- [x] `npm run release:verify` PASS.
- [x] TypeScript PASS.
- [x] Expo lint PASS.
- [x] Full `npm test` PASS.
- [x] Functions PASS.
- [x] Firebase Rules PASS.
- [x] Secret Scan history PASS.
- [x] Android Kotlin PASS.
- [x] Android release manifest PASS.

## Google Play Billing / external configuration
- [ ] Create/activate `ad_remove`.
- [ ] Create/activate `creator_monthly` subscription/base plan/offer.
- [ ] Create/activate `expert_monthly` subscription/base plan/offer.
- [ ] Grant Firebase Functions runtime identity Android Publisher API / Play Console access.
- [ ] Configure RTDN Pub/Sub topic `google-play-billing`.
- [ ] Deploy Functions and Firestore Rules.
- [ ] Verify new purchase.
- [ ] Verify purchase restore.
- [ ] Verify Pro → Expert replacement.
- [ ] Verify renewal.
- [ ] Verify cancellation then access until expiry.
- [ ] Verify expiry.
- [ ] Verify refund/revocation.

## Health Connect / health data
- [x] Source requests read-only Weight and Body Fat permissions only.
- [x] No background access or extended-history permission in Stage 9-7.
- [x] Health Connect import remains user-initiated and Local Only after import.
- [ ] Deploy the updated public privacy policy before submitting the Health Connect build.
- [ ] Complete and submit the Google Play Health apps declaration as `Health and fitness → Activity and fitness`.
- [ ] Declare Health Connect `READ_WEIGHT` and `READ_BODY_FAT` using the purpose text in `docs/google-play-health-declaration.md`.
- [ ] Update Play Data Safety answers for health and fitness data based on the production build.
- [ ] Ensure the public store listing mentions optional Health Connect Weight / Body Fat import.
- [ ] Confirm generated release manifest contains READ_WEIGHT / READ_BODY_FAT only.
- [ ] Verify permission denial, revoke, provider-update-required, and no-data states on a physical Android device.
- [ ] Verify duplicate Health Connect records are not imported twice.

## Production build
- [ ] Confirm EAS Android credentials / upload key.
- [ ] Run `npm run release:verify`.
- [ ] Run production EAS AAB build.
- [ ] Retain R8 mapping file / native debug symbols where applicable.
- [ ] Upload AAB to Play internal or closed test track.
- [ ] Review Play pre-launch report.

## Physical Android QA
Use `docs/manual-device-qa.md`.

- [ ] Fresh install and first-run Body Frame welcome.
- [ ] Create project and save first photo.
- [ ] Second photo reference overlay.
- [ ] first/latest reference modes.
- [ ] Project switching.
- [ ] Free 100th photo allowed / 101st blocked.
- [ ] Pro 365-photo behavior.
- [ ] Archive and restore project.
- [ ] 0.1s/photo progress video.
- [ ] Free 10-second and Pro 36.5-second limits.
- [ ] Cloud backup/restore on eligible plan.
- [ ] Google Play purchase/restore/upgrade/refund.
- [ ] Small-screen / large-font / Safe Area / foldable checks.
- [ ] Dark and light appearance.
- [ ] Pose alignment OFF leaves the existing camera flow unchanged.
- [ ] Pose alignment ON shows low-frequency position guidance after a reference photo exists.
- [ ] Pose analysis failure falls back without blocking capture.
- [ ] Pose preview snapshots are temporary and not stored/uploaded.
- [ ] No legacy TravelFrame wording in the primary Body Frame flow.

## Store listing / policy
- [ ] App name: 바디 프레임.
- [ ] Package ID remains `com.haebi.photoguide`.
- [ ] Play app icon uses approved BF v2 artwork.
- [ ] Feature graphic uploaded directly to Google Play Console.
- [ ] Final phone screenshots uploaded directly to Google Play Console.
- [ ] Privacy URL opens the current Body Frame policy.
- [ ] Account deletion URL opens the current Body Frame instructions.
- [ ] Data Safety answers match actual Firebase/AdMob/Billing/Health Connect behavior.
- [ ] Advertising ID declaration matches AdMob usage.
- [ ] Permission declarations match generated release manifest, including Health Connect read permissions.

Release/store artwork is not uploaded to Firebase.

# Body Frame Release Checklist

## Source / UI
- [x] Body Frame product Stage 1–7 merged.
- [x] UI Finalize Stage 1–7 merged.
- [x] BF monogram v2 app icon applied.
- [x] BF adaptive foreground v2 applied.
- [x] Android adaptive background is `#0B0B0C`.
- [x] Final Android manual QA checklist updated.
- [x] Android generated project is produced by clean Expo prebuild in CI.
- [x] Required generated R8 keep rules are owned by the Expo config plugin.
- [x] Release source verifier checks brand, package, EAS, billing, policy and assets.
- [x] Gitleaks full-history scan uses exact legacy fingerprint suppressions only.
- [ ] Merge final Stage 8 after CI is green.

## Stage 8 CI
- [ ] `npm run android:prebuild:ci` PASS.
- [ ] `npm run release:verify` PASS.
- [ ] TypeScript PASS.
- [ ] Expo lint PASS.
- [ ] Full `npm test` PASS.
- [ ] Functions PASS.
- [ ] Firebase Rules PASS.
- [ ] Secret Scan history PASS.
- [ ] Android Kotlin PASS.
- [ ] Android release manifest PASS.

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
- [ ] No legacy TravelFrame wording in the primary Body Frame flow.

## Store listing / policy
- [ ] App name: 바디 프레임.
- [ ] Package ID remains `com.haebi.photoguide`.
- [ ] Play app icon uses approved BF v2 artwork.
- [ ] Feature graphic uploaded directly to Google Play Console.
- [ ] Final phone screenshots uploaded directly to Google Play Console.
- [ ] Privacy URL opens the current Body Frame policy.
- [ ] Account deletion URL opens the current Body Frame instructions.
- [ ] Data Safety answers match actual Firebase/AdMob/Billing behavior.
- [ ] Advertising ID declaration matches AdMob usage.
- [ ] Permission declarations match generated release manifest.

Release/store artwork is not uploaded to Firebase.

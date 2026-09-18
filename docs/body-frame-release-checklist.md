# Body Frame Release Checklist

## Source / CI
- [x] Body Frame 1–7 product stages merged to main before Stage 8.
- [x] Android is generated from clean Expo prebuild in CI.
- [x] Required generated R8 keep rules are owned by Expo config plugin.
- [x] Release source verifier checks app name, package, billing IDs, public policy files and app asset paths.
- [x] Gitleaks full history scan remains enabled with exact legacy fingerprint suppressions only.
- [ ] Merge Stage 8 after final CI is green.

## Release artwork
Candidate artwork folder:
https://drive.google.com/drive/folders/1gEl1UkYS79iD8rM_0-Dh5giJDJmmWdTg

- [ ] Approve app icon candidate.
- [ ] Copy approved icon to `assets/icons/app-icon.png`.
- [ ] Copy approved adaptive foreground to `assets/icons/adaptive-icon.png` (or adjust app.json if a new filename is used).
- [ ] Approve/copy splash artwork to `assets/icons/splash-icon.png`.
- [ ] Run `npm run android:prebuild:ci` and `npm run release:verify` again after asset replacement.
- [ ] Upload 1024×500 feature graphic directly to Google Play Console.
- [ ] Capture final in-app 1080×1920 screenshots and apply the provided store template.
- [ ] Upload screenshots directly to Google Play Console.

Release artwork is not uploaded to Firebase.

## Google Play Billing
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
- [ ] Fresh install and first-run Body Frame onboarding.
- [ ] Create 100-day project.
- [ ] First photo with no reference overlay.
- [ ] Second photo with latest reference overlay.
- [ ] First-photo reference mode.
- [ ] Project switching.
- [ ] Free 100th photo allowed / 101st blocked.
- [ ] Pro 365-photo behavior.
- [ ] Archive and restore project.
- [ ] 0.1s/photo progress video.
- [ ] Free 10-second and Pro 36.5-second limits.
- [ ] Local media save permissions.
- [ ] Cloud backup/restore on eligible plan.
- [ ] Google Play purchase/restore/upgrade/refund.
- [ ] Camera controls do not overlap bottom navigation.
- [ ] Dark and light appearance.
- [ ] No TravelFrame/travel wording in primary Body Frame flow.

## Store listing / policy
- [ ] App name: 바디 프레임.
- [ ] Package ID remains `com.haebi.photoguide`.
- [ ] Privacy URL opens current Body Frame policy.
- [ ] Account deletion URL opens current Body Frame instructions.
- [ ] Data Safety answers match actual Firebase/AdMob/Billing behavior.
- [ ] Advertising ID declaration matches AdMob usage.
- [ ] Permission declarations match generated release manifest.

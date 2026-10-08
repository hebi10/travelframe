# Body Frame Release Checklist

2026-10-01: plan limits below follow `lib/plan-entitlements.ts`. Existing checked Stage 8 items record prior work, not certification of a later release. Re-run CI on the exact release commit. Source/CI tests do not certify Play Console configuration, production deployment, a signed AAB, or physical-device behavior. See `docs/release-ad-billing-qa.md` for the release regression matrix.

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

## Stage 8 CI (historical)
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
- [x] Create/activate `creator_monthly` Pro subscription/base plan.
- [x] Create/activate `plus_monthly` Plus subscription/base plan.
- [x] Create/activate `expert_monthly` Expert subscription/base plan.
- [ ] Reconfirm all four products and their actual store prices in the release track.
- [ ] Grant Firebase Functions runtime identity Android Publisher API / Play Console access.
- [ ] Configure RTDN Pub/Sub topic `body-frame-play-billing`.
- [ ] Deploy Functions and Firestore Rules.
- [ ] Verify new purchase.
- [ ] Verify purchase restore after reinstall with the original app account.
- [ ] Verify all six Pro ↔ Plus ↔ Expert replacements using WITH_TIME_PRORATION. Access changes immediately; remaining value becomes time credit. This is not a deferred downgrade.
- [ ] Verify declining the plan-change confirmation does not open billing or report purchase success.
- [ ] Verify renewal.
- [ ] Verify cancellation then access until expiry.
- [ ] Verify expiry, including separately owned permanent ad removal.
- [ ] Verify refund/revocation, RTDN delivery, and refreshed app entitlement.

## AdMob / consent
- [x] `admin/app-ads.txt` prepared in the Hosting public root using the publisher ID in `app.json` (source artifact only; not deployed/verified).
- [ ] Confirm the account's personalized seller entry in AdMob and the developer website domain recorded in Google Play before deploying or claiming app-ads.txt verification.
- [ ] Confirm AdMob app/store linkage, app readiness, account verification and app-ads.txt verification.
- [ ] Configure the required Privacy & messaging messages for the actual distribution regions.
- [ ] Verify UMP required/not-required/declined/error states on a development build using registered test devices.
- [ ] Verify no ad request before purchase state and SDK consent are available.
- [ ] Verify paid users and guests do not request banner or interstitial ads.
- [ ] Verify Settings → 광고 개인정보 설정 is available when the SDK requires a privacy entry point.
- [ ] Verify changing privacy options blocks requests while the form is open and uses the resulting SDK state.
- [ ] Verify the release manifest delays app measurement and generated R8 rules retain UMP classes.
- [ ] Verify the current Body Frame video save path displays test ads only after successful album and local-library saves.
- [ ] Verify loading failure, three-second load timeout, backgrounding, navigation and another export never corrupt saved videos or show a stale ad.
- [ ] Verify only one interstitial is active and displays are at least two minutes apart within the same app session.
- [ ] Never click live ads during development; development mode uses test units.

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
- [ ] Confirm no body measurements, Health Connect data, photos or project names are supplied to ad requests.

## Production build
- [ ] Confirm EAS Android credentials / upload key.
- [ ] Run `npm run release:verify` and the complete current-commit CI checks.
- [ ] Triage npm audit warnings before release. The 2026-10-01 CI installation reported 7 vulnerabilities (3 moderate, 4 high); dependency updates were not included in the ad/billing fix. Do not run a forced breaking upgrade without impact analysis.
- [ ] Run production EAS AAB build after the native consent configuration changes. A JavaScript-only update is not sufficient.
- [ ] Retain R8 mapping file / native debug symbols where applicable.
- [ ] Upload AAB to Play internal or closed test track.
- [ ] Review Play pre-launch report and test an ARM64 device.

## Physical Android QA
Use `docs/manual-device-qa.md` together with the current policy below.

- [ ] Fresh install and first-run Body Frame welcome.
- [ ] Create project and save first photo.
- [ ] Second photo reference overlay.
- [ ] first/latest reference modes.
- [ ] Project switching.
- [ ] Guest/Free: maximum 1 active project; the 100th photo is allowed and the 101st is blocked per project.
- [ ] Ad Remove: maximum 2 active projects; the 100th photo is allowed and the 101st is blocked per project.
- [ ] Pro/Plus/Expert: no project-count limit; up to 365 photos per project under the current plan policy.
- [ ] Cloud project slots: Pro 1 / Plus 3 / Expert 5.
- [ ] Each selected cloud project accepts 365 photos and blocks the 366th.
- [ ] Backup project replacement deletes old cloud project data but keeps local originals.
- [ ] Archive and restore project.
- [ ] Progress video defaults to 0.1s/photo, while the selected interval determines actual duration.
- [ ] No fixed 10-second/36.5-second plan cap: current maxProgressVideoSeconds is null. Validate photo-count × selected interval and the device output result.
- [ ] Guest exports are limited to once per week; logged-in exports have no weekly count limit. Local saved-video capacity still applies.
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

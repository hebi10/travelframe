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
- [ ] Confirm `ad_remove` is no longer offered for new purchases, while existing permanent ad-removal purchases still verify and restore.
- [x] Create/activate `creator_monthly` Pro subscription/base plan.
- [x] Create/activate `plus_monthly` Plus subscription/base plan.
- [x] Create/activate `expert_monthly` Expert subscription/base plan.
- [ ] Reconfirm the three monthly subscriptions and their actual store prices in the release track.
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

## Stage 15 — 현재 출시 판정 (2026-11-06 KST)

- [x] Stage 14 `main@cdad09e74f8f116f141ff8149c1e6bbd2e23e1d0` Quality/Secret Scan 성공. Stage 14 x86_64 Android QA/기능 smoke 및 232개 실제 스크린샷 검증 성공. 테스트 APK는 Play 서명된 AAB가 아님.
- [x] `2026-11-07 11:01 KST` 새 업로드 키 게시 시간 게이트·승인 조건을 소스 테스트로 검증. 게시 승인 스위치를 Stage 15에서 변경하지 않음.
- [x] 2026-11-06 무게시 preflight에서 저장된 키스토어/개인키 및 기존 Play 릴리스 목록 조회 성공. Play Console 업로드 인증서의 외부 SHA-256 지문 대조는 아직 별도 필요.
- [ ] Stage 15 후보 PR의 전체 CI/별도 Dependency Audit 보고서 확인 및 패키지별 영향 분석.
- [ ] **Play Console 업로드 인증서 ↔ 등록된 인증서 SHA-256 ↔ 보유 업로드 키** 3자 대조 완료.
- [ ] 현재 전체 Play 트랙 및 `versionCode` 재조회, 보호 상태 릴리스 확인. 운영/공개 트랙 자동 게시 금지.
- [ ] signed ARM64 release AAB와 R8 mapping을 실제 검사하고 서명된 설치 아티팩트를 보존.
- [ ] ARM64 실기기 촬영/사진 저장/전후 비교/수치/포즈/MP4 저장·재편집·백그라운드/복구 수동 검수.
- [ ] Google Play 테스트 결제/복원·6개 구독 변경·취소/환불·RTDN 및 서버 권한 검증.
- [ ] 프로덕션 Firebase/Storage/AdMob UMP·Privacy/Health Connect/Data Safety/스토어 정책 검증.
- [ ] 실제 테스트 트랙 배포 후 Play pre-launch report/기기 설치·테스트 계정 QA 확인.

Stage 15 상세 분리표와 자동 회귀 범위: `docs/design/body-frame-stage15-release-readiness-20261106.md`. 코드 CI 성공만으로 출시 승인하지 않으며, 결제 토큰·인증값·실사용자 사진을 공개 CI에 기록하지 않는다.

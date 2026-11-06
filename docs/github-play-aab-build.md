# GitHub Actions Play test releases

## Stage 9: preflight before enabling automatic Play publishing

The separate **Body Frame Play release preflight (no publish)** manual workflow on `main` checks the configured upload keystore certificate and (if supplied) the *Upload key certificate* SHA-256 copied from Play Console. It can also inspect current Play tracks/bundles/APKs through a temporary Publisher edit that is deleted without committing, uploading or changing a track.

Select `certificate`, `inventory` or `both`. The optional SHA-256 is the **upload certificate**, not the *app signing* certificate. If it is omitted, only the local keystore and configured pin are compared; this is **not** proof of equality with the current Play Console upload key.

In addition to the existing approval variable, the publishing CLI refuses `publish` before **2026-11-07 11:01 Asia/Seoul** (2026-11-07 02:01 UTC), including if the variable is accidentally enabled early. Inventory-only queries are not time blocked. Approval, keystore updates, AAB upload and Play track publication are separate from preflight.

See [Stage 9 runbook](design/body-frame-stage9-play-preflight-20261105.md) for sign-in, evidence, and the remaining manual certificate/ARM64/install steps.


> **출시 승인 보류 (2026-11-05)**  
> 앱 업로드 인증서와 GitHub Actions의 서명키 일치 여부 및 Google Play 최신 릴리스 재검증 전에는 게시하지 않습니다. `main` 푸시는 자동으로 Play를 게시하지 않으며, 저장소 변수 `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107`가 정확히 `true`일 때만 테스트 게시를 허용합니다. 2026-11-07 이후에 서명키 복구와 검증을 마친 뒤 이 변수를 활성화해야 합니다. 지금은 **활성화하지 마세요**. 읽기 전용 `inventory` 호출은 별도로 허용됩니다.
>
> Stage 8 소스의 표시버전 후보는 `1.0.32`이며 `app.json`, `package.json`, `package-lock.json` 루트의 3곳(잠금파일 내부 루트 포함 총 4개 필드)과 일치합니다. **현재 Google Play 실제 버전을 재조회하지 않았으므로 업로드 가능 버전을 확정한 것은 아닙니다.** 실제 `versionCode`는 게시 전 API 전체 트랙·미할당 AAB/APK 인벤토리의 최댓값보다 높은 미사용 값으로 계획합니다.
>
> 새 게시 안전 조건: Play 대상 테스트 트랙에 내용이 남은 draft, inProgress/halted, 알 수 없는 릴리스가 있으면 계획·업로드 이전에 중단하고 기존 작업물을 보존합니다. 수동 소스 지정은 해당 실행의 `main` 커밋 또는 조상 커밋이어야 하며, 체크아웃 SHA를 확인합니다. 실제 인증서와 서명키 검증은 이 소스 검증의 대체 항목이 아닙니다.


`Android Play test release` builds a signed AAB and an installation APK, then uploads **only the AAB** and R8 mapping to Google Play. The package is fixed to `com.haebi.photoguide`. The default audience is internal testing; a manual run can select the existing closed `alpha` track. Production, custom tracks and other apps cannot be selected.

## Trigger and source

Every push to `main` runs the pipeline using that push's exact commit SHA. This fits the repository's existing main/pull-request Quality checks and does not depend on a separate tag or release process. The build also runs release verification, TypeScript, lint and the app tests itself before signing. There is no release/tag trigger that could duplicate the push deployment. Keep reviewed product changes on `main` before relying on automatic internal releases.

Manual runs must select `main` as the workflow branch. Inputs are passed through environment variables and validated:

| Input | Behavior |
| --- | --- |
| `operation` | Default `publish`; `inventory` reads current version/track metadata without signing, uploading or committing |
| `track` | Default `internal`; `closed` selects only the existing `alpha` API track |
| `source_sha` | Optional full 40-character reviewed commit; empty uses the exact main commit associated with this run |
| `version_code` | Optional positive integer above every API-observed version; empty uses maximum + 1, at most `2100000000` |
| `version_name` | Manual default `1.0.32`; empty uses the source's `app.json` version |

Automatic pushes use the source's `app.json` versionName. A manual `1.0.32` override works even when the source is `1.0.30`: only the build checkout's Expo/package version and generated Gradle version metadata change. The repository and EAS version state are untouched. The versionCode is always allocated from Play, independently of the display versionName. If a new display version is desired for every automatic push, update the normal app version in the reviewed source change.

Tools are checked out at the immutable workflow commit, separately from app source. Only this repository's `main` workflow can release. Forks, pull-request events and non-main workflow branches cannot publish. A single concurrency group serializes planning, building and publishing; if an external Console/API upload races the build, the final version guard fails and requires a fresh build.

## Existing signing and app configuration

Configure these repository **secrets** using the existing release configuration. Never put values in code, issues, pull requests or logs.

| Secret | Existing value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the existing Play upload keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Existing keystore password |
| `ANDROID_KEY_ALIAS` | Existing upload alias |
| `ANDROID_KEY_PASSWORD` | Existing key password |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Production Firebase client configuration |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Production Firebase client configuration |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Source `.firebaserc` project |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | That project's Storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Production Firebase client configuration |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Production Firebase client configuration |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Existing Android sign-in OAuth client |

Client configuration is embedded in the app; Actions secrets mask it in logs. It is not a Firebase service-account key. The Android path does not require `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` or `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Production AdMob app/banner/interstitial IDs come from the source `app.json`; missing/sample IDs fail preflight. Firebase project/bucket/sender consistency is checked and every required client value must appear in the built JavaScript/Hermes bundle, without printing values.

Configure repository **variables**:

| Variable | Required value |
| --- | --- |
| `ANDROID_UPLOAD_CERT_SHA256` | Play Console → App integrity → **Upload key certificate** SHA-256; not the app signing certificate |
| `PLAY_WORKLOAD_IDENTITY_PROVIDER` | Existing WIF provider resource `projects/NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
| `PLAY_SERVICE_ACCOUNT` | App-specific release service-account email |
| `PLAY_INTERNAL_TRACK` | Explicitly confirmed API name `internal` or `qa`; no implicit alias fallback |

Before requesting a Play token or starting an Android build, publish runs open the configured keystore, verify its certificate and check private-key access. The certificate must match the configured public fingerprint, be currently valid and not be Android Debug. Read-only inventory runs do not require signing material.

## Keyless Play authentication

Use Google Workload Identity Federation with the existing app-specific service account. `google-github-actions/auth` is pinned to the reviewed v3 commit and mints a short-lived access token with only the `androidpublisher` OAuth scope. No long-lived JSON credential fallback or Expo token is used.

The release GCP project (`hebi-app-release-80847404`) and service account (`play-bodyframe@hebi-app-release-80847404.iam.gserviceaccount.com`) are separate from the app's Firebase backend project (`travelframe-4e1fb`). This workflow does not create or modify Cloud projects, IAM bindings, providers, Firebase resources, OAuth clients or Play users. An existing account/project alone does not prove WIF or Play permissions are ready.

The configured WIF trust must restrict the immutable GitHub repository identity, `refs/heads/main` and this workflow. Give the service account access only to this app and the Play permissions needed to view app/release information and release to testing tracks; production/account-wide permissions are unnecessary. Enable the required existing Publisher/IAM credentials services through the account owner. Authentication configuration and Play grants must be verified before the first real run.

OIDC is available only in the `plan` and `publish` jobs. They execute trusted workflow scripts without installing/running app dependencies. The npm/Expo/Gradle `build` job has no OIDC permission or Play access token. Fresh Play authentication occurs after download verification, avoiding token expiry during a long build. Auth creates no credentials file and exports no Google SDK environment credentials.

## Play inventory, edit and commit

For initial setup, run manually with `operation=inventory` after WIF/Play access is configured. This mode works without signing secrets or `PLAY_INTERNAL_TRACK`. It creates a temporary edit, lists tracks/bundles/APKs, logs only actual track names and public version/count metadata, then deletes the edit. Build and publish jobs are skipped; no artifact upload, track update, validation or commit is performed. Confirm the actual internal name from this result and set `PLAY_INTERNAL_TRACK` before a publish run. Automatic pushes always force `publish` + `internal`, ignoring manual-mode inputs.

Planning creates a temporary edit and reads `edits.tracks.list`, `edits.bundles.list` and `edits.apks.list`. This includes bundles/APKs returned by the API even when no track references them. The maximum also retains the previously confirmed floor `26092622`; this is a lower bound, not a claim that it remains the latest. The API lists current resources rather than promising an exhaustive lifetime archive, and Play remains the final authority on version reuse. Invalid/incomplete inventory responses fail closed.

The logical internal choice requires `PLAY_INTERNAL_TRACK` to be `internal` or `qa` and that exact name to exist once in `edits.tracks.list`. The closed choice requires exact `alpha` to exist. No track is created and no custom name, form-factor prefix or production alias is guessed.

After independently verifying the downloaded AAB, publishing starts a **new** edit, rechecks all current versions and track mapping, then:

1. Uploads the verified AAB through a resumable session. Only documented Google API hosts and the exact package/edit/bundle upload path are allowed for the session URL; redirects are rejected. A broken transfer fails the run rather than blindly repeating it.
2. Requires the returned versionCode and server SHA-256 to match the local AAB and attaches that version's R8 mapping.
3. Updates only the selected test track to the new version with `completed` status and validates the edit.
4. Commits with `changesInReviewBehavior=ERROR_IF_IN_REVIEW`. Existing review is never automatically cancelled. There is no fallback to draft, production or `changesNotSentForReview`.
5. Opens another temporary edit and reads the committed test track back, requiring the exact version and completed status. Temporary read edits are deleted.

Uncommitted failed edits are discarded when possible. A timeout after commit can leave the outcome uncertain: the receipt distinguishes `commit-outcome-unconfirmed`, `committed-readback-unverified` and `committed-and-read-back`. Only the last state is workflow success. Do not infer tester delivery from upload success alone. Play processing, review or managed publishing may still delay availability.

If only publishing failed, a failed-job rerun downloads the artifact from the **actual successful build attempt**, preserving its provenance. It still performs all verification and version checks with a fresh token. A version already committed by an earlier attempt is rejected, never silently republished. Inspect the receipt/Console before retrying an uncertain commit. A full rerun creates a fresh inventory/build and may allocate a new versionCode.

## Build verification and files

Clean Android prebuild, release verification, TypeScript, lint and app regression tests run before the key is materialized. Release signing references environment variables, with R8/resource shrinking enabled and source architectures preserved. Official bundletool `1.18.3` is SHA-256 pinned to `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`.

The verifier reads every AAB payload entry to completion, validates its JAR signature and exact upload certificate, rejects duplicate/unsigned/tampered content and checks ARM64 native code, embedded production configuration, actual package/version/release manifest and nonempty R8 mapping. The publish job repeats actual AAB, signer, package and manifest checks and binds provenance/hashes to the exact workflow/source/run/build attempt.

A universal APK is generated from that same verified AAB with explicit existing upload-key signing; bundletool's implicit debug signing is never used. Android SDK `apksigner` verifies its signature/certificate and `apkanalyzer` supplies the real manifest for package/version/debug/test-only checks. The APK is for direct installation. **Its upload-key signature can differ from Play's app signing key, so it may not update an existing Play-installed app.** Test store sign-in/billing using the Play-installed build.

GitHub build artifact `body-frame-play-<versionCode>-<runId>-<buildAttempt>` is retained for 14 days and contains:

- `BodyFrame-<versionName>-<versionCode>.aab`
- `BodyFrame-<versionName>-<versionCode>-upload-key.apk`
- `mapping.txt`, actual AAB `AndroidManifest.xml`, `SHA256SUMS`
- `build-provenance.json`: source/workflow/run/build attempt, versions, public certificate, AAB/APK/mapping hashes and configuration **names**, with no environment values or signing credentials

The separate receipt artifact records public package/track/version/hash and commit/readback outcome. The keystore/password files are temporary, permission-restricted, removed on success/failure and excluded from artifacts. No Drive file, backend, product/pricing, listing, tester list, country setting or production track is modified by this pipeline.

## Validation and limits

```bash
node --test tests/play-aab-build.test.mjs tests/play-aab-signature.test.mjs tests/play-publish.test.mjs
```

Signature tests use disposable test-only keys in temporary directories, deleted afterward; they cannot be selected by the production path. Publisher tests use mocked HTTP responses and never authenticate or change Play. Production signing, actual API permission, first upload and physical-device sign-in/billing/ad behavior remain unverified until the real configuration/key and a successful run exist. A green repository Quality run alone does not prove deployment or device QA.

Official references: [Publisher setup](https://developers.google.com/android-publisher/getting_started), [tracks](https://developers.google.com/android-publisher/tracks), [bundle upload](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles/upload), [media sessions](https://developers.google.com/android-publisher/upload), [commit review behavior](https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit), [keyless GitHub auth](https://github.com/google-github-actions/auth), [bundletool](https://developer.android.com/tools/bundletool).

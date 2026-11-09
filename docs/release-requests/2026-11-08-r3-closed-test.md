# TravelFrame R3-A~C — Google Play closed-test release request

- User-authorized target: **Google Play closed testing** (existing `alpha` track), not production and not internal.
- Android application package: `com.haebi.photoguide`.
- Implemented feature: R1 Frame Journal neutral theme; R3 comparison entry guidance, photo-pair picker and slider/side-by-side/overlay comparison.
- Verified code from [PR #132](https://github.com/hebi10/travelframe/pull/132) merged in main commit `e48a93300fb8f55b47725d293885e93233407137`.
- Same-head [Quality #42488870551](https://github.com/hebi10/travelframe/actions/runs/42488870551) and [Secret Scan #42488870469](https://github.com/hebi10/travelframe/actions/runs/42488870469) successful, [Android native QA #42488870686](https://github.com/hebi10/travelframe/actions/runs/42488870686) successful build. Main [Quality #42490114639](https://github.com/hebi10/travelframe/actions/runs/42490114639) and [Secret Scan #42490114652](https://github.com/hebi10/travelframe/actions/runs/42490114652) successful.
- First automatic closed release `#42490114663` was skipped because the protected Play signing approval workflow gate was not enabled at that moment.
- The user subsequently configured `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107` in GitHub Actions. Manual workflow [#42493143291](https://github.com/hebi10/travelframe/actions/runs/42493143291), `build/internal`, confirmed successful Play inventory/preflight and began signing AAB; it **does not deploy**.
- This documentation-only commit carries the explicit `[deploy-closed]` authorization marker to trigger the existing protected `main` Play workflow, which still independently checks WIF, Play catalog, upload key fingerprint, AAB manifest, R8 mapping, versionCode uniqueness and final Play API readback.
- Do not interpret this file or a started workflow as successful Google Play deployment until the `publish` job succeeds and the `closed` (`alpha`) Play track readback confirms the release.
- No Firebase server deployment, production Play release, subscription/price change, photo manipulation, or app source change is authorized by this commit.
- Closed testing is for the user's follow-on interactive Android QA, which remains unverified until tested.

## Retry after R8 heap exhaustion (2026-11-09 KST)

- First build-only run [#39](https://github.com/hebi10/travelframe/actions/runs/42493143291) failed in `app:minifyReleaseWithR8` from `java.lang.OutOfMemoryError: Java heap space`; no Play upload was attempted.
- First closed-deploy run [#40](https://github.com/hebi10/travelframe/actions/runs/42493396271) failed at the same R8 task before `Publish AAB`; no Play upload was attempted.
- [PR #133](https://github.com/hebi10/travelframe/pull/133) was validated and merged in `9890fe0bde0775541be81981a8b078f1e7453d59`, raising release Gradle daemon heap 2 GiB → 4 GiB and metaspace 512 MiB → 1 GiB without changing the application, signing key or Play track.
- Re-run **only Google Play closed testing** via the existing protected `main` push gate; the explicit `[deploy-closed]` marker in this commit authorizes another attempt after the R8 memory fix.
- Completion is contingent on successful signed AAB build, same-run artifact verification, Play API track commit and subsequent readback. Do not claim published until all succeed.

## Retry after APK signer-output parsing (2026-11-09 KST)

- Closed test run [#42](https://github.com/hebi10/travelframe/actions/runs/42495930021) built and independently verified the signed release AAB, but stopped before publishing when the derived universal APK verifier rejected the `apksigner` certificate-output format; **no Play upload occurred**.
- [PR #134](https://github.com/hebi10/travelframe/pull/134) fixed legacy and versioned APK signer-output parsing, kept exact existing Play upload-certificate verification, and added positive/negative regression fixtures. Quality and Secret Scan passed on the exact reviewed PR head; the change merged to `main` as `a0d6039dab1ec13ac7f9b4d8e116b35ffaed85d8`.
- This new **[deploy-closed]** request retries only the existing `alpha` Google Play closed-test track for `com.haebi.photoguide` from the merged `main` source. No production, Firebase backend or paid-plan change is requested.
- Treat only successful same-run AAB, APK, provenance checks, signed upload and **committed Google Play alpha readback** as deployment success. Do not interpret workflow creation or AAB build success alone as publication.

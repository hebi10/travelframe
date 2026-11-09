# TravelFrame Google Play Korean phone store screenshots — authorized release

- Date: 2026-11-09 KST
- Request: user authorized replacing the six Google Play Store promotional phone images.
- App package: `com.haebi.photoguide`.
- Locale: `ko-KR`; image type: `phoneScreenshots` only.
- Intended images: six ordered promo screenshots with original SHA-256 checksums and exact Drive IDs in `docs/release-assets/play-phone-six-20261109.json`.
- App source and features: unchanged. Previous closed-track AAB release [Actions #44](https://github.com/hebi10/travelframe/actions/runs/42544273062) succeeded.
- Reviewed implementation: [PR #135](https://github.com/hebi10/travelframe/pull/135), merged as `62fc2441a8e67993adaf5acec9b9cdea2c3d7abe`; required validation, Quality, and Secret Scan passed.
- Security: only the six images are individually shared with the existing Play release service account. Short-lived Drive read-only and Android Publisher OAuth tokens are used; no credential or token is committed.
- Before commit: verify original image checksums, resize as RGB 1080×1920, verify manifest, existing Korean listing, current Play image inventory, upload six exact images, and inspect the staged list.
- After commit: open a fresh Play edit and re-read the same locale/type to confirm six image IDs. Preserve receipt.
- Do not mutate production or closed/internal app releases, alternate locale listings, app icon, feature graphic, prices, Firebase, or app code.
- If a Play review or permission gate rejects the change, abort without forcing a commit. A successful GitHub run is **not** proof of immediate public display or Play review approval.

This documentation-only commit explicitly authorizes the guarded store screenshot upload workflow: [publish-store-shots].

## Retry after Drive API 403 (2026-11-09 KST)

- The initial screenshot publish run [store-images #4](https://github.com/hebi10/travelframe/actions/runs/42550797498) failed during Drive API download with HTTP 403. It did not begin a Play edit, delete any screenshots, or commit any change.
- [PR #136](https://github.com/hebi10/travelframe/pull/136) packages six reviewed PNG originals as source SHA-256-checked base64 assets in `assets/play-store/2026-11-09/`; this avoids any Drive API call at deploy time. Exact-head Quality, Secret Scan, and gated workflow tests all passed before merging to `c35b3d4b1eb8a3f82bdb19530f0470a5e31e9a4a`.
- Only `com.haebi.photoguide`, `ko-KR`, `phoneScreenshots` is authorized for one retried transaction, with validated RGB 1080x1920 images in fixed order. Preserve existing releases/tracks, other locales, icon, feature graphic, listing descriptions, and backend resources.
- GitHub Actions must complete bundle SHA-256 verification, Play image upload, commit, and an independent fresh-edit readback before declaring success.
- A Play Console review/publishing delay after API commit remains separate from successful API readback.

One-time explicit authorization to retry the guarded Google Play screenshot workflow: [publish-store-shots].

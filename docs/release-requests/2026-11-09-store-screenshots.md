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

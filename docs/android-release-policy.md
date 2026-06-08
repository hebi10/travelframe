# Android release policy

## Local AAB versionCode

`npm run android:build-prod-local` runs `scripts/build-android-aab.ps1`.
For local AAB builds, the Local AAB versionCode source of truth is:

- `-VersionCode` passed to `scripts/build-android-aab.ps1`
- otherwise `.android-version-code`, advanced monotonically from `yyMMddHH`

`app.json` may still contain Expo metadata, but local AAB builds rewrite the generated
`android/app/build.gradle` versionCode after `expo prebuild`. EAS remote
`appVersionSource` is separate and applies to `npm run android:build-prod`.
EAS remote appVersionSource must not be treated as the local AAB source.

## Android permissions and Play Console declarations

The Android release config intentionally requests only permissions that match current
features:

- `CAMERA`: camera capture.
- `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`: legacy media access on Android 12 and lower.
- `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, and `READ_MEDIA_VISUAL_USER_SELECTED`: media picker and library access on Android 13+.
- `AD_ID`: Google Mobile Ads. Keep the Play Console advertising ID declaration aligned with this permission.

`RECORD_AUDIO` is blocked because the app does not record microphone audio.
`MODIFY_AUDIO_SETTINGS` is not requested unless a native audio-routing feature is added.

Before Play Console upload, verify the merged release manifest with
`npm run android:manifest:release` and confirm the Play Console permission and data
safety declarations match the permissions above.

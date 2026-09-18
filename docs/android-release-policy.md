# Android release policy

## Local AAB versionCode

`npm run android:build-prod-local` runs `scripts/build-android-aab.ps1`.
For local AAB builds, the Local AAB versionCode source of truth is:

- `-VersionCode` passed to `scripts/build-android-aab.ps1`
- otherwise `.android-version-code`, advanced monotonically from `yyMMddHH`

Manual `-VersionCode` values must be greater than the value already recorded in
`.android-version-code`. Reusing or lowering the local version code is rejected
before the AAB build starts.

`app.json` may still contain Expo metadata, but local AAB builds rewrite the generated
`android/app/build.gradle` versionCode after `expo prebuild`. EAS remote
`appVersionSource` is separate and applies to `npm run android:build-prod`.
EAS remote appVersionSource must not be treated as the local AAB source.

Local release candidate AAB builds must also produce
`android/app/build/outputs/mapping/release/mapping.txt`. A missing R8 mapping file
is treated as a failed release candidate build, not a warning.

## Android permissions and Play Console declarations

The Android release config intentionally requests only permissions that match current
features:

- `CAMERA`: camera capture.
- `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`: legacy media access on Android 12 and lower.
- `READ_MEDIA_IMAGES` and `READ_MEDIA_VISUAL_USER_SELECTED`: image picker and library access on Android 13+.
- `AD_ID`: Google Mobile Ads. Keep the Play Console advertising ID declaration aligned with this permission.

`RECORD_AUDIO` is blocked because the app does not record microphone audio.
`MODIFY_AUDIO_SETTINGS` is not requested unless a native audio-routing feature is added.
The app does not request `READ_MEDIA_VIDEO` because current flows create videos
inside the app but do not import videos from the user's external video library.
`android.hardware.camera` and `android.hardware.microphone` are declared with
`android:required="false"` so Google Play does not exclude otherwise compatible
devices based only on hardware feature filters.

Before Play Console upload, verify the merged release manifest with
`npm run android:manifest:release` and confirm the Play Console permission and data
safety declarations match the permissions above.

## Clean native verification

The repository intentionally ignores the generated `android/` directory. CI and release
verification therefore run `npm run android:prebuild:ci` before tests or Gradle
verification that depend on generated Android files.

The clean prebuild:
- regenerates Android from `app.json` and Expo config plugins,
- recreates Body Frame native image adjustment sources,
- recreates the release ProGuard/R8 keep rules,
- reapplies required VisionCamera, React Native Gradle/Foojay and Google Mobile Ads patches.

This prevents a developer's stale local `android/` folder from becoming a hidden release
dependency.

## Release artwork

The approved BF monogram v2 launcher and adaptive foreground are source-controlled under
`assets/icons`. Android adaptive background remains `#0B0B0C`. The current splash is
retained because the approved BF v2 package does not include a dedicated splash final.

App/store artwork is not a Firebase upload. Google Play listing graphics are uploaded
directly to Google Play Console. See `docs/release-assets/README.md`.


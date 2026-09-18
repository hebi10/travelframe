# Body Frame Release Assets

## Approved BF v2 assets

Approved artwork is stored in Google Drive:

- Release assets root: https://drive.google.com/drive/folders/1gEl1UkYS79iD8rM_0-Dh5giJDJmmWdTg
- Approved BF monogram v2: https://drive.google.com/drive/folders/1lpfMVjlvx7F_v5Jkd_ZVd9OK4HAVLt-_

Approved v2 files:
- `01_app_icon_BF_monogram_1024.png`
- `02_adaptive_foreground_BF_1024.png`
- `03_adaptive_background_1024.png`

Repository application:
- App icon → `assets/icons/app-icon.png` **applied**
- Android adaptive foreground → `assets/icons/adaptive-icon.png` **applied**
- Android adaptive background → `#0B0B0C` in `app.json` **applied**
- Splash → existing repository splash retained because the approved BF v2 package does not include a dedicated final splash image

The Stage 7 UI-finalization contract verifies that the repository app/adaptive icons match the approved BF v2 binary hashes.

## Firebase policy

이 출시 이미지는 **Firebase에 업로드하지 않습니다**.

App-bundle artwork belongs in the repository and Google Play listing graphics are uploaded directly to **Google Play Console**.

### App bundle assets
- launcher icon → repository `assets/icons`
- adaptive icon foreground → repository `assets/icons`
- adaptive background → Expo app config
- splash → repository asset referenced by Expo app config

### Google Play Console assets
Upload directly to Google Play Console:
- Play app icon
- feature graphic (1024×500)
- phone screenshots
- store listing graphics

## Final release checks

After source or artwork changes run:
- `npm run android:prebuild:ci`
- `npm run release:verify`
- `npm test`
- production EAS AAB build
- physical Android QA from `docs/manual-device-qa.md`

## Compatibility
- Android package remains `com.haebi.photoguide`
- existing EAS project remains unchanged
- billing product IDs remain `ad_remove`, `creator_monthly`, `expert_monthly`

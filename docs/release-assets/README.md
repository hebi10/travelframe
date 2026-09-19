# Body Frame Release Assets

## Approved Body Frame symbol (2026-09-19)

승인 방향: **인물 윤곽 + 촬영 프레임 + 라임 포인트** / 차콜 배경. 이전 **BF 모노그램 v2**를 교체했습니다.

현재 승인 원본: `assets/icons/body-frame-approved.png`.
`node scripts/prepare-body-frame-icons.mjs`로 원본 디자인을 유지한 채 1024px 앱 아이콘과 Android 안전 여백을 적용한 adaptive/splash 이미지를 생성합니다.

Previous BF v2 artwork archive in Google Drive:

- Release assets root: https://drive.google.com/drive/folders/1gEl1UkYS79iD8rM_0-Dh5giJDJmmWdTg
- Approved BF monogram v2: https://drive.google.com/drive/folders/1lpfMVjlvx7F_v5Jkd_ZVd9OK4HAVLt-_

Previous v2 files:
- `01_app_icon_BF_monogram_1024.png`
- `02_adaptive_foreground_BF_1024.png`
- `03_adaptive_background_1024.png`

Repository application:
- App icon → `assets/icons/app-icon.png` **applied**
- Android adaptive foreground → `assets/icons/adaptive-icon.png` **applied**
- Android adaptive background → `#151719` in `app.json` **applied**
- Splash → approved Body Frame symbol in `assets/icons/splash-icon.png` **applied**

The Stage 7 UI-finalization contract verifies the updated app/adaptive asset hashes. Native launcher and splash changes require a new Android build/install; Metro reload alone cannot update them.

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

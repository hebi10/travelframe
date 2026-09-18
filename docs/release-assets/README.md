# Body Frame Release Assets

## Google Drive handoff
Generated candidate artwork is stored in the user's Google Drive folder:

https://drive.google.com/drive/folders/1gEl1UkYS79iD8rM_0-Dh5giJDJmmWdTg

Folder: `바디 프레임 출시 에셋`

Included:
- `01_app_icon_1024.png`
- `02_adaptive_foreground_1024.png`
- `03_adaptive_background_1024.png`
- `04_splash_1440x2960.png`
- `05_play_feature_graphic_1024x500.png`
- `06_store_screenshot_template_1080x1920.png`
- brand direction sheets
- ZIP bundle + README

## Firebase policy
이 출시 이미지는 **Firebase에 업로드하지 않습니다**.

### App bundle assets
After visual approval, copy/resize approved files into the repository:
- App icon → `assets/icons/app-icon.png`
- Android adaptive foreground → `assets/icons/adaptive-icon.png`
- Splash → `assets/icons/splash-icon.png`

Then verify `app.json` references and run:
- `npm run android:prebuild:ci`
- `npm run release:verify`
- production build / device QA

### Google Play Console assets
Upload directly to **Google Play Console**, not Firebase:
- Play app icon
- feature graphic (1024×500)
- phone screenshots
- store listing graphics

## Manual approval
Stage 8 intentionally does not overwrite current launcher/splash binaries. Generated artwork is a release candidate and must be visually approved before being copied into `assets/icons` or uploaded to Google Play Console.

## Compatibility
- Android package remains `com.haebi.photoguide`
- existing EAS project remains unchanged
- billing product IDs remain `ad_remove`, `creator_monthly`, `expert_monthly`

# Google Play Health Apps / Health Connect Declaration

## Current production behavior

Body Frame uses Android Health Connect only as an optional, user-initiated import source.

- Health app category: **Health and fitness → Activity and fitness**
- Read permission: `android.permission.health.READ_WEIGHT`
- Read permission: `android.permission.health.READ_BODY_FAT`
- Write permissions: none
- Background read: none
- Extended history permission: none
- Read window: latest records within 30 days
- Trigger: only after the user explicitly chooses Health Connect connection/import
- Imported destination: local Body Frame measurement records
- Automatic Firebase/cloud upload of Health Connect values: none
- Medical diagnosis/treatment/device functionality: none

Google Play defines Activity and fitness as including body composition and weight tracking, so Body Frame's Weight / Body Fat import belongs in this category.

## Play Console declaration

Path:

`Policy and programs → App content → Health apps → Start / Manage`

Use the following declaration.

### Health features

Select:

- **Health and fitness**
  - **Activity and fitness**

Do not select Nutrition and weight management unless the product later adds diet planning, nutrition tracking, or explicit weight-loss/weight-management coaching.

Do not select medical categories. Body Frame does not diagnose, treat, prevent, or manage diseases and is not a medical device.

### Health Connect permissions

#### READ_WEIGHT

Purpose:

> 사용자가 Health Connect에 저장된 최근 30일 몸무게 기록을 직접 선택해 Body Frame의 로컬 수치 기록으로 가져오고, 사진 및 수치 변화 추이를 함께 확인할 수 있도록 사용합니다. 자동 동기화하지 않으며 Health Connect에서 읽은 몸무게 값은 Firebase, 클라우드 백업 또는 광고 SDK로 자동 전송하지 않습니다.

#### READ_BODY_FAT

Purpose:

> 사용자가 Health Connect에 저장된 최근 30일 체지방률 기록을 직접 선택해 Body Frame의 로컬 수치 기록으로 가져오고, 사진 및 수치 변화 추이를 함께 확인할 수 있도록 사용합니다. 자동 동기화하지 않으며 Health Connect에서 읽은 체지방률 값은 Firebase, 클라우드 백업 또는 광고 SDK로 자동 전송하지 않습니다.

### Review instructions

Use these steps if Play Console asks reviewers how to find the feature:

1. 앱 실행 후 Body Frame 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.
2. 기록 화면에서 수치 기록 전체 보기로 이동합니다.
3. 프로젝트 수치 설정에서 몸무게 또는 체지방률 항목을 활성화합니다.
4. Health Connect 카드에서 **Health Connect 연결**을 선택합니다.
5. 몸무게 / 체지방률 읽기 권한을 허용합니다.
6. **최신 기록 확인**을 눌러 최근 30일의 최신 값을 확인합니다.
7. **가져오기**를 누르면 선택한 프로젝트의 로컬 수치 기록에 추가됩니다.

No sign-in is required for the Health Connect import itself unless the surrounding product flow changes before release.

## Store listing disclosure

The Google Play store description should clearly mention the optional Health Connect feature so the public listing matches the declaration.

Recommended wording:

> 바디 프레임은 같은 구도와 자세로 몸의 변화를 기록하고 변화 영상을 만들 수 있는 바디 기록 앱입니다. Android에서는 사용자가 원할 때 Health Connect에 연결해 최근 몸무게와 체지방률 기록을 불러와 사진과 함께 변화 추이를 확인할 수 있습니다. Health Connect 연결과 가져오기는 선택 사항이며 자동 동기화하지 않습니다.

## Release verification

Before every Health Connect release:

- Confirm the release manifest contains only `READ_WEIGHT` and `READ_BODY_FAT` health permissions.
- Confirm the Play Console Health apps declaration is saved and submitted.
- Confirm Play Data Safety answers still match current behavior.
- Confirm the public privacy policy documents Weight, Body Fat, recent 30-day read, user-initiated import, and no automatic Firebase upload.
- Confirm the store listing mentions the optional Health Connect Weight / Body Fat import.

# TravelFrame

TravelFrame은 같은 구도로 사진을 촬영하고, 사진 편집과 여행 클립 제작을 지원하는 Expo 기반 Android 앱입니다.

## 현재 플랫폼 범위

- 현재 목표 플랫폼은 Android 전용입니다.
- iOS/web 실행 스크립트는 기본 개발 흐름에 노출하지 않습니다.
- 네이티브 광고, MP4 저장, 기기 권한 흐름은 Android 개발 빌드 또는 Play Store 빌드에서 확인합니다.

## 실행

```bash
npm install
npm run start
```

Android 개발 빌드 실행과 설치는 아래 명령을 사용합니다.

```bash
npm run android:build-dev
npm run android:run-latest
```

Play Store 업로드용 AAB는 아래 명령을 사용합니다.

```bash
npm run android:build-prod
```

## 검증

일반 로컬 품질 확인은 앱 코드 중심으로 실행합니다.

```bash
npm run quality
```

위 명령은 `typecheck`, `lint`, Node 기반 테스트, secret 스캔을 순서대로 실행합니다. Firebase Rules 에뮬레이터 검증은 별도 명령으로 분리되어 있습니다.

```bash
npm run quality:firebase-rules
```

개별 검증이 필요할 때는 아래 명령을 직접 실행할 수 있습니다.

```bash
npm run typecheck
npm run lint
npm test
npm run security:secrets
```

## Android 네이티브 QA

Expo Go에서 대부분의 화면 흐름을 확인할 수 있지만 AdMob, `react-native-view-recorder` 기반 MP4 저장, 일부 네이티브 모듈 연결 상태는 Android 개발 빌드 또는 Play Store 빌드에서 확인해야 합니다.

수동 기기 QA 항목은 `docs/manual-device-qa.md`를 기준으로 확인합니다.

## 관련 설치 명령

카메라, 미디어, 영상 관련 패키지를 다시 정렬해야 할 때만 아래 명령을 사용합니다.

```bash
npm run install:media
```

AdMob 패키지를 다시 설치해야 할 때만 아래 명령을 사용합니다.

```bash
npm run install:ads
```

# TravelFrame

TravelFrame은 여행 사진을 같은 구도로 촬영하고, 사진을 편집하고, 짧은 여행 클립 미리보기까지 만드는 Expo 앱입니다.

## 실행 방법

이 프로젝트는 Expo SDK 55 기준으로 준비되어 있습니다.

```bash
npm install
npm run start
```

Expo가 패키지 버전 정리를 요청하면 아래 명령을 실행합니다.

```bash
npx expo install --fix
```

카메라, 오디오, 영상 관련 패키지는 `package.json`에 정리되어 있습니다. 해당 패키지만 다시 설치하려면 아래 명령을 사용합니다.

```bash
npm run install:media
```

## 검증 명령

기능 수정 후 아래 명령을 기본 확인으로 사용합니다.

```bash
npm test
npm run typecheck
npm run lint
npx expo export --platform web --output-dir .tmp/audit-export
```

현재 테스트는 Node 내장 실행 환경에서 동작하는 프로젝트 경계 검사부터 시작합니다. 외부 테스트 패키지를 설치하지 않아도 실행됩니다.

## Android와 Expo Go 기준

카메라, 앨범 저장, 파일 선택은 Expo Go에서도 대부분 확인할 수 있습니다. 다만 광고 SDK, `react-native-view-recorder` 기반 MP4 직접 저장, 네이티브 모듈 연결 상태는 Expo Go가 아니라 EAS Android 개발 빌드나 Play Store 빌드에서 확인해야 합니다.

Android 개발 빌드를 만들 때는 아래 명령을 사용합니다.

```bash
npm run android:build-dev
npm run android:run-latest
```

Play Store 업로드용 AAB는 아래 명령을 사용합니다.

```bash
npm run android:build-prod
```

## MP4 내보내기

MP4 저장은 Android 개발 빌드 또는 Play Store 빌드에서 `react-native-view-recorder`가 연결되어야 동작합니다. 네이티브 모듈이 연결되지 않은 빌드에서는 앱이 개발 빌드 설치를 안내합니다.

웹에서는 MP4 저장을 제공하지 않습니다. 웹 화면에서는 영상 미리보기와 이미지 저장 흐름만 확인합니다.

## 현재 범위

- 구도 가이드 카메라
- 이전 사진 반투명 오버레이
- 사진 편집과 비율 프리셋
- 전환 효과와 음악이 있는 여행 클립 미리보기
- Android 빌드 기반 MP4 직접 저장

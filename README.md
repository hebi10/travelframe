# 바디 프레임 (Body Frame)

Android에서 같은 구도와 자세로 몸의 변화를 기록하고, 이전 사진을 기준으로 촬영하며 변화 영상을 제작하는 Expo / React Native 앱입니다.

> 저장소 이름(`travelframe`)과 일부 이전 코드의 `travel-frame` 키는 기존 설치 데이터의 호환성을 위해 유지됩니다. 사용자에게 표시하는 앱 이름은 `바디 프레임`입니다.

## 사용자 기능

- **촬영**: 프로젝트별 기준 사진(first/latest) 오버레이, 가이드·확대·노출·색감, 선택적 온디바이스 자세 맞춤
- **기록**: 프로젝트 사진과 순서 편집, 로컬 몸무게·체지방률·골격근량·허리둘레 기록 및 그래프
- **변화 영상**: 프로젝트 사진의 정렬 순서에 따른 MP4 생성, 사진 간격/화질/비율/텍스트 선택
- **계정 및 플랜**: Firebase 인증, Google Play 결제, AdMob 및 유료 클라우드 백업
- **Health Connect**: 사용자가 직접 요청할 때만 몸무게·체지방률 읽기, 가져온 수치는 로컬에 저장

목표 플랫폼은 **Android 전용**입니다. iOS/Web 호환을 추가하지 않으며, 카메라·MP4·광고·결제는 Android 개발 빌드 또는 스토어 빌드에서 검증합니다.

## 주요 디렉터리

| 경로 | 역할 |
| --- | --- |
| `app/` | Expo Router 경로 연결 |
| `features/camera/` | 카메라와 프로젝트 촬영 |
| `features/records/` | 프로젝트 기록, 순서 관리, 신체 수치 |
| `features/trip-clip/` | 변화 영상 및 기존 영상 코드 |
| `features/account/` · `features/settings/` | 계정·결제·백업 및 환경설정 |
| `lib/` | 로컬 저장·계정 소유권·백업·결제·권한 등 도메인 로직 |
| `functions/` | Firebase Functions, 결제 검증 및 백업 서버 로직 |
| `admin/` | Firebase Hosting 관리자 페이지 |
| `tests/` · `docs/` | 회귀 테스트 및 출시/보안/실기기 QA 문서 |

## 설치 및 Android 실행

```powershell
npm install
npm run android:dev
```

개발용 빌드 설치:

```powershell
npm run android:build-dev
npm run android:run-latest
```

Play Store 업로드용 AAB:

```powershell
npm run android:build-prod
```

실제 서명과 Play Console 업로드, 운영 Firebase 배포는 별도의 승인·검증 절차입니다.

## 품질 검사

```powershell
npm run android:prebuild:ci
npm run quality
npm run quality:functions
npm run quality:firebase-rules
npm run release:verify
```

`npm run quality`에는 TypeScript, Expo lint, Node 테스트, 비밀정보 스캔이 포함됩니다. Firebase Rules Emulator 및 Android 네이티브 빌드 검증은 별도 단계로 확인합니다.

- 기기 QA: [docs/manual-device-qa.md](docs/manual-device-qa.md)
- 출시 준비: [docs/body-frame-release-checklist.md](docs/body-frame-release-checklist.md)
- 보안 운영 반영: [docs/security-hardening-rollout.md](docs/security-hardening-rollout.md)
- 코드 분리/레거시 정리: [docs/code-health-roadmap.md](docs/code-health-roadmap.md)

## 주의사항

- 기존 로컬 사진, 프로젝트, 백업 메타데이터는 마이그레이션 및 이전 버전 호환성을 검증하기 전까지 임의 삭제하거나 키 이름을 변경하지 않습니다.
- 플랜 권한의 기준은 `lib/plan-entitlements.ts`이며, 화면 설명과 서버 검증도 이에 맞춰야 합니다.
- 코드 검사 통과와 운영 출시 완료는 다릅니다. 구매/환불/광고 동의/백업 복원/영상 저장은 실기기와 서비스 설정으로 재검증해야 합니다.

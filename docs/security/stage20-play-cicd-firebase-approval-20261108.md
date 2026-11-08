# Stage 20 — GalliPick 방식 Play CI/CD 및 Firebase 서버 독립 배포

기준: `main@85e059e927af445572a6eb27b2ea20ce9bce6a73`. 이 단계는 **배포 절차 개선**이며 Google Play 또는 Firebase에 실제 배포하지 않습니다.

## 1. Android Google Play 테스트 배포

`.github/workflows/android-play-aab.yml`의 **Android Play test release**를 `main`에서 실행합니다.

| 실행 | mode | target | 결과 |
| --- | --- | --- | --- |
| 읽기 전용 점검 | `check` | `internal` 또는 `closed` | Play 트랙·기존 버전 현황 조회, AAB 생성/게시 없음 |
| 사전 빌드 | `build` | `internal` 또는 `closed` | 서명된 AAB·APK, SHA·R8·Manifest·구문/기능 검증, 게시 없음 |
| 수동 배포 | `deploy` | `internal` | 정확한 main 소스·인증서·버전 검증 후 내부 테스트 게시 및 읽기 검증 |
| 수동 배포 | `deploy` | `closed` | 기존 alpha 비공개 테스트 트랙에 게시 및 읽기 검증 |
| 명시적 main 푸시 | 메시지 `[deploy-internal]` | `internal` | 기존 서명 승인 변수 true일 때만 게시 |
| 명시적 main 푸시 | 메시지 `[deploy-closed]` | `closed` | 기존 서명 승인 변수 true일 때만 게시 |
| 일반 main 병합 | 없음 | 해당 없음 | **Play 게시하지 않음** |

- 수동 실행의 기본 mode는 `build`이며 배포하지 않습니다. mode `check`는 업로드 키 복구가 없어도 Play의 읽기 전용 상태를 확인할 수 있습니다.
- 서명·빌드·게시 모드는 기존 `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107 == 'true'` 검증 승인이 필요합니다. 이 변수는 이번 작업에서 변경하지 않습니다.
- 기존 Play WIF (`PLAY_WORKLOAD_IDENTITY_PROVIDER`, `PLAY_SERVICE_ACCOUNT`)과 Android 업로드 서명키·콘솔 인증서 비교를 그대로 사용합니다. 이번 변경에서 자격증명은 조회·변경하지 않습니다.
- 현재 앱 소스는 Android package `com.haebi.photoguide`, Expo `1.0.32`. 수동 `version_name`이 비어 있으면 소스 app.json 버전을 사용하고, `version_code`는 기존 모든 Play 트랙·번들·APK 최대값보다 높은 값을 선택합니다.
- 비공개 테스트는 **이미 존재하는 alpha 트랙**만 사용합니다. 운영/공개 트랙은 경로와 옵션에서 허용하지 않습니다.
- GitHub Actions 실행 완료는 Play Console 심사 승인이나 테스터 설치 가능 여부를 의미하지 않습니다.

## 2. Firebase 서버 독립 승인 배포

`.github/workflows/firebase-backend-release.yml`의 **Firebase backend release (manual approval)**는 Play 워크플로와 독립입니다.

| mode | 실행 범위 |
| --- | --- |
| `check` (기본) | `functions` 의존성 설치·구문·실제 런타임 API 검사, 배포 없음 |
| `deploy` | 별도 GitHub 환경 승인 및 확인 문자열을 충족한 경우에만 **Functions만** 운영 프로젝트에 배포 |

운영 Functions 배포는 아래 **전부** 만족해야 합니다.
1. GitHub `main` 브랜치의 `workflow_dispatch` 수동 실행.
2. mode `deploy`, 확인 문자열 `DEPLOY_TRAVELFRAME_FIREBASE_BACKEND` 입력.
3. repository variable `TRAVELFRAME_FIREBASE_BACKEND_APPROVED=true`(별도 운영 검증 및 명시 승인 뒤에만 적용).
4. GitHub environment `travelframe-firebase-backend-production`을 생성하고 담당자의 **Required reviewers**를 지정. 환경 검토자가 승인해야 실행됩니다.
5. 독립 Firebase 서버 전용 `TRAVELFRAME_FIREBASE_BACKEND_WIF_PROVIDER`와 `TRAVELFRAME_FIREBASE_BACKEND_SERVICE_ACCOUNT` 구성. 계정은 운영 프로젝트 `travelframe-4e1fb` 소유여야 합니다. Play Publisher 서비스 계정 재사용 금지.
6. `scripts/verify-firebase-backend-release.mjs`에서 repo/ref/event/모드/승인·서비스계정·대상 프로젝트 재검증.

배포 대상은 `travelframe-4e1fb`의 **Cloud Functions만**입니다. Hosting, Firestore Rules, Storage Rules 및 Google Play는 이 워크플로에서 배포하지 않습니다. 다른 서비스 변경은 각 별도 승인 절차를 사용합니다. Firebase 프로젝트는 사용량에 따라 비용이 발생할 수 있습니다.

> 운영 서버 배포 전 Admin SDK 메이저 업그레이드 PR #128의 실제 격리 스테이징 통합 QA가 우선입니다. `main`의 현재 SDK와 미병합 PR #128의 SDK를 혼동하지 않습니다.

## 3. Firebase Admin 14 / Functions 7 스테이징 검증

PR [#128](https://github.com/hebi10/travelframe/pull/128)의 `stage19-firebase-staging.yml`은 별도 비운영 Firebase 프로젝트, 버킷, Workload Identity Federation 및 승인 변수가 있어야 실행됩니다.

- GalliPick처럼 Play CI/CD가 정상 동작해도 Firebase 서버 SDK의 실제 클라우드 권한·RTDN·백업 데이터 호환성은 자동 입증되지 않습니다.
- 테스트용 프로젝트가 확인되지 않으면 스테이징 job은 **SKIPPED**가 정상이며, 이를 PASS로 계산하지 않습니다.
- 현재까지의 격리 Emulator 통합 검증 11건은 별도로 성공. 운영 서버 직접 배포나 기존 고객 자료에 대한 시험은 진행하지 않습니다.

## 4. 검증 및 병합 조건

- Play 선택지·main source SHA·테스트 트랙 제한·서명 승인·무마커 시 무게시 회귀 테스트.
- Firebase workflow 수동 전용, production main 제한, 별도 WIF·환경 승인, 테스트 계정/Cloud 자료 미사용 검증.
- Quality / Secret Scan / Dependency Audit / Android Native QA 정상 완료 후에만 배포 절차 PR의 main 병합 가능성 검토.
- 사용자 명령 없이 실제 Play 트랙 게시 또는 운영 Firebase Functions 배포 금지.

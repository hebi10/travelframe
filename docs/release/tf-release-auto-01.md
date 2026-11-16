# TF-RELEASE-AUTO-01 — TravelFrame 단일 승인형 테스트 배포

## 목적

GitHub Actions **수동 실행 1회**로 기존 서명키·Google Play API 경로를 재사용하여
정확한 main Android 검증 → 서명 AAB 빌드 → 내부 테스트 게시/readback → 동일 AAB 비공개 테스트 승격/readback을 순차 처리한다.

**중요:** 일반 main push, PR 병합, 태그, GitHub 이슈/댓글에 반응하지 않는다.
별도의 internal 및 closed 승인 두 개를 입력한 `workflow_dispatch`에서만 실제 Play를 변경한다.
이 PR을 병합하는 것 자체는 Google Play 배포 승인이 아니다.

## GitHub Actions 실행

[TF-RELEASE-AUTO-01](https://github.com/hebi10/travelframe/actions/workflows/tf-release-auto-01.yml)
→ Run workflow, branch **main**.

| 입력 | 값 |
|---|---|
| mode | 사전 검증은 `check`, 전체 배포는 `deploy` |
| expected_main_sha | 검증을 마친 최신 `main` 40자리 SHA |
| batch_id | `YYYY-MM-DD-travelframe` |
| internal_approved | 실제 internal 게시 승인 시 `true` |
| closed_approved | 동일 versionCode 비공개 승격까지 승인 시 `true` |

`check`는 AAB 빌드·Google Play 변경 없이 SHA, 저장소, 테스트 트랙 및 승인 형식을 검증한다.
`deploy`는 위 두 승인이 모두 `true`일 때만 실행한다.

## 하나의 deploy에서 수행하는 순서

1. 정확한 `main` SHA와 Quality / Secret Scan / OPS-08 성공 확인.
2. **Body Frame native device QA**를 같은 main SHA로 수동 실행하여 `build-apk`,
   `capture-devices`, 360/412/600/750dp Stage13 캡처,
   네이티브 MP4 생성·취소 및 H.264/해시 독립 검사의 성공 확인.
3. 기존 `android-play-aab.yml`을 `mode=build`, `track=internal`로 실행.
   **이 단계에서 Play 업로드는 실행하지 않는다.**
4. GitHub Artifact의 `build-provenance.json`, 버전, AAB SHA-256,
   업로드 인증서 공개 지문과 `mapping.txt` 무결성 검증.
5. 기존 `play-internal-release.yml`의 `check` → `publish` 실행.
   확인된 동일 AAB 바이트만 internal 테스트에 업로드하고 Google Play API readback 확인.
6. 기존 `play-closed-release.yml`의 `check` → `promote` 실행.
   재빌드·추가 AAB 업로드 없이 internal의 completed 버전코드를 기존 비공개 테스트 트랙
   (기본값 `alpha` 또는 등록된 `PLAY_CLOSED_TRACK`)으로 승격하고 Play API readback 확인.
7. 정확한 GitHub Actions URL, versionCode, AAB SHA-256, 단계별 상태를
   실행 요약과 `tf-release-auto-result-*` artifact로 보존.

## 최초 1회 운영 준비

- GitHub에 등록된 실제 Play 업로드 키와 `ANDROID_UPLOAD_CERT_SHA256`이 일치해야 한다.
- `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107=true` 승인 설정 확인.
- 앱 전용 WIF `PLAY_WORKLOAD_IDENTITY_PROVIDER`, `PLAY_SERVICE_ACCOUNT`와
  Android Publisher API의 앱 테스트 트랙에 필요한 권한 확인.
- 실제 내부 트랙을 `PLAY_INTERNAL_TRACK`(`internal` 또는 `qa`)으로 정확히 지정.
- 기존 closed 트랙 ID가 `alpha`가 아니면 `PLAY_CLOSED_TRACK`에 등록.
- 기존 `google-play` 환경 보호·승인 정책을 보존.
- GitHub Actions 읽기·실행 권한 및 `actions:write` GITHUB_TOKEN 정책 확인.
- Play Console의 가격·구독·광고·Firebase 운영 환경은 이 작업에서 변경하지 않음.

## 출시 안전성

- 기존 Release Batch와 OPS-03/04/05/07/08의 승인·해시·소스·트랙 검사 우회 금지.
- 모든 하위 워크플로는 정확한 최신 main과 상관관계 마커로 식별하며 타 실행 산출물을 혼용하지 않음.
- 필수 검사 failure/cancelled/skipped 또는 확인 불가 시 중단.
- main 이동이나 Google Play 게시 결과 불확실성 발생 시 자동 재업로드·자동 재승격 금지.
- `committed-and-read-back`은 Play API 반영 확인이며, 심사 완료·테스터 설치 가능까지 보증하지 않음.
- 개인 사진/영상 원본, Firebase Storage/Firestore/Functions, 상품·스토어 이미지는 변경하지 않음.
- 실제 ARM64 기기·결제·클라우드 운영 검증은 별도 출시 체크리스트에 따라 최종 확인.

## ChatGPT 연결

GitHub Actions **단일 수동 실행**을 준비하는 작업이다.
현재 ChatGPT의 GitHub 연결에는 `workflow_dispatch` 실행 액션이 제공되지 않아,
ChatGPT 요청만으로 직접 실행을 시작하지 못할 수 있다. 이 경우 사용자는 위 Actions 화면에서
`Run workflow`를 **한 번** 실행하면 이후 각 단계가 자동으로 연결된다.

배포 요청 PR 병합만으로 자동 게시되는 push-trigger 모델은 저장소 OPS-07의 자동 게시
차단 정책과 충돌하므로, 승인된 브랜치 보호·전용 권한 게이트가 검증되기 전까지 활성화하지 않는다.

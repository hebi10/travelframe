# TravelFrame Stage 19 — 실제 Firebase 스테이징 통합 검증

기준: PR #128 / `firebase-admin@14.5.0`, `firebase-functions@7.4.0`, Node.js 22.

## 현재 확인된 결과

- 코드·전체 Quality·Git 기록 Gitleaks·Android x86_64 QA·Firebase Emulator 10개 테스트는 최종 검증 대상이다.
- `.firebaserc`에 설정된 운영 Firebase 프로젝트는 `travelframe-4e1fb`뿐이다.
- 실제 별도 스테이징 프로젝트가 확인되지 않아 운영 환경의 구매·RTDN·백업 검증을 완료한 것으로 기록하지 않는다.
- `.github/workflows/stage19-firebase-staging.yml`은 아래 승인 변수가 없으면 자동으로 **SKIPPED**된다. SKIPPED는 PASS가 아니다.

## 별도 테스트 프로젝트 요구 사항

- 운영 프로젝트 `travelframe-4e1fb`와 무관한 **신규·독립·비운영 Firebase 프로젝트**를 마련한다. GCP 결제 계정 연결에 따른 비용이 발생할 수 있다.
- 스테이징 프로젝트에 필요한 Firebase Auth, Firestore, Cloud Storage, Cloud Functions(2세대), Pub/Sub 및 필수 API를 초기화한다.
- Storage 버킷은 해당 프로젝트 소유의 `<projectId>.appspot.com` 또는 `<projectId>.firebasestorage.app` 중 실제 활성 버킷을 사용한다.
- 스테이징 외의 사용자 계정·사진·백업 파일·구매 토큰은 절대 복제하지 않는다.
- 스테이징 전용 서비스 계정과 Workload Identity Federation provider를 만든다. GitHub repository 및 관련 PR 브랜치에 한정된 발급 정책과 스테이징 프로젝트로만 제한된 IAM 권한을 부여한다.
- GitHub의 `travelframe-firebase-staging` 환경에 승인자(required reviewers)를 지정하고, repository variable에 아래 값을 설정한다. 승인 변수는 검증 준비 이후에만 `true`로 변경한다.

| GitHub repository variable | 값 |
| --- | --- |
| `TRAVELFRAME_STAGING_PROJECT_ID` | 독립된 실제 Firebase 프로젝트 ID. 운영 ID·`demo-` 시작 ID 금지 |
| `TRAVELFRAME_STAGING_STORAGE_BUCKET` | 정확한 스테이징 버킷 이름 |
| `TRAVELFRAME_STAGING_SERVICE_ACCOUNT` | 해당 스테이징 프로젝트에 속한 전용 서비스 계정 이메일 |
| `TRAVELFRAME_STAGING_WIF_PROVIDER` | 검증된 WIF provider 전체 리소스 경로 |
| `TRAVELFRAME_STAGING_APPROVED` | 최종 확인 및 명시 승인 이후에만 `true` |

서비스 계정 개인키·장기 토큰은 GitHub Secret이나 코드에 저장하지 않는다. Workflow는 OIDC를 사용한다.

## 워크플로가 실행하는 작업

1. 오염되지 않은 최신 PR head SHA를 정확히 checkout. 승인 전 `stage19-staging-guard.mjs`로 운영 프로젝트/타 계정/버킷/비승인 조합을 거절.
2. Node.js 22에서 정확한 `functions/package-lock.json` 의존성 설치 및 서버 모듈·24개 Functions export 검사.
3. 환경 보호 승인 후 WIF로 짧은 수명의 스테이징 전용 자격 취득.
4. `firebase deploy --only firestore:rules,storage`, `firebase deploy --only functions`를 **명시된 스테이징 프로젝트에만** 실행. 신규 별도 프로젝트에서만 실행해야 하며 기존 타 프로젝트의 Rules나 Functions를 덮어쓰지 않는다. Firebase Hosting·Google Play는 변경하지 않는다.
5. 실제 스테이징 Auth 계정·Firestore 기록·트랜잭션·Storage 파일을 임시 생성/읽기한 뒤 삭제. 비로그인 사용자의 결제 검증, 관리자 삭제, 관리자 구독 권한 요청이 401/403으로 거부되는지 검사.
6. 실패하거나 정리(cleanup)가 되지 않으면 테스트는 실패로 기록. `reports/stage19-staging-cloud-integration.json` 증빙을 GitHub Actions artifact로 보존한다.

## 위 검증 후에도 수동으로 남는 항목

- 실제 Google Play 라이선스 테스터의 Pro/Plus/Expert 구매·복원, 상호 6방향 변경, 갱신·취소·환불.
- 실제 Google Play → Pub/Sub → Functions RTDN 수신·재검증·서버 구독 권한 반영.
- ARM64 실기기의 실제 사진·MP4·재편집·백업·복원·예외/권한·TalkBack.
- 운영 프로젝트 Functions/Firestore Rules/Storage 배포 버전 대조 및 데이터 보존·계정 삭제 실사용 검증.
- 앱 high 9, Functions moderate 7 잔여 보안 경고 영향 검토와 Play 업로드 인증서 지문 3자 확인.

**출시/운영 안전 기준:** 위 항목이 완료되기 전 PR #128 Draft / `main` 미병합. 실제 신규 스테이징 프로젝트를 연결할 권한이 없다면 작업을 차단 상태로 기록하고 고객 데이터에 대한 시험으로 대체하지 않는다.

근거: [#125](https://github.com/hebi10/travelframe/issues/125), [#106](https://github.com/hebi10/travelframe/issues/106), [#63](https://github.com/hebi10/travelframe/issues/63), [PR #128](https://github.com/hebi10/travelframe/pull/128).

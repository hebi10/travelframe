# TravelFrame Stage 8 — 출시 안전성 및 Google Play 테스트 준비

기준: 2026-11-05 KST. Stage 7 병합 `main@fdd9fdc0be64eed91d93a2a6ad0c0b6896de5c52`.

## 완료된 확인

- 디자인 0~6단계 PR #83~#89, Play 게시 보호 PR #90, Android 영상/화면 QA 수정 PR #91: `main` 병합 완료.
- 해당 `main`의 [Quality #42023686161](https://github.com/hebi10/travelframe/actions/runs/42023686161), [Secret Scan #42023686140](https://github.com/hebi10/travelframe/actions/runs/42023686140): 성공.
- [Android Native QA #42009097531](https://github.com/hebi10/travelframe/actions/runs/42009097531): x86_64 Android QA APK 빌드, 네이티브 영상 생성/백그라운드 복귀 시나리오 및 152개 반응형 화면 **자동 증거 검증** 성공. 실제 실기기/시각 디자인 수동 비교는 별도.
- [Play push #42023686210](https://github.com/hebi10/travelframe/actions/runs/42023686210): 승인 미완료로 계획/빌드/게시 **SKIPPED**, 성공한 Google Play 업로드가 아님.

## Stage 8 코드 반영

1. `app.json`, `package.json`, `package-lock.json`(루트 및 패키지 항목)을 기존 검토 버전 `1.0.32`로 통일. 의존성 및 사용자 데이터 구조 변경 없음. 이 값은 소스 후보 버전이며 실제 Play Console 인벤토리 재조회 완료를 뜻하지 않음.
2. `scripts/publish-play-release.mjs`: 기존 릴리스 초안/중지·진행 중 상태/알 수 없는 상태 또는 잘못된 `versionCodes`를 명시적으로 거절하는 검증을 계획 시점과 게시 직전에 반복. 기존 작업물을 덮거나 검토를 취소하지 않음.
3. `main` 이력에 없는 임의 수동 `source_sha`는 허용하지 않도록 실제 체크아웃 SHA, 조상 관계, 전체 Git 이력 확인.
4. `.github/workflows/android-play-aab.yml`의 검증 단계에 checkout history 및 `check-source`, 보호 테스트를 추가. 기존 `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107` 승인 게이트 유지.
5. `tests/play-release-state.test.mjs`, `tests/play-source.test.mjs` 및 `tests/body-frame-stage8-release-readiness.test.mjs`로 기존 릴리스 보존·정확한 커밋/트랙·버전/가드 계약 검사.
6. [릴리스 워크플로 운영 문서](../../docs/github-play-aab-build.md)에 승인 전 차단 조건, 버전 및 실제 서명키 검증 필요성을 기록.

## 출시 보류 및 검증 경계

- TravelFrame 새 배포는 사용자 지침상 **2026-11-07 이후 가능**하며, Play 업로드 인증서와 실제 GitHub Actions 서명키의 인증서 SHA-256 일치 검증이 선행되어야 함.
- **이번 작업에서는** Play 개발자 콘솔을 통한 최신 버전·트랙·심사 상태·인증서 값을 직접 조회하지 않았으며, 승인 변수/키 Secret을 생성·조회·변경하지 않음.
- 1.0.32가 실제 배포 가능한 앱 버전인지, Play 인벤토리 기반 `versionCode` 계획과 최종 게시 상태는 서명키 복구 후 승인된 Play read-only inventory 및 업로드 시점 재검증 필요.
- 실제 ARM64/폴더블에서 기존 앱 데이터 유지, 기존 편집 영상 프레임/음악/저장 ID, Health Connect, 구독 구매·복원·환불/RTDN, AdMob/UMP 및 클라우드 백업/복원 검증은 source CI만으로 PASS 판정하지 않음.
- [릴리스 QA 이슈 #63](https://github.com/hebi10/travelframe/issues/63) 및 [디자인 QA #73](https://github.com/hebi10/travelframe/issues/73)는 운영/실기기 미검증 항목 추적용으로 유지.

## 8단계 완료 기준

- 최신 PR HEAD에서 TypeScript·Lint·전체 테스트·Firebase Rules/Functions·Android Manifest/Kotlin·Secret Scan 성공 확인.
- `main` 병합 이후 같은 검증을 다시 확인하고 자동 Play 게시가 보류되었음을 구분.
- 인증서·실제 Play 출시는 **별도 필수 검증**으로 남김.

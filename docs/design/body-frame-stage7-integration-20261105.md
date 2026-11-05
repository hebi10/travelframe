# Body Frame Stage 7 — 통합 검증 및 출시 준비

작성일: 2026-11-05 KST · 기준 `main@00e2e85236b8686bedec01febe53724a647a7c6f`

## 최신 기준 코드 및 병합 상태

- 디자인 0~6단계 PR #83~#89과 배포 보호 PR #90: 모두 `main` 병합 완료.
- 최종 `main` Quality [#42006277888](https://github.com/hebi10/travelframe/actions/runs/42006277888): TypeScript·Lint·전체 테스트·Firebase Rules/Functions·Android Manifest/Kotlin 모두 성공.
- `main` Secret Scan [#42006277873](https://github.com/hebi10/travelframe/actions/runs/42006277873): 성공.
- `main` Play 게시 [#42006277875](https://github.com/hebi10/travelframe/actions/runs/42006277875): 자동 업로드 방지 조건에 의해 **SKIPPED**. 업로드 성공으로 보고하지 않음.

## 실제 Android QA 실패 원인 및 Stage 7 수정

### 1. 재현된 네이티브 종료 충돌

- Android QA [#42004407890](https://github.com/hebi10/travelframe/actions/runs/42004407890): x86_64 APK 빌드 성공, 모바일·태블릿 81개 중 79개 캡처 PASS, 2개 실패.
- 태블릿에서 영상 생성 도중 HOME → 앱 복귀: `MediaCodec.getOutputBuffer()` 호출이 인코더 `stop()`와 겹쳐 `IllegalStateException` 발생, PID 종료가 실제 로그캣에 기록됨.
- 바로 뒤의 사진 간격 재설정 실패는 앱 종료/재시작 후 제어 버튼이 나타나지 않은 2차 실패. 정상 복귀가 선행되어야 하는 시나리오이므로 해당 실패를 독립적 버튼 버그로 단정하지 않음.
- 해결: 검증된 [녹화 충돌 수정 PR #80](https://github.com/hebi10/travelframe/pull/80)의 `react-native-view-recorder@0.4.1` 콜백 안전 패치 **관련 파일만 선별 포팅**. 버전 및 원본·수정 SHA-256 확인 후 적용하며 활성 세션 오류와 `MediaCodec.CodecException`은 숨기지 않음.
- 추가: 실제 설치된 Kotlin 콜백으로 실행하는 `tests/view-recorder-stop-race.test.mjs` + 콜백 경합 fixture.

### 2. 태블릿 시각 캡처 크기 전환

- 같은 [QA 실행 #42004407890](https://github.com/hebi10/travelframe/actions/runs/42004407890)의 Stage 6 시각 아티팩트: 152/152 PNG·UI XML은 실제로 캡처되었으나, 750dp/dark-100/camera 1개가 이전 600dp의 900×1600px 크기로 저장되어 전체 검사 실패.
- 새 `wait_for_visual_profile()`가 `wm size/density` 적용 뒤 실제 Android PNG 캡처 표면 크기가 목표값과 같아질 때까지 확인. 불일치 시 제한된 시간 뒤 실패로 기록하며 조용히 PASS 처리하지 않음.
- 시각 캡처 4개 너비 × 3개 테마/글꼴 조합 및 152개 시나리오, synthetic guest fixture, 네트워크 차단 정책을 유지.
- 테스트 `scripts/test_capture_android_qa.py`는 이전/목표 크기의 순차 스크린샷과 크기 미수렴 오류를 재현.

## 출시 준비 현황

- 최종 배포 경로는 [Play 내부 테스트 AAB workflow](https://github.com/hebi10/travelframe/actions/workflows/android-play-aab.yml). `main` push가 발생해도 릴리스 승인 변수 `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107`이 활성화되지 않으면 plan/build/publish 모두 SKIP.
- **릴리스 미완료:** 2026-11-07 이후 업로드 가능, Play 업로드 인증서와 실제 서명키 불일치 문제 해결 및 인증서 fingerprint 검증 필수.
- `app.json` 및 패키지 표시버전은 이 Stage 7 시작 기준 1.0.30. 이전 릴리스 검토 때 Play 내부 테스트는 1.0.31로 보고되었으며, 실제 최신 Play inventory는 아직 재조회하지 않았음. 1.0.32 메타데이터·기존 비완료 릴리스 보호 등은 **미병합 PR #80**의 별도 릴리스 검증 대상으로 유지.
- Android 합격 산출물은 테스트/에뮬레이터 전용 APK이며, 서명된 Play AAB 설치 검증이 아님. 키/Google Play 결제·복원·클라우드 백업 및 사용자 기존 영상 재편집 동등성 검사는 별도 미완료.

## 완료 기준과 유보

- Stage 7 브랜치의 전체 Quality·Secret Scan·Android 신규 QA를 확인하고 오류 시 수정한 뒤 `main`에 병합.
- UI·모달·이미지·시각 가이드의 최종 사람 눈 검사, TalkBack 실제 음성 순서, 기존 영상 프레임/음악·복원 동등성은 검증하지 않은 상태에서는 'PASS'로 표시하지 않음.
- 인증서가 준비되기 전 `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107`을 활성화하거나 강제로 Play 업로드하지 않음.

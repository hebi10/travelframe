# TravelFrame UI-R08 — 전체 화면·기능 통합 QA

기준: 2026-11-11 · 소스 `main@9e6d84cad89b59ae34f0fe45b6117b843de731e9` 및 PR #150~#156 정확한 HEAD 7개 · **QA 전용 미출시 통합 스냅샷**

## 1. 근거

- [Google Drive — 최신 Android 캡처와 R0 기획 시안 비교/개선 로드맵](https://docs.google.com/document/d/1xtnlzJADQRklccXmln0_my_6CgZJIdrWNemppowD5cs/edit)의 `UI-R08 — 통합 Android QA` 범위.
- 기존 `docs/design/ui-r00-baseline-20261111.md`부터 `ui-r07-onboarding-settings-modals-20261111.md`까지 단계별 구현/검증 문서.
- `docs/qa/ui-r08-source-manifest-20261111.json`: 7개 PR HEAD, 최초 main, 충돌해결 파일, 필수 24개 조합 및 QA-only 한계.

## 2. 통합 방식 및 금지사항

- **실제 `main` 병합 전 검증 전용 브랜치** `qa/ui-r08-integrated-preview-20261111`에 PR #150~#156의 실제 코드 파일·단계별 회귀·문서·Android QA 스크립트를 합친 한 개 HEAD 생성.
- 각 PR에서 중복 변경된 `.github/workflows/body-frame-device-qa.yml`은 누락 없이 작업을 보존한 통합 워크플로로 구성, `.gitleaksignore`는 옛 UI-R00 합성 픽스처 1개에 대한 정확한 SHA/경로/룰/줄 예외만 유지. 새로운 비밀키/무제한 제외 절대 추가하지 않음.
- QA 전용 초안 PR은 원본 PR들을 대체해 `main`에 병합하는 용도가 아닙니다. PR #150→#156은 별도 품질 검증 후 정해진 순서로 안전 병합해야 하며, **합본 QA PASS만으로 본선 병합/배포가 완료되지 않습니다.**
- 사용자의 실제 사진/수치·프로젝트·계정·클라우드/Firestore·백업, Play 구매/광고, 서명 AAB/앱 버전, MP4 엔진은 변경하거나 게시하지 않습니다.

## 3. 자동 품질 검증

| 영역 | 검증 조건 | 현재 판단 원칙 |
| --- | --- | --- |
| TypeScript/ESLint | 전체 Typecheck·Lint 및 TSX 로딩·화면 컴포넌트 | 실제 Quality 결과만 PASS |
| 기능 회귀 | 기존 Node 전체, 신규 `tests/ui-r08-integrated-sources.test.mjs` 및 R00~07 단계별 tests | 반드시 **합본 HEAD** 기준 PASS |
| Backend 불변성 | Firebase Rules/Functions, 개인정보·백업·광고/결제·Health Connect 정책 회귀 | 실운영 호출 없이 정적 결과 구분 |
| 보안 | Secret Scan/Gitleaks | 옛 픽스처 정확한 예외만 허용 |
| Android | Gradle·Manifest·Kotlin 및 API35 x86_64 APK | 실제 빌드 산출물 검증 |
| 24환경 | 360/412/600/750dp × Light/Dark × 100/130/150% | 원본 Android PNG/UI XML/개별 JSON·SHA·픽셀 검증 |
| 화면 세부 | 각 조합 9개 핵심 화면 + 글꼴 100%에서 영상 보관함·사진 옵션·프로젝트 설정·새 프로젝트·온보딩 등 | `scripts/verify_ui_r08_visual.py`로 원본 264개 필수 화면 추가 검사 |
| R00 기준·상태 | 합성 QA 데이터와 원본/빈 상태; 특수 데이터 누락 분리 | R00 네이티브 캡처/독립 감사 |
| R01/R02 | 비교 스와이프/터치·카메라 권한/기준 사진 및 예외 | R01/R02 원본 Android QA 작업 검증, 실기기 별도 |
| R05 영상 | 실제 Android MP4 H.264·프레임 수·앨범/보관함 저장, 실패/취소·쿼터 부작용 없음 | R05 네이티브 출력/독립 readback |
| R07 키보드 | Android 360dp 150%에서 IME 열린 채 생성 버튼 실행·로컬 DB 저장 | R07 네이티브 키보드/독립 readback |
| 최종 게이트 | 동일 run의 APK/일반 촬영/4폭/두 단계 네이티브 QA 등 필수 12 job 전부 SUCCESS | `ui-r08-aggregate-gate`에서 하나라도 미실행·건너뜀·실패 시 FAIL |

## 4. 시각·실사용 검수 기록

- 전체 Android 캡처가 **진짜 앱 UI PNG**인지 여부와 카드 속 사진의 **오프라인 합성 데모** 여부를 분리. 합성 사진을 실제 체형·건강 변화로 광고하지 않습니다.
- Google Drive의 기획 시안은 레이아웃 참고이며, PNG 픽셀 일치 자체가 완료 기준은 아닙니다. 원본 캡처와 실제 기능·문구·UI 크기/잘림을 사람이 검토해야 최종 디자인 등가성 판단 가능.
- 360dp/150% 및 600·750dp의 키보드, 하단 탭 Safe Area, 인트로·설정/계정·모달 스크롤/닫기·저장 취소 버튼, 수치/그래프/영상 화면 별 줄바꿈은 원본 PNG를 직접 보고 **추가 육안 검수** 필요.
- 기기 ARM64 실제 광학 카메라·셔터/기준 사진, 실재 비디오 재생·오디오, 물리 TalkBack 말하기 순서, Google Play 테스트 설치·Firebase 운영·실계정/결제/백업은 자동 x86_64 QA로 PASS라고 할 수 없으며 별도 테스트가 필요합니다.

## 5. 병합 및 배포 게이트

1. 선행 PR #150~#156 각각의 최신 HEAD에서 Quality/Secret Scan/Android QA 및 미해결 코드 리뷰 0건 확인. UI-R03 PR #152의 태블릿 750dp Pixel Launcher ANR 때문에 실패했던 기존 Android run은 실제 재검증이 필요하며 원인을 앱 오류로 단정하지 않음.
2. QA 통합 스냅샷의 Quality/Secret Scan, Android build, 24화면 셀, R00/R01-02/R05/R07 독립 네이티브 QA, 최종 12-job 집계가 같은 HEAD에서 PASS인지 확인.
3. 선행 PR 순차 병합 뒤 `main`의 새로운 SHA로 전체 테스트를 재수행. QA 미완료 또는 선행 PR 미병합이면 UI-R08 병합·Play/Firebase 운영 배포 보류.
4. QA가 끝나면 최신 **실제 앱 캡처**를 기준으로 `STORE-03-C/D` Google Play 설명 이미지 제작/업로드를 별도 승인·점검합니다.

## 6. 결론 기록

현재 문서는 QA 실행 기준이며 CI 통과, 실제 카메라/영상 재생, Play 배포 성공을 사전에 선언하지 않습니다. 실제 결과는 작업 실행 이후 GitHub Actions 원본 아티팩트의 HEAD/PNG/XML/manifest와 함께 기록합니다.

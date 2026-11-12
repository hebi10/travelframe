# TravelFrame UI-R07 — 온보딩·설정·계정·공통 모달 리디자인

작성: 2026-11-11 · 기준 `main@9e6d84cad89b59ae34f0fe45b6117b843de731e9`

## 1. 디자인 근거·범위

- [Google Drive의 기획 시안·최신 Android 화면 차이 분석](https://docs.google.com/document/d/1xtnlzJADQRklccXmln0_my_6CgZJIdrWNemppowD5cs/edit) S08, S09, `UI-R07` 기준.
- Android 우선, 기존 4개 메인 탭, 흑백/회색 디자인, 폰트/Noto Sans KR, Feather 아이콘, 44dp 최소 터치·48dp 주요 CTA, 16dp 좌우 패딩, 상·하단 안전 영역 및 현행 온보딩 단계 유지.
- 변경 대상: `components/app-guide-overlay.tsx`, `features/camera/BodyFrameProjectSwitcher.tsx`, `features/settings/BodyFrameSettingsScreen.tsx`, `features/account/AccountScreen.tsx`, `features/account/account-screen.styles.ts`. UI 관련 수치/영상/사진/백업·결제/앱 저장 기능은 변경하지 않음.
- 선행 PR #150~#155가 아직 main 미병합이므로 **main 기준 독립 브랜치**로 시작. R06의 공통 상태 컴포넌트·Sheet 코드를 이번 PR에 가져오지 않음.

## 2. 화면별 작업

### A. 최초 실행 및 다시 보기 가이드
- 최초 camera welcome에만 전체 화면 도입 화면을 유지하고, 설정에서 다시 보기 할 때는 기존 단계별 팝업을 유지.
- 기기 화면 높이가 720dp 미만이거나 `앱 글자 배율 × Android 시스템 글자 배율 >= 1.3`이면 인물 없는 가이드 일러스트 192→116dp, 본문 수직 간격/패딩을 줄여 스크롤 우선으로 표시.
- `시작하기`·`나중에 보기`는 기존 스크롤 영역 밖의 고정 푸터, 안전 영역, 48/44dp 터치 영역을 유지. 첫 실행 기록/가이드 버전/단계 이동·뒤로가기·건너뛰기 정책 보존.
- TalkBack 제목을 `header`로 표시하고 기존 진행률 안내를 유지.

### B. 새 프로젝트 생성과 키보드
- 새 프로젝트 및 프로젝트 선택 두 네이티브 Modal 구조, 기존 `KeyboardAvoidingView` 및 시트의 별도 본문 ScrollView·하단 고정 `BodyFrameSheetFooter` 유지.
- Android `keyboardDidShow/keyboardDidHide` 이벤트에 맞춰 새 프로젝트 시트의 하단 시스템 여백과 푸터 패딩만 조절. 키보드가 닫히면 원래 Safe Area 여백으로 복귀.
- 100/365/직접 입력 3개 선택지 터치 높이 52→64dp. 이름 40자 제한, 목표 100/365/직접 입력, 기준 사진 첫/최근, 플랜에 따른 생성 가능 수·목표 제한, 프로젝트 저장/실패 메시지·선택값 복구 불변.
- 입력/스크롤 가능 영역과 푸터를 분리하고 `nestedScrollEnabled`를 적용해 키보드 상태에서 더 쉽게 접근.

### C. 설정
- 360·412dp, 합성된 실제 앱/시스템 글꼴 배율 1.3 이상에서는 설정 항목의 현재값이 별도 행에 자리잡도록 `settingRowLargeText`와 `settingRowValueLargeText` 적용.
- 기본 설정 행 52dp, 아이콘·제목·상세 설명, 선택/비활성화·현재값, 6개 설정 그룹 및 항목 이동/저장 경로 유지.
- 큰 글자 환경에서 기존 요약 설명을 2줄까지 허용. 모든 설정 저장 함수·백업 구독 조건·권한·테마/글꼴 저장·기존 모달 닫기 경로 보존.
- 설정 모달은 기존 Safe Area·86% 최대 높이, 스크롤 및 저장 중 안내를 유지.

### D. 계정·구독/백업/삭제 모달
- 로그인/회원가입/찾기 세그먼트의 좁은 폭 및 큰 글자 대응, 제목/현재값/이메일 영역 `minWidth: 0`, 버튼·모달 스크롤 정렬/간격 보정.
- 로그인 이메일·비밀번호 접근성 레이블, 선택 탭 이름, 로그인 및 Google 로그인 중 비활성 접근성 상태, 결과 안내 `accessibilityLiveRegion`을 추가.
- 계정·백업·구독, 구매/복원, 삭제 요청 안내의 실제 동작·법적 링크/문구·가격 및 Google Play Billing 상태는 변경하지 않음.
- 결제 확인 및 데이터 삭제 요청은 기존 두 모달, 별도의 ScrollView와 하단 주요 CTA를 유지. **사용자 데이터 삭제 호출·실제 구매는 QA에서 실행 금지**.

## 3. QA 및 완료 조건

1. `tests/ui-r07-onboarding-settings-modals.test.mjs` 신규: TSX·온보딩 고정 푸터·키보드/입력·설정 큰 글자 줄바꿈·계정 접근성·백업/구독·모달 정책 보존.
2. 기존 Stage 4/7/11/C2/C6/C7/StageC, 키보드/모달/접근성/Play 정책 회귀 테스트를 삭제하지 않고 통과해야 함.
3. 기존 `body-frame-device-qa.yml`의 UI-R07 Stage13 360/412/600/750dp × Light/Dark × 100/130/150% = 24조합 Android API35 x86_64 원본 PNG/UI XML/해시 캡처 및 독립 `ui-r07-visual-verify` 실제 픽셀 검사.
4. 별도 `ui-r07-native-keyboard`: 오프라인 Android API35 360dp 에뮬레이터에서 **시스템 글꼴 150% + 실제 IME 표시** 후 `QA_keyboard_large_font` 프로젝트 입력, 키보드를 물리적으로 내리지 않고 생성 버튼 실행. 원본 PNG/XML/JSON·SQLite 프로젝트 저장 결과 보존.
5. `ui-r07-keyboard-verify` 독립 job에서 APK SHA-256, 720×1600 원본 PNG 해시, 실제 IME 노출, 저장 성공, BACK/드래그 0회 검증. 실패/취소/권한 거절 상태는 기존 네이티브 QA 및 Stage13 근거와 구분.
6. 실제 Android ARM64 실기기·TalkBack 음성 순서·실계정 로그인/구독/복원/권한 설정은 별도 수동 검수. 에뮬레이터·CI 성공을 실제 운영 성공으로 표현하지 않음.

## 4. 안전한 병합

- 최신 HEAD 기준 Quality(TypeScript, ESLint, Node 전체, Android Gradle/Manifest, Firebase Rules·Functions), Gitleaks Secret Scan, APK 빌드, 24환경 캡처 및 독립 150% 키보드/시각 QA, 코드 리뷰 미해결 0건까지 검증.
- 선행 PR #150 → #151 → #152 → #153 → #154 → #155가 모두 최신 main에 안전 병합된 후 파일 충돌·수정된 컴포넌트·상태·Safe Area 재검증하고 UI-R07 검토. PR 병합만으로 구글 플레이 업로드 주장 금지.
- Google Play AAB 배포·Firebase 운영 배포·키/토큰/결제/광고·기기 데이터 삭제/사진 원본·MP4 인코더·실기기 권한 변경 없음.

## 5. 다음 단계

`UI-R08` — 전체 화면·기능 통합 QA. 최종 동일 HEAD의 Android 24환경, 사용자가 제공한 디자인 기획/실제 PNG 비교, 실기기 미검증 항목과 Google Play 스토어 자산 동기화 여부를 따로 보고.

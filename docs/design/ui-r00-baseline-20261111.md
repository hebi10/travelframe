# UI-R00 — 최신 기준 화면·데이터 QA

기준일: 2026-11-11 KST

## 목적과 경계

- 고정 기준 소스: `main@9e6d84cad89b59ae34f0fe45b6117b843de731e9`.
- 앱: 바디 프레임 / `com.haebi.photoguide` / Expo·React Native Android.
- 최신 이전 기준: STORE-03-B Android QA 36/36 성공, PR #148, Android run #42957038527. 캡처 APK 소스는 `3282dc13...`이므로 PR #149 비교 화면 제스처 변경 전의 UI 자료입니다.
- 이번 UI-R00은 앱의 화면·상태·실제 캡처 증거의 **기준선 확정**만 수행합니다. 촬영·비교·영상·수치·결제·Firebase·Health Connect·개인 사진과 Android 앱 런타임 코드는 변경하지 않습니다.
- 독립 QA 브랜치의 변경 파일은 `scripts/capture_ui_r00_baseline.py`, `scripts/ui_r00_data_fixtures.py`, `scripts/verify_ui_r00_baseline.py`, `scripts/test_ui_r00_baseline.py`, `tests/ui-r00-baseline.test.mjs`, 이 문서, QA Actions 워크플로에 한정. CI에서 고정 `main`과의 git diff를 검사합니다.
- QA 전용 가상 인물 사진 3장(`BODY_FRAME_STORE_DEMO_FIXTURES=1`)은 실제 신체 변화·건강 효과가 아닙니다. OS 네트워크를 끈 일회용 에뮬레이터의 앱 내부 임시 저장소에만 넣습니다. 물리 기기·사용자 갤러리나 클라우드에 기록하지 않습니다.

## Android 캡처 범위

- 프로필: 360dp 휴대전화(720×1600), 412dp 휴대전화(824×1832), 600dp 태블릿(900×1600), 750dp 태블릿(1125×1800).
- 테마: 각 프로필에 다크/라이트 100%. 130/150% 폰트까지 합한 24개 조합은 후속 UI-R08 통합 검증에 남겨둡니다.
- 기본 10종: 촬영, 기준 사진 조절, 기록/프로젝트 목록, 프로젝트 상세, 전후 비교, 전체 수치 기록, 영상 홈, 영상 만들기, 설정, 계정. 4 프로필 × 2 테마 × 10종 = 80장.
- 추가 상태(412dp 두 테마): 프로젝트 0개, 프로젝트 1개·사진 0장, 사진 1장, 사진 12장, 프로젝트 3개·사진 9장, 빈 영상 목록, 비로그인 계정, 최초 온보딩, 새 프로젝트 생성 모달, 카메라 권한 거부. 2 테마 × 10종 = 20장.
- **목표 총 100개 Android 실제 PNG**. 예정과 성공을 혼동하지 않습니다. `ui-r00-baseline-verification.json`에서 기대/실수집/실패와 동일 APK SHA·PR HEAD·기준 main·화면 XML/JSON·PNG SHA-256을 확인한 후 통과 여부를 확정합니다.

## 상태별 검증 및 보호 규칙

1. 기존 `qa.fixture_values`가 생성한 앱 내부 JSON 저장 스키마를 복제하고 상태에 따라 프로젝트·사진·수치 데이터만 안전하게 변형합니다. 기존 기본 QA 1·2·3 번호 사진·MP4 검증 로직은 수정하지 않습니다.
2. 모든 이미지 경로는 `file:///data/user/.../com.haebi.photoguide/` 앱 사유 경로이며 가상 데모 자료입니다. `ro.kernel.qemu=1`이 아니면 실행을 거부합니다.
3. 상태 주입 후 에뮬레이터 내부 SQLite를 재조회하여 프로젝트·사진·수치·영상 개수가 기획한 값과 일치하는지 비교합니다. 이미지 파일은 `run-as` 앱 사유 경로에만 작성합니다.
4. 각 실제 화면은 `screencap -p`에서 추출한 PNG와 Android 네이티브 UI XML 및 JSON을 함께 보관합니다. 흑백 단일색 화면은 FFmpeg 픽셀 검사 실패 처리하고, 캡처 실패도 `.failure.png`로 보존합니다.
5. 한 장이라도 누락되거나 원본 해시, 기기 폭, 앱 APK, 임시 데이터 상태가 다르면 통합 검증은 FAIL입니다. PASS를 이전 PR의 아티팩트로 대체하지 않습니다.

## 시안 대비 상태 평가

- **촬영**: 이전 에뮬레이터에 '카메라를 찾는 중' 안내. 정상 카메라 프리뷰·실제 셔터 성능은 UI-R02에서 물리 Android로 확인해야 합니다.
- **기록/프로젝트**: STORE-03-B는 프로젝트 1개·사진 3장만 있어 빈/1장/다수 데이터 위계를 판정하기 어려웠습니다. 이번 UI-R00이 수량별 실제 렌더링 기준선을 확보합니다.
- **전후 비교**: PR #149의 `PanResponder` 수평 우선 판별 코드는 최신 main에 병합되어 있으나 위아래 스와이프 실제 인식·상위 스크롤 연동은 UI-R01의 동적 제스처 검증 대상입니다. 정적 검사와 단순 PNG를 실제 터치 동작 증명으로 표현하지 않습니다.
- **수치**: 4개 지표·기간 필터·차트 정보 위계와 0/1/다수 기록을 구분하고, 실제 값 계산 및 Health Connect는 변경하지 않습니다.
- **영상**: 영상 목록의 빈 상태와 정상 UI의 간격·CTA만 기준선에 포함합니다. 실제 MP4 생성·보관 성공은 UI-R05 별도 검증이 필요합니다.
- **설정/계정/온보딩**: 비로그인·최초 실행·새 프로젝트 모달 상태 확보. 결제, 백업, 로그인, 데이터 이전, 권한 UI의 실제 기기 동작은 별도 검증입니다.
- **R0 시안**: 라이트/다크 7화면은 AI 제작 디자인 방향 참고이며 실제 기능/사용 데이터의 근거가 아닙니다. 시안의 별도 홈 탭·라임 대형 CTA·가상 수치/Pro 상태는 UI 결함 목록에 포함하지 않습니다.

## 작업 후 판정 및 후속

- QA 워크플로: `.github/workflows/body-frame-device-qa.yml`의 `ui-r00-captures` 네 프로필 매트릭스와 `ui-r00-verify` 통합 검사. PR에 한해 실행하며 Play push-gate, 서명 AAB, 운영 Firebase는 실행하지 않습니다.
- 최종 증거: 실제 Actions run URL, 각 4개 ZIP·Android PNG/XML/JSON 및 집계 JSON, 이전 STORE-03-B 36장과 차이표, Google Drive 보고서. 생성 시점에 성공 전에는 상태를 **검증 중**으로 표시합니다.
- P0: UI-R01 — 비교 영역 좌우 드래그·상하 스크롤의 실제 터치 제스처 및 확대/3모드 QA.
- P0: UI-R02 — 카메라 정상 연결·기준 사진·셔터·권한·저장 실기기 QA.
- P1: UI-R03~R05 — 기록·프로젝트·수치·영상 정보 구조 개선 및 정상 영상 결과 확보.
- P1/P2: UI-R06~R07 — 공통 타이포·아이콘·온보딩·설정/시트 마감.
- P0: UI-R08 — 24개 테마·글꼴·화면폭 조합 및 실기기/접근성 통합 검증.
- STORE-03-C/D — 검증된 실제 Android UI 화면 기반 스토어 이미지 6~8장 편집 및 Google Play API 등록·읽기 검증.

## 근거 URL

- 최신 기획·화면 차이 분석: https://docs.google.com/document/d/1xtnlzJADQRklccXmln0_my_6CgZJIdrWNemppowD5cs/edit
- STORE-03-B 원본 및 36장 성공 검증: https://drive.google.com/drive/folders/1UunG42VNaGTmH_8VjED8hG3ahY6BtQwh
- STORE-03-A 원본: https://drive.google.com/drive/folders/1zu52WLYrVSspjJVqO68sucGERq8X720p
- R0 디자인 시안: https://drive.google.com/drive/folders/1npiaItT70Z44SZbj4wfCnrHQYNWWWrub
- 앱 원본: https://github.com/hebi10/travelframe

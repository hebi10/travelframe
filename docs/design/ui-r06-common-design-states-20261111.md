# TravelFrame UI-R06 — 공통 타이포·아이콘·상태 안내 보정

기준: 2026-11-11 · 시작 `main@9e6d84cad89b59ae34f0fe45b6117b843de731e9`.

## 1. 디자인 기준 및 변경 범위

- [Google Drive R0 기획 디자인·실제 Android 화면 비교와 UI-R00~08 개선 계획](https://docs.google.com/document/d/1xtnlzJADQRklccXmln0_my_6CgZJIdrWNemppowD5cs/edit)의 UI-R06 범위: 이미 적용된 중성 팔레트 유지, 탭 아이콘 의미, 보조 글자 대비, 큰 글씨, 44dp 버튼, 하단 Safe Area, 기능별 상태 표현.
- 기존 `docs/design/body-frame-r0-frame-journal-20261108.md`의 Frame Journal 디자인 기준과 `constants/app-theme.ts`의 16dp 화면 여백 / 44dp 최소 터치 / 48dp 주요 CTA / Feather 아웃라인 / 4탭 구조 유지.
- 선행 PR #150(기준 화면), #151(제스처/카메라 QA), #152(기록 상세), #153(수치 기록), #154(영상)이 모두 main 미병합이므로 현재 main에서 **독립 PR**로 보정. R03·R04·R05 소스 변경 파일과 충돌을 피하도록 공통 컴포넌트·탭·별도 상세/비교 상태에 한정.
- 계정·설정/온보딩·시트 내용 전체 리디자인은 UI-R07 범위. 기존 미반영 기능·데이터 모델·원본 시안의 허구 기능 추가 금지.

## 2. 반영 사항

### 상태 색상
- 기존 `bodyFrameStatusColors.success = bodyFrameAccent`를 분리해 라이트 상태 success/warning/error `#147344/#965600/#B42335`, 다크 `#7AD6A1/#F4C16C/#FF9199` 적용.
- `getBodyFrameStatusColors(palette)`에서 테마를 구분하고, 배경·표면 양쪽 기준 텍스트 대비 **4.5:1 이상**을 회귀 테스트로 검증. 일반 CTA는 기존 `getBodyFrameControlColors`의 중성 색상 사용.
- 건강·사진/수치 증가/감소의 자동 성공·실패 평가에는 사용하지 않음.

### 아이콘과 글자
- 4개 하단 탭(촬영/기록/영상/설정), 계정 숨김 라우트 고정. `TabGlyph.video`의 유튜브 서비스 연상 아이콘을 기능형 `film`으로 변경. 선택 상태는 기존 밑줄·텍스트 대비 유지.
- 탭 레이블 글자 기준을 11dp → `bodyFrameTypography.caption` 12dp로 통일하고, 사용자 글꼴 설정 × Android 시스템 100/130/150%의 실제 크기 증가에 맞춰 하단 탭 행 높이를 확대.
- `ScreenShell`은 같은 추가 탭 레이블 높이를 하단 콘텐츠 예약 공간에 반영. 시스템 Safe Area/글꼴·폰트 패밀리/세부 간격 설정 유지.

### 로딩/빈 상태/오류 및 시트 버튼
- `components/body-frame-status-notice.tsx` 신규: 로딩 인디케이터, 빈 상태 inbox, 오류 alert-circle, 글자/보조 설명·선택적 실제 액션 버튼. 누를 수 없는 장식성 버튼은 생성하지 않음.
- Android 화면 판독기 `accessibilityLiveRegion`은 로딩·빈 상태 polite, 오류 assertive. 오류 아이콘은 semantic error 색상, 본문은 중성 대비를 유지하며 색상만으로 의미를 전달하지 않음.
- 전후 비교 `BodyFrameCompareScreen`: 기존 사진 2장 미만/선택한 사진 사라짐/로딩 실패 메시지 보존하면서 공통 상태 안내 적용. 슬라이더 드래그·제스처·사진 변경/순서/모드/접근성 기능 변경 없음.
- 영상 상세 `app/video/[id].tsx`: 로딩/영상을 찾을 수 없음/실제 읽기 실패를 구분하고 보관함으로 돌아가는 실제 액션 제공. 기존 `VideoPlayerFrame`·로그인 후 편집·영상 메타·재생 코드 유지.
- 공통 `BodyFrameSheetFooter`: 취소/확인 접근성 이름 명시, 확인 비활성 `accessibilityState` 및 기존 제어·높이 보존.

## 3. 자동·실제 QA 기준

- 기존 Stage 1/6/7/11 디자인, Safe Area, 사용자 설정/폰트, 색 대비, 비교·영상 상세/시트, 회귀 테스트를 보존. 변경된 옛 정적 기준은 새 명세에 맞추되 기존 기능 검증을 삭제하지 않음.
- 신규 `tests/ui-r06-common-design-states.test.mjs`: 7개 소스 TSX 구문, 상태 색상의 라이트/다크 수치 대비 4.5:1, 4탭 의미·44dp 최소 크기·하단 여백, 에러/빈 상태/로딩, 비교/영상 플레이어·시트 동작, 기존 4폭 QA 계약 확인.
- GitHub Actions `stage13-design-captures`: 실제 API35 Android 360/412/600/750dp × Light/Dark × 100/130/150%=24기본 조합에서 기존 카메라/기록/비교/영상/설정/계정 화면 PNG·XML·JSON 생성. `ui-r06-visual-verify`가 원본 해시·다크/라이트 픽셀·수정 화면·매트릭스를 독립 검증. CI가 캡처만 제출하면 완료로 판정하지 않음.
- 실제 비교 상태의 사진 0/1/2장·에러, 영상 누락/읽기 실패, 360dp 150% 텍스트 래핑, 폴더블/태블릿, 물리 TalkBack 순서·장시간 시나리오는 구분해 검수. Android 스크린샷만으로 실제 실기기 접근성·사용자 영상 재생은 PASS 주장 금지.

## 4. 병합·배포 게이트

1. 최신 PR HEAD의 Quality(TypeScript·Lint·Node·Firebase Rules/Functions·Android Kotlin/Manifest), Secret Scan, Android 네이티브 APK 빌드·4폭 캡처 및 24조합 독립 readback이 모두 PASS, 코드 리뷰 미해결 지적 0건.
2. PR #150 → #151 → #152 → #153 → #154의 실제 QA와 순차 병합 이후 latest main 기준 충돌·버튼/상태 회귀를 확인한 뒤 UI-R06 안전 병합.
3. Google Play/Firebase 운영 게시·수익/플랜·Health Connect·사진/측정/MP4·백업·권한 정책 및 실제 사용자 데이터 변경하지 않음.

## 5. 다음 작업

- `UI-R07`: 최초 실행/온보딩, 새 프로젝트·설정·계정·공통 시트/권한 경고의 디자인 및 150%·키보드/모달 QA.
- `UI-R08`: 최종 동일 HEAD 통합 Android QA, 24환경 및 실기기 PENDING·스토어 정합성 보고.
- `STORE-03-C/D`: 실제 Android 최종 UI PNG 기반 Google Play 설명 이미지 제작 및 운영 트랙과 분리된 게시 검증.

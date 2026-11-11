# TravelFrame UI-R04 — 수치 기록·그래프 가독성 리디자인

기준: 2026-11-11 · base `main@9e6d84cad89b59ae34f0fe45b6117b843de731e9`

## 1. 근거 및 작업 범위

- [Google Drive R0 시안·Android 실제 캡처 차이 분석](https://docs.google.com/document/d/1xtnlzJADQRklccXmln0_my_6CgZJIdrWNemppowD5cs/edit)의 S06 · UI-R04 계획.
- 기존 `docs/design/body-frame-r0-frame-journal-20261108.md`와 `docs/design/body-frame-stageA-density-20261107.md`의 사진/수치 보존·흑백 디자인 토큰·360/412/600/750dp 기준.
- `BodyMeasurementHistoryScreen.tsx`와 `body-measurement-summary-card.tsx`의 **표시와 접근성**만 변경. `lib/body-measurement-series.ts`, `body-measurement-period.ts`, Health Connect/저장·편집/삭제·프로젝트/계정·결제·Firebase·Play 로직 변경 없음.
- 선행 QA PR #150, #151과 UI-R03 PR #152가 별도 미병합이므로 독립 `main` 브랜치에서 작성. 이전 PR의 완료나 Android 결과를 가정하지 않음.

## 2. 구현 내용

### 수치·그래프 카드

1. 기존 측정 지표(몸무게·체지방률·골격근량·허리둘레), 선택 지표의 값과 단위를 유지.
2. `compact` 요약에서는 시작 대비 변화량을 별도 행으로 배치. **색상만으로 증가·감소를 평가하지 않고 부호와 단위로 표현**.
3. 같은 기간에 포함된 그래프 데이터의 최저·최고 값을 지표 단위와 함께 표기. 이는 새 계산 결과 저장이 아니라 이미 필터링된 시계열의 표시값.
4. 차트 아래 시작/최근 실제 날짜(Asia/Seoul)와 원래 수치를 2열로 표시. 스크린리더에는 지표·시작·최근·개수 정보를 명시.
5. 기존 92dp 경량 View 기반 Sparkline, 수치 계산·사진 기록 순서, 단일 기록·빈 기록 상태 및 프로젝트 상세의 일반 카드(`compact=false`) 동작 유지.

### 필터와 기록 목록

1. 기록 지표와 조회 기간에 짧은 그룹 레이블 부여. 기간 버튼 44dp 이상 유지, 더 읽기 쉬운 기본 본문 글자 적용, 4개 기간 선택 그대로 유지.
2. 시작·현재·변화·기록 4개 요약은 휴대전화에서 2열, 콘텐츠 너비 560dp 이상에서는 4열로 표시. 시작·현재 카드에는 실제 측정 날짜의 월/일을 표시.
3. 수치 기록 행에서 값과 단위를 구분하여 표시하고 누르면 해당 기록을 수정하는 전체 날짜·단위 접근성 레이블 추가.
4. 기록 메타는 글꼴 150%에서 최대 2행으로 읽을 수 있도록 확대. 기존 사진 바로가기, Health Connect 연결/가져오기, 수치 추가·수정·삭제와 회귀 검증 보존.

## 3. 검증

- `tests/ui-r04-measurements-chart.test.mjs`: TSX 구문, 기존 데이터 필터/시계열 경로, 요약/단위/날짜/값, 반응형 규격, 44dp 버튼/접근성, 보안·스타일·배포 미변경 계약 검사.
- 기존 Stage 9-4, 9-6, A, 14, C7 회귀 테스트와 TypeScript/ESLint/전체 Node 테스트 실행.
- `body-frame-device-qa.yml`에서 `ui/ui-r04-*` PR에 Stage13 Android API35 4화면 폭 × Light/Dark × 100/130/150% = 기본 24 조합 캡처를 활성화하고, 별도 `ui-r04-verify`에서 원본 PNG/XML·SHA·UI 접근성·테마 픽셀 검증. 실제 통과 수는 각 CI 아티팩트의 요약으로 판단.
- 반드시 360dp 150% 지표/기간 버튼·숫자·단위 겹침, 600·750dp 4열 카드, 빈/단일/다수 데이터, 1/3/6개월/전체 기간의 표시 일관성과 월말·연말 날짜를 실제 에뮬레이터/실기기에서 확인.
- 실제 ARM64·TalkBack·Health Connect 실계정·데이터 수정·네트워크/Play/결제 결과는 검증 증거 없이 PASS로 표기하지 않음.

## 4. 병합·배포 안전성

1. Quality·Secret Scan·Android 빌드·4환경 캡처 및 독립 통합 24조합 검증 통과 전 `main` 병합 금지.
2. 선행 PR #150 → #151 → #152의 병합·QA가 완료된 경우 최신 `main`과 충돌/차이를 재확인한 뒤 #153을 안전하게 검토. 앱 로컬 사진·측정 데이터 삭제나 코드 외 정책 업데이트 금지.
3. 릴리스 AAB/Google Play 업로드, Firebase 운영 배포, 청구/광고/Health Connect·키·토큰 작업 없음.

## 5. 다음 단계

- UI-R05: 영상 홈·생성·보관함, 실제 MP4 출력·보존 QA.
- UI-R06~08: 공통 타이포/아이콘·설정/온보딩, 24환경 최종 Android QA.
- STORE-03-C/D: 정확한 UI HEAD의 실제 Android PNG 기반 Google Play 설명 이미지 최신화·재조회.

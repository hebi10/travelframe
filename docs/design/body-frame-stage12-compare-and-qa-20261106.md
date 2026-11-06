# TravelFrame 디자인 Stage 12 — 전후 사진 비교 정밀 보정

기준: 2026-11-06 / `main@a3175a3155f9b17fe80f314aa5220628adb9c7c1`

## 변경 기준
- Google Drive 원본 [화면별 디자인 가이드](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view) 비교 화면의 중앙 제목·사진 우선 구성.
- 기존 Stage 10 프로젝트/기록 3개 탭 및 Stage 11 영상·설정·하단 탭 코드는 유지.
- 변경 범위는 `features/records/BodyFrameCompareScreen.tsx`의 시각적 레이아웃만. 사진 원본, 비교 대상 정렬, 저장값, PanResponder, 접근성 증감, 25/50/75% 프리셋은 불변.

## 변경
1. 상단 뒤로가기 텍스트 대신 44dp 접근성 레이블을 유지한 화살표 버튼, 독립된 중앙 제목.
2. Safe Area를 보존하며 상단과 콘텐츠의 불필요한 간격을 축소. 프로젝트명은 작은 중앙 캡션으로 보존.
3. 큰 화면의 비교 이미지·사진 레이블·날짜·비율 버튼을 공통 최대 너비 520dp로 정렬, 휴대폰은 가능한 가로 공간을 사용.
4. 헤더와 미리보기 구조만 변경하며 슬라이드/사진 크롭/영상 생성/결제/백업/서명키 및 Play 워크플로 변경 없음.

## 검증과 남은 과제
- `tests/body-frame-design-stage12-compare.test.mjs`에서 구조·비교 슬라이더·접근성 계약 검사.
- 필수 CI: TypeScript, ESLint, 전체 Node tests, Android Manifest/Kotlin, Firebase Rules/Functions, Secret Scan.
- 네이티브 Android 캡처에서 360/412/600/750dp, 다크/라이트·시스템 글자 확대 시 헤더·전체 사진·하단 버튼을 확인. CI synthetic fixture는 실사진 품질을 증명하지 않음.
- 실제 인물 사진의 원본 가로세로비·비교 위치, TalkBack 읽기 순서, 폴더블 및 작은 기기에서 하단 CTA 겹침, 모든 모달·빈 상태 재검수.
- 기존 영상 편집물 재편집 프레임·음악·저장 동등성, 실제 카메라/백업/결제 복원/Health Connect/AdMob 검증은 별도 기능 QA.
- 2026-11-07 11:01 KST 이후 신규 업로드 키 유효. Play 등록 인증서와 GitHub Secret 서명키 일치 확인·명시적 승인 전 자동 업로드하지 않음.

완료 기준: 코드 CI 성공과 실제 Android 이미지 QA를 각각 증빙하고, 실제 시안과의 수동 대조 결과를 별도 기록.

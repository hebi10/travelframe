# Body Frame 디자인 통합 Stage 3 — 영상·설정·계정 UI

- 작성: 2026-11-05 (KST)
- 기준: `feat/body-frame-design-stage2-records-20261105@84cb0d01acae48c1437f07c6b657747ed00bd1a3`
- 변경 방식: Stage 2 브랜치 위 **스택형 PR**, Stage 1/2가 `main`에 병합되기 전 Stage 3 단독 병합 금지.
- 목표: 디자인 가이드의 블랙·그레이/흰 CTA·썸네일 중심 정보 구조를 영상·설정·계정에 동일하게 적용. 기능 로직은 보존.

## 변경 파일과 범위

| 화면 | 적용 내용 | 기능 보존 |
| --- | --- | --- |
| `BodyFrameVideoHomeScreen.tsx` | 주요 '영상 만들기' CTA를 공통 `getBodyFrameControlColors`로 통일. 프로젝트 최근 사진 썸네일·영상 커버 크기 확대, 재생 표시, 프로젝트 선택의 접근성 설명 | 프로젝트 선택/저장 ID, 주간 비로그인 한도, 영상 목록 링크 |
| `BodyFrameVideoScreen.tsx` | 영상 미리보기·사진 수/예상 시간 안내와 '영상 설정' 섹션 구분. 6개 설정 옵션의 동적 chevron 및 현재값·설정 접근성 개선, 좌측 뒤로가기 벡터화, 고정 출력 CTA 공통색 통일 | `TripClipRecordingCanvas`, native recording, 앨범 저장 재시도, 진행률·오류/성공 하단 피드백 유지 |
| `BodyFrameVideoLibraryScreen.tsx` | 썸네일 폭과 높이 확대, 재생 표시·작품 이름 접근성, 상세/삭제 48dp 버튼 높이, 삭제 중 상태 전달, 빈 화면 Primary CTA 통일 | 저장 영상 열기·삭제 확인·반환·재생 |
| `app/video/[id].tsx` | 26sp 페이지 제목, 영상 플레이어 최대 너비, 썸네일 비율 보존, 재생 48dp 아이콘 버튼, 메타정보·재편집·뒤로가기 48dp·8dp 규격 | `expo-video`/플레이어, 로그인 확인, 레거시 재편집 이동·데이터 보존 |
| `BodyFrameSettingsScreen.tsx` | 6개 설정 그룹 유지. 행 높이·줄바꿈·현재값 표시·Chevron 정렬, 선택색상 토큰 사용, 각 설정의 선택 가능 상태 가독성 개선 | `saveAppSettings`, 테마·글꼴·크기·카메라·백업·약관·고급 설정 동선 |
| `AccountScreen.tsx` & `account-screen.styles.ts` | 로그인/결제 등 주요 CTA만 흰색/검정 시맨틱 `primaryFill`로 분리. 로그아웃은 보조 버튼으로 축소, 계정 프로필·백업·플랜 카드 간격·최소 48dp·반경 통일. 백업 슬롯 관리 영역은 백업 섹션 다음으로 이동 | 인증·계정 삭제 안내·Firebase/Google Play Billing 확인/구매 복원·백업 데이터·법적 문구 변경 없음 |
| 테스트 | `tests/body-frame-design-stage3.test.mjs` 추가, 기존 `tests/app-font-family-propagation.test.mjs` 계약 조정 | 공통 폰트 사용 및 기존 API 동작 유지 |

## 디자인 규격

- 다크 배경 `#0B0B0C`, 카드 `#131315`, 텍스트 `#F5F5F5`; Primary CTA: `palette.text`, 대비 텍스트 `palette.inverse`.
- 진행·성공용 라임색 `bodyFrameAccent`는 일반 CTA에서 사용하지 않음. 기능/플랜 제한 상태는 내용과 형태로도 표시.
- 공통 간격: 좌우 16dp, 콘텐츠 최대 750dp, 주요 버튼 48dp, 터치 최소 44dp, 카드/버튼 반경 8dp, 기본 글꼴 Noto Sans KR (기존 저장 설정 존중).
- 모바일/태블릿 동시 검증, 작은 글씨/시스템 글꼴 확대, TalkBack 라벨·선택 상태·색상 대비 체크.
- 프로젝트/영상 썸네일은 기존 사용자 사진 URI만 사용, 새 외부 사진·이미지 자동 다운로드 없음.

## 품질 및 배포 게이트

- [ ] TypeScript, lint, npm 전체 테스트 (Stage 1/2/3 회귀 포함)
- [ ] Firebase Rules, Functions, Android Manifest/Kotlin
- [ ] Secret Scan
- [ ] Android 네이티브 QA / 화면별 캡처 비교 (360/412/600/750dp, 다크·라이트, 길어진 제목, 프로젝트/영상 0·1·다수, 구독·비로그인)
- [ ] 실제 Google Play 로그인/구독·백업 복원·영상 출력 회귀를 실기기에서 검증

**금지/보류:** `main` push가 Play 내부 테스트 자동 배포를 유발함. 기존 업로드 서명키가 복구되지 않았으므로 PR을 `main`에 병합하거나 Play 업로드를 실행하지 않는다. Stage 4는 전 모달·바텀시트의 키보드/스크롤/푸터 최종 정리에 한정.

참고:
- [Stage 1 PR #84](https://github.com/hebi10/travelframe/pull/84)
- [Stage 2 PR #85](https://github.com/hebi10/travelframe/pull/85)
- [Drive 단계별 실행 계획](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit)
- [디자인 가이드 원본](https://drive.google.com/drive/folders/1PONsfe-LI9nJHSuTOOM_N_UsdJAk1yX1)

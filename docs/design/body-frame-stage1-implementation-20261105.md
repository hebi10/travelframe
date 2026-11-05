# Body Frame 디자인 통합 Stage 1 — 공통 토큰 및 컴포넌트

- 기준: `main@2f1189fc9ba570b2224e6b1cfd2fe3d76a3fd846`
- 단계 기준: [Stage 0 디자인 정책](https://github.com/hebi10/travelframe/blob/docs/body-frame-design-stage0-20261105/docs/design/body-frame-stage0-baseline-20261105.md) (PR #83 미병합 상태이므로 이 문서도 동일 정책을 적용)
- 범위: **공통 토큰·시트·온보딩 CTA·하단 탭·공통 섹션/행·뒤로가기 아이콘·최소 터치 영역**
- 제외: 사진/영상 원본, 프로젝트·수치 데이터, 구독/결제, 백업/복원, Health Connect, Play 배포, 레거시 영상 출력 렌더링

## 변경 내용

| 파일 | 내용 |
| --- | --- |
| `constants/app-theme.ts` | 기존 다크 팔레트·`bodyFrameAccent`는 그대로 두고 성공/경고/오류 의미 색상과 `getBodyFrameControlColors(palette)` 추가. `bodyFrameDesign.iconSize=20` 통합 |
| `components/body-frame-sheet.tsx` | 모든 공통 시트의 **저장/적용 CTA = palette.text / inverse**, 취소 CTA = surface/line; 48dp 및 44dp 기준 보존 |
| `app/(tabs)/_layout.tsx`, `components/tab-glyph.tsx` | 활성 탭을 다크 흰색·라이트 검정으로 통일하고 기존 4탭/숨김 계정 유지. 아이콘 크기 20dp 토큰 적용 |
| `components/app-guide-overlay.tsx`, `components/app-guide-card.tsx` | 환영/도움말 CTA를 공통 주요 버튼 색상으로, 주요 버튼 최소 높이 48dp 및 모달 radius 토큰 반영 |
| `components/section-block.tsx`, `components/action-row.tsx` | `AppText`에서 이미 처리하는 글자 확대 배율을 한 번 더 계산하던 중복 제거. 섹션 18sp, 행 14sp, 캡션 12sp, 최소 터치 44dp 적용 |
| `components/screen-shell.tsx` | 기본 제목 26sp 기준/선택 글꼴 유지, 뒤로가기 문자를 Feather chevron 아이콘으로 통일 |
| `features/account/account-screen.styles.ts` | 음악 삭제 버튼 최소 터치 높이 40→44dp |
| `tests/settings-appearance-propagation.test.mjs` | 공통 `AppText`의 단일 글자 크기 배율 계약으로 갱신 |
| `tests/body-frame-design-system-stage1.test.mjs` | 다크/라이트 주요 버튼·선택 탭 대비 4.5:1 이상, CTA/탭/시트/타이포/터치/4탭·숨김 계정 회귀 검사 |

## Stage 1 디자인 규칙

- 기본 배경 #0B0B0C, 표면 #131315 / #1A1A1D, 텍스트 #F5F5F5, 선 #2A2A2E 유지.
- 일반 주요 CTA·탭 선택은 `palette.text` 기반(다크에서는 오프화이트, 라이트에서는 블랙). 텍스트는 `palette.inverse`를 사용.
- 기존 `bodyFrameAccent = #C6FF4D`는 현재 앱의 진행률·상태 등과 호환 유지. 일반 CTA의 라임색은 각 화면을 수정하는 Stage 2·3에서 안전하게 분리하며 **전역 무조건 치환하지 않는다**.
- 폰트 Noto Sans KR 기본, 기존 사용자의 5종 저장 폰트 설정과 글자 크기 유지. Pretendard 설치·디자인 기능 추가 없음.
- 기본 CTA 48dp, 작은 버튼 44dp, 화면 좌우 16dp, 최대 너비 750dp, 시트 반경 12dp 유지.
- 구독/백업/카메라/영상 렌더링 로직은 불변.

## 검사 및 후속

- 자동: `npm run typecheck`, `npm run lint`, `npm test`, `npm run release:verify`, Firebase/Android GitHub Actions (PR 기준).
- 실제 화면: 360dp/412dp, 600dp/750dp, 다크/라이트, 앱 글씨 3단계+시스템 100/130/150%에서 CTA 겹침·색 대비·터치·모달 스크롤 검사.
- **Stage 1 미포함**: 페이지별 직접 작성된 라임 CTA, 사진/비교/수치 세부 레이아웃(Stage 2), 영상·설정·계정 페이지(Stage 3), 전 모달 레이아웃(Stage 4), 레거시 색상(Stage 5), 에셋·전 화면 QA(Stage 6).
- `main` push는 현재 Play 테스트 자동 배포를 유발하므로 **서명키 복구 전 병합 금지**. PR은 배포 없는 브랜치 검증만 수행.

참고: [Stage 0 PR #83](https://github.com/hebi10/travelframe/pull/83) · [릴리스 보호 PR #80](https://github.com/hebi10/travelframe/pull/80) · [디자인 기준 Google Docs](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit)

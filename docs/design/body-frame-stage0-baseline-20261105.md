# Body Frame 디자인 통합 — Stage 0 기준 고정

> 조사일: 2026-11-05 (KST) · 대상 저장소: `hebi10/travelframe` · **기준 `main`: `2f1189fc9ba570b2224e6b1cfd2fe3d76a3fd846`**
>
> **상태: Stage 0 정적 인벤토리·디자인 정책 수립 완료.** 앱 기능·스타일·Play 배포를 변경하지 않은 문서 작업이다. 화면별 픽셀 일치 또는 실기기 최종 QA를 완료했다는 뜻이 아니다.

## 1. 고정된 원본과 우선순위

| 기준 | 링크 및 적용 원칙 |
| --- | --- |
| 디자인 주 가이드 | [바디 프레임 피트니스 앱 디자인 가이드](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view) — **화면 구성·정보 위계·핵심 조작**의 기준 |
| 디자인 보조 가이드 | [앱 디자인 시스템](https://drive.google.com/file/d/124i6p8cCW1vxM_2N2H321fw4L9QZsNqK/view), [다크 UI 디자인 시스템](https://drive.google.com/file/d/19Kh11wAzwNoc-Cfpjjhbtqezk1S7bqfG/view) — 공통 컴포넌트 및 참고 색·타이포 |
| 이미지 소스 | [개별 UI 에셋 142개 ZIP](https://drive.google.com/file/d/1Dj_7bSnoY_7WMz3aLNSuNmMEuICZMybb/view), [에셋 미리보기](https://drive.google.com/file/d/1jk_ivD-1eSicDTETI2w7xD4MnNH1satf/view) |
| 작업 순서 | [Drive 단계별 실행 계획](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit) — 0→7단계 |
| 현재 앱 구현 | `main` SHA 위 고정. 실제 `app/`, `features/`, `components/`, `constants/`와 테스트를 기준으로 변경 |
| 이미 반영된 작업 | [PR #82](https://github.com/hebi10/travelframe/pull/82) 머지됨. 헤더·푸터, 상세·모달 1차 개선은 **중복 재구현하지 않음** |
| 병렬 릴리스 작업 | [PR #80](https://github.com/hebi10/travelframe/pull/80) 별도 진행. 디자이너 PR에 서명·Play 발행 코드를 혼입하지 않음 |
| 레거시 미완료 | [Issue #73](https://github.com/hebi10/travelframe/issues/73) 및 [PR #72](https://github.com/hebi10/travelframe/pull/72) — 선택적으로만 참조 |

**출처·순위 정책:** 디자인이 달라도 **사용자 데이터, 저장 구조, 구독 권한, 카메라 촬영/영상 렌더링 동작, Play 서명**은 기존 기능을 보존한다. 가이드 시안에 등장한 샘플 수치·가격·사진·플랜 한도는 제품 실제 값으로 간주하지 않는다.

## 2. 디자인 결정 레지스터 (Stage 1~6 적용 기준)

| ID | 실행 기준 | 현재 구현과의 차이 및 처리 시점 |
| --- | --- | --- |
| D01 · 색상 | 블랙·회색·흰색 중심. 기본 다크 `#0B0B0C`, 표면 `#131315`, 강조 표면 `#1A1A1D`, 텍스트 `#F5F5F5`, 보조 `#A0A0A6`, 구분 `#2A2A2E` | `constants/app-theme.ts`의 현재 Body Frame 다크 토큰을 **기준점**으로 사용. 라이트·시스템 모드도 기존 지원 유지 |
| D02 · CTA | 주요 CTA는 가이드의 **흰색 바탕/검정 글자**를 우선. 보조 버튼은 다크 표면·경계선; 상태 색상은 의미가 있는 경우에만 | 현재 `bodyFrameAccent = #C6FF4D`가 일반 CTA·활성 탭에도 쓰임. Stage 1에서 `primary`와 `state` 토큰 분리, 단계적으로 변경. 새 라이브러리 불필요 |
| D03 · 의미 색상 | 초록은 진행/성공·건강 변화 등의 문맥에 제한, 주황은 경고, 빨강은 오류/위험. 선택 컨트롤은 기본 흰색 또는 테두리/형태로도 구분 | 현재 라임색이 모든 선택 상태에 적용된 지점을 점검. 초록의 구체적 색조는 접근성 대비와 실제 가이드 비교 후 시맨틱 토큰에 매핑 |
| D04 · 글꼴 | 기본 UI는 **기존 Noto Sans KR** 유지. Pretendard는 가이드의 시각 참조로 사용하되 신규 의존성 도입 근거가 없으므로 별도 설치 금지 | 5종 저장 글꼴 설정은 유지. 메인 설정의 글꼴 선택은 일반 UI에서 보조 위치로 낮추고 기존 사용자 `fontStyle`·`fontSize` 값 및 렌더링 보존 |
| D05 · 타이포 | 기존 `bodyFrameTypography`(pageTitle 26, projectTitle 24, sectionTitle 18, body/row 14, caption 12, button 14)을 기준으로 가이드 화면을 재정렬 | `ScreenShell`, 개별 상세·레거시 파일의 하드코딩과 불일치 Stage 1/4에서 제거 |
| D06 · 간격/컨트롤 | 좌우 16dp, 최대 콘텐츠 750dp, 주요 버튼 48dp 이상, 터치 44×44dp 이상, 기존 카드/버튼 radius 8dp·시트 12dp, 안전 영역 유지 | 현 `bodyFrameDesign`과 일치. 단, 여러 화면의 실사용 높이와 키보드 가림은 기기 QA 필요 |
| D07 · 내비게이션 | 사용자에게 보이는 하단 탭은 **촬영·기록·영상·설정 4개 유지**. `account` route는 숨김 상태(`href: null`)로 설정에서 진입 | 가이드 일부에 표시된 다른 탭 구성은 적용하지 않음. 초기 경로는 `/camera`, OAuth 콜백은 `/account` |
| D08 · 화면 위계 | 사진·비교·기록의 실제 콘텐츠를 먼저 배치. 관리 설정, 텍스트 도움말, 플랜 안내는 보조 영역으로 | 1차 PR #82 개선을 유지하고 실제 캡처와 가이드 대조로 미반영만 후속 수정 |
| D09 · 모달 | 공통 제목·닫기·스크롤·고정 푸터·선택 표시를 사용. 삭제/결제/백업은 기존 확인·권한 경계 유지 | React Native `Modal` 22개 JSX 선언을 식별. 사용하지 않는 모달의 이름·코드 경로는 [인벤토리](./body-frame-stage0-screen-inventory-20261105.md) 참조 |
| D10 · 이미지·아이콘 | 온보딩/빈 상태 현재 PNG 8종 재사용. 원본 ZIP 142종 전체를 무조건 설치하지 않음. 아이콘 크기/획만 통일 | 앱 런처/Adaptive 아이콘, 기존 프로젝트 사진은 절대 교체하지 않음. 새 이미지 사용 시 라이선스/출처·필요성 검사 |
| D11 · 레거시 | `TripClipScreen`의 화면 스타일만 디자인에 맞추고, 영상 출력용 `TripClipRecordingCanvas`·음악/전환/드래프트/프레임은 분리 보호 | `trip-clip-screen.styles.ts`의 밝은 `colors` 참조가 여전히 다수 존재. Stage 5의 주요 위험 |
| D12 · QA/배포 | 정적 검사, 실제 모바일/태블릿 화면 비교, 기능 회귀는 별개 게이트. 작업 PR은 `main`에 바로 푸시하지 않음 | `main` push는 Play 내부 테스트 액션을 실행함. 서명키 오류 해결·인증서 검증 전 머지 및 릴리스 실행 보류 |

**차이점 확정:** 가이드의 Pretendard, 흰 CTA, 초록 상태 표시, 현재 앱의 5종 선택 글꼴·라임 CTA는 동시에 그대로 유지하기 어렵다. D02–D04 정책으로 기능·사용자 설정을 보호하면서 시각 요소만 통일한다. 이후 다른 작업에서 기준을 바꾸려면 문서 결정 ID와 이유를 PR에 남긴다.

## 3. 실제 코드 대조에서 확인된 잔여 영역

1. **P0 / 공통 강조색·탭**: `app/(tabs)/_layout.tsx`, `components/tab-glyph.tsx`, `components/body-frame-sheet.tsx`, `features/trip-clip/BodyFrameVideoHomeScreen.tsx` 등. 일반 CTA와 상태 의미의 라임 혼용.
2. **P0 / 레거시 영상**: `app/legacy-video-edit.tsx` → `features/trip-clip/TripClipScreen.tsx` → `trip-clip-screen.styles.ts`. 고정 밝은 UI 팔레트·레거시 컨트롤. 출력 캔버스는 별도 보호.
3. **P1 / 텍스트와 설정**: `BodyFrameSettingsScreen.tsx`에 현재 “폰트 스타일” 선택 행 노출; 사용자가 저장한 폰트는 보존. `app/video/[id].tsx`의 화면 제목 스타일은 현재 18로, Body Frame 공통 pageTitle 26과 불일치.
4. **P1 / 접근성**: PR #72에만 있는 가이드 색상 radio 역할, 음악 미리듣기 label/disabled, 44dp 터치 개선을 선별 적용할 필요. 예: `features/account/account-screen.styles.ts`의 일부 `minHeight: 40`.
5. **P1 / 사진·기록·수치·영상·모달**: PR #82가 이미 다수 정리했지만 실제 캡처 대비 정보 위계·아이콘·선택 버튼·키보드/작은 화면을 다시 검증해야 함.
6. **P2 / 에셋·기기**: 8개 PNG는 실제 사용 중이며 142개 원본 ZIP은 별도. 작은 화면·큰 글씨·에뮬레이터 사진이 실제 체형 사진과 달라 추가 시각 검증 필요.

## 4. PR #72 선별 규칙 — 병합 금지

[PR #72](https://github.com/hebi10/travelframe/pull/72)는 **미병합, 최신 `main`에서 divergence** 상태이다. 9개 변경 파일에 담긴 다음 내용만 이슈 단위로 최신 코드에 재검토한다.

| 대상 | 확인된 차이 | 후속 작업 |
| --- | --- | --- |
| `app/video/[id].tsx` | PR #72의 `bodyFrameTypography.pageTitle` vs 현재 `fontSize: 18` | Stage 1/3에서 신규 공통 제목 규격과 현재 헤더를 함께 검증 |
| `features/account/account-screen.styles.ts` | 현재 `minHeight: 40`, PR #72는 `bodyFrameDesign.minTouchSize` | Stage 1/3에서 44dp 이상 여부 검사 |
| `TripClipGuideTab.tsx` | PR #72의 색상 버튼 `accessibilityRole="radio"`가 현재 없음 | Stage 5에서 역할·선택 상태·화면 판독기 회귀 |
| `TripClipMusicTab.tsx` | PR #72의 미리듣기 동작 label/disabled 상태가 현재 없음 | Stage 5에서 시맨틱 속성·기능 비교 |
| `app/edit.tsx`, `trip-clip-screen.styles.ts` | 버튼 터치영역·불필요한 스타일 제거 등 변경 | Stage 5에서 기능과 무관한 것만 수동 포팅 |
| `components/screen-shell.tsx`, `trip-clip-screen.components.tsx`, UI 테스트 | 글꼴 가중치/접근성 개선과 테스트 확장 | 현재 폰트 설정·테스트 구조와 대조 후 선택적 반영 |

현재 브랜치의 SHA를 유지하고 **PR #72 전체 merge/cherry-pick/rebase 실행 금지**. 변경 코드가 이미 유사하게 반영된 항목은 중복 적용하지 않는다.

## 5. 다음 작업 시작 게이트

- [x] `main`/PR 현황을 고정하고 디자인 원본 3종 + ZIP URL을 기록
- [x] 19개 leaf route(이 중 2개 redirect), 4개 노출 탭, 12개 소스 파일의 `<Modal>` 선언 22개를 인벤토리화
- [x] 버튼·폰트·테마·탭·레이아웃·호환성·출시 분리 원칙 수립
- [x] PR #72를 최신 코드에 대조하고 선별 대상만 문서화
- [ ] Stage 1 실제 디자인 토큰·공통 컴포넌트 코딩, 시각 비교 QA
- [ ] Stage 2~7 구현·기기 검증·Play 서명 복구

**Stage 0 완료 기준:** 기준 문서와 인벤토리가 저장소 브랜치 및 Google Drive에 저장되고, read-back으로 파일을 확인한다. **`main` 머지는 서명키/자동 배포 차단 문제 해결 전까지 미실행.**

## 6. 참고

- [실행 로드맵](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit)
- [Drive 디자인 자료 폴더](https://drive.google.com/drive/folders/1PONsfe-LI9nJHSuTOOM_N_UsdJAk1yX1)
- [UI 일관성 Issue #73](https://github.com/hebi10/travelframe/issues/73)
- [디자인 반영 완료 PR #82](https://github.com/hebi10/travelframe/pull/82)
- [릴리스/서명 문제 PR #80](https://github.com/hebi10/travelframe/pull/80)

# Body Frame 디자인 통합 Stage 5 — 레거시 편집·고급 설정

> 2026-11-05 KST / Stage 4 PR #87 기반 스택형 브랜치
> 배포 제한: 업로드 서명키 복구 전 main 병합·Google Play 배포 금지

## 대상

- 레거시 영상 재편집: `app/legacy-video-edit.tsx` → `TripClipScreen` 및 8개 분리 탭/공통 컨트롤
- 이전 스튜디오: `app/legacy-studio.tsx` → `StudioScreen` 및 하위 UI
- 고급 설정: `app/advanced-settings.tsx` → `SettingsScreen`
- 사진 편집: `app/edit.tsx` (카메라와 편집 캔버스는 어두운 몰입형 UI 유지)

## 코드 개선

1. 레거시 영상 편집기 스타일을 `createTripClipStyles(palette)` + `useTripClipStyles` 기반으로 변경하여 시스템·다크·라이트의 화면 배경/카드/글자/선택/버튼 색을 현재 앱 테마에 맞춤. 분리된 컴포넌트 8개와 공통 제어도 동일 훅을 사용.
2. 녹화 및 영상 결과물과 관계된 `recordingView`, `recordingCanvasInner`, `recordingWatermarkText`의 색상은 명시적으로 `legacyColors`로 고정. 미리보기 이미지/프레임의 어두운 배경도 고정. 렌더링/클립/전환/음악/드래프트 함수에는 변경 없음.
3. 기존 흰색(다크)/검정(라이트) 주요 CTA·선택 컨트롤 적용. 레거시 탭은 최소 48dp, 작은 제어는 최소 44dp로 개선. Radio/Tab 선택 상태, 프레임 편집/출력 완료 모달의 화면 판독기 영역 지정.
4. 이전 스튜디오 스타일을 `createStudioStyles(palette)`로 분리하고 탭·보관함·진행 모달의 대비를 통일. 이미지 추가/삭제 실행 및 저장 로직은 유지.
5. 고급 설정의 5개 모달은 Stage 4의 `BodyFrameSheetHandle` 및 백드롭 토큰·최대 86% 높이·텍스트 스크롤·접근성 격리를 반영. 백업 확인 버튼은 스크롤 영역 밖에 배치. 백업 검증/실행 로직에는 변경 없음.
6. 사진 편집은 캔버스의 몰입형 어두운 배경을 유지하고 저장/선택 버튼의 상태 라임을 흰색/검정 대비로 변경. 제목 26sp 및 핵심 터치 영역·비율 라디오 접근성 보완.

## 검증 계획 및 제한

- `tests/body-frame-design-stage5.test.mjs`: 모든 수정 TSX 구문, 기존 영상 재편집 경로·드래프트/저장 호출 보존, 다크/라이트 동적 팔레트, 9개 레거시 모달 선언 및 화면 판독기 격리, 녹화/미리보기 고정 색상, 선택/입력/버튼 규격 회귀.
- Android QA 에뮬레이터에서 `legacy-studio` 및 `advanced-settings` 실제 화면을 추가 캡처. 게스트 네트워크/가상 데이터로 실행, 계정 로그인·클라우드/구매 검증 없음.
- Android 실사용자 로그인 상태에서 저장 영상 재편집→전후 출력 프레임·길이·음악·복원 데이터 비교는 별도 수동 검증 필요. 게스트 QA는 로그인 필요 경로로 리다이렉트하므로 동일성 PASS를 증명할 수 없음.
- 360/412/600/750dp, 시스템 글꼴 100/130/150%, 다크/라이트, TalkBack 및 실제 구매/백업·다중 영상은 후속 QA 필요.
- 기존 디자인 QA [이슈 #73](https://github.com/hebi10/travelframe/issues/73) 최종 종료는 위 실제 기기/렌더링 동등성 검증 후.

## 배포 안전

Stage 1 #84 → Stage 2 #85 → Stage 3 #86 → Stage 4 #87 → Stage 5 (본 브랜치) 순서로 합치며 현재 `main`은 변경하지 않음. 업로드 키 인증서 복구 전 Google Play 업로드, merge, tag, release dispatch 금지.

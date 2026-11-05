# Body Frame 디자인 통합 Stage 4 — 모달·바텀시트

> 작업일: 2026-11-05 KST
> 기준: Stage 3 PR #86 HEAD `37409f6981ec03110c327a30a362fa47fe109a99`
> Stage 4는 Stage 3 브랜치 위 **스택형 PR**이며, 기존 `main`과 Play 배포는 변경하지 않는다.

## 적용 대상

현재 화면 중 **모던 UI에 있는 Modal 13개 선언**을 대상으로, 공통 시트 규격과 기능 보존을 검증했다. 레거시 고급 설정·이전 스튜디오·이전 영상 재편집의 나머지 9개 Modal은 **이미 계획된 Stage 5 레거시 화면 작업에서 처리**한다. 따라서 Stage 4를 전체 22개 모달의 최종 시각 QA로 간주해서는 안 된다.

| 화면 | 구현 및 검증 항목 |
| --- | --- |
| `components/body-frame-sheet.tsx` | 공통 핸들 36×4dp, 제목·닫기 44dp, 48dp 취소/적용 버튼, 긴 레이블 2줄 대응, 상호작용 색상·뒤로가기 설명 |
| `BodyFrameProjectSwitcher.tsx` | 프로젝트 선택·생성 바텀시트 2개. 백드롭 닫기 터치와 시트 터치 분리, 키보드 노출 시 스크롤, 생성 중 상태 및 선택 규격 |
| `PhotoPositionSheet.tsx` | 사진 순번 입력과 하단 이동/취소 버튼 분리, 작은 화면의 스크롤 높이 제한 및 공통 핸들 |
| `BodyMeasurementEditorSheet.tsx` | 기록 날짜·각 수치·메모 접근성, 키보드 스크롤, 고정 저장/취소/삭제 확인, 로컬 저장 데이터 불변 |
| `BodyFrameVideoOptionsSheet.tsx` | 사진 선택·간격·화질·비율·텍스트 오버레이 선택색과 접근성, 86% 시트 높이, 사진 가상 목록/고정 적용 버튼 |
| `BodyFrameProjectDetailScreen.tsx` | 촬영 알림·프로젝트 설정 모달, 공통 핸들, 최대 750dp 폭, 키보드 대응, 수치/옵션 선택색 통일, 고정 알림 저장/변경 저장 |
| `BodyFrameSettingsScreen.tsx` | 모달 배경/시트 터치 분리, 현재 선택 옵션, 긴 목록 스크롤, 안전 영역 및 저장 중 라이브 안내 |
| `AccountScreen.tsx` 및 스타일 | 플랜·결제 안내/계정 삭제 요청 2개 모달의 공통 핸들·시트 규격. 구매 CTA를 스크롤 영역 밖에 유지, 삭제 설명 별도 스크롤 |
| `CameraScreen.tsx` 및 스타일 | 촬영 도구·가이드 설정 2개 모달의 닫기 접근성, ScrollView·키보드·안전 영역 점검. 실제 가이드가 카메라 위에 표시되는 동작 유지 |
| `app-guide-overlay.tsx` | 온보딩 안내 모달의 스크롤 및 화면 판독기 그룹 정리 |

## 공통 UI 규정

- 백드롭: `rgba(0,0,0,0.62)`, 높이 `maxHeight: 86%`, 너비 최대 750dp, 좌우 16dp.
- 타이포: 기존 BodyFrameTypography. 제목·닫기·본문·푸터 구획을 일정하게 유지.
- Primary CTA 48dp 이상, 닫기/작은 버튼 44×44dp 이상, 선택색은 `palette.text`, 의미 색상은 진행·오류·경고에만.
- 시트 본문만 스크롤하고 하단 주요 작업 버튼은 고정; 입력 화면은 `KeyboardAvoidingView` 및 `minHeight: 0` 적용.
- 파괴적 작업(프로젝트 보관, 수치 삭제, 계정 삭제 요청)은 기존 확인 단계/알림을 유지한다. 새 임의 삭제 행동을 추가하지 않는다.
- Play Billing 구매, 구매 복원, 클라우드 백업·복원, 프로젝트·사진·수치·영상 저장 포맷, Health Connect, 카메라·렌더링 로직 변경 금지.

## 검증 항목

- [ ] `tests/body-frame-design-stage4.test.mjs`의 공통 규격·JSX 구문·회귀 계약 확인
- [ ] TypeScript, Lint, 전체 Node 테스트, Firebase Rules/Functions, Android Manifest/Kotlin, Secret Scan
- [ ] Android 에뮬레이터·실기기 모달 열기/닫기, 키보드 표시, 360/412/600/750dp 반응형 캡처
- [ ] 큰 글씨 100/130/150%, 긴 옵션 이름·오류 메시지·플랜 설명, TalkBack radio/checkbox/button 동작
- [ ] 별도 Stage 5의 레거시 9개 Modal 디자인·출력 결과 동등성 최종 검증

## 배포 및 PR

- Stage 1 PR #84 → Stage 2 PR #85 → Stage 3 PR #86 → Stage 4 스택형 PR.
- `main` push는 Google Play 내부 테스트 자동 배포를 실행하므로 **업로드 서명키가 검증되기 전 병합하지 않는다.**
- 에뮬레이터 자동 QA의 성공이 결제·백업 실계정/실기기 검증까지 증명하는 것은 아니다.
- [Drive 단계별 실행 계획](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit)
- [Drive 디자인 가이드](https://drive.google.com/drive/folders/1PONsfe-LI9nJHSuTOOM_N_UsdJAk1yX1)

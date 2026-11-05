# Body Frame Stage 0 — 화면·모달 인벤토리

- 정적 기준: `main@2f1189fc9ba570b2224e6b1cfd2fe3d76a3fd846` (2026-11-05)
- 용도: Stage 1~6 수정 대상·동선·회귀 검증 대상의 **위치 목록**. 캡처/사용자 상태에 따라 보이는 UI를 모두 직접 검증했다는 뜻은 아니다.
- 공통 실행 정책: [Stage 0 디자인 기준](./body-frame-stage0-baseline-20261105.md)과 [Drive 실행 계획](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit).

## 1. 라우트 전수 목록

`app/` 기준 19개의 사용자-facing leaf route가 아니라 **leaf route 전체 19개**이며, 이 중 `/`·`/oauthredirect` 2개는 실제 콘텐츠 없이 리다이렉트한다. 기타 `_layout.tsx`는 화면 수에 넣지 않았다.

| 구분 | URL / 탭 | 실제 렌더링 / 연결 소스 | 향후 검증·수정 | 우선순위 |
| --- | --- | --- | --- | --- |
| 리다이렉트 | `/` | `app/index.tsx` → `/camera` | 기존 진입 경로 유지 | 유지 |
| 리다이렉트 | `/oauthredirect` | `app/oauthredirect.tsx` → `/account` | OAuth 복귀 동작 보존 | 유지 |
| 탭 1 | `/camera` | `features/camera/BodyFrameCameraScreen.tsx` → `CameraScreen.tsx` | 프레임·셔터·기준사진·하단 도구·프로젝트 선택 | Stage 2 / P0 |
| 탭 2 | `/studio` | `features/records/BodyFrameRecordsScreen.tsx` | 프로젝트 사진 중심 그리드·빈 상태·보관 목록 | Stage 2 / P1 |
| 탭 3 | `/trip-clip` | `features/trip-clip/BodyFrameVideoHomeScreen.tsx` | 영상 만들기·저장 영상·프로젝트 선택 | Stage 3 / P1 |
| 탭 4 | `/settings` | `BodyFrameSettingsWithPrivacyScreen.tsx` → `BodyFrameSettingsScreen.tsx` | 6그룹·폰트 설정 노출·모달, 광고 개인정보 진입 유지 | Stage 3 / P1 |
| 숨김 탭 route | `/account` | `features/account/AccountScreen.tsx`; 탭 레이아웃에 `href: null` | 로그인·구독·결제·백업·삭제 안내 | Stage 3~4 / P1 |
| 기록 | `/project/[id]` | `features/records/BodyFrameProjectDetailScreen.tsx` | 사진·진행률·수치·알림·프로젝트 설정 | Stage 2,4 / P1 |
| 비교 | `/project/[id]/compare` | `features/records/BodyFrameCompareScreen.tsx` | 분할 비교 사진·25/50/75%·핸들 | Stage 2 / P2 |
| 수치 | `/project/[id]/measurements` | `features/records/BodyMeasurementHistoryScreen.tsx` | 기간·그래프·목록·수치 입력 시트 | Stage 2 / P1 |
| 사진 상세 | `/photo/[id]` | `app/photo/[id].tsx` | 큰 사진·메타·수치·앨범 저장·편집 | Stage 2~3 / P2 |
| 사진 편집 | `/edit` | `app/edit.tsx` | 사진 편집 UI·가이드·저장 선택·기존 편집 데이터 | Stage 5 / P1 |
| 촬영 미리보기 | `/capture-preview` | `app/capture-preview.tsx` | 원본 확인·재촬영·저장 | Stage 2~3 / P1 |
| 영상 만들기 | `/video-create` | `features/trip-clip/BodyFrameVideoScreen.tsx` | 미리보기·옵션·영상 출력/실패/재시도 | Stage 3 / P1 |
| 영상 보관함 | `/video-library` | `BodyFrameVideoLibraryScreen.tsx` | 목록·썸네일·비어 있음·삭제 | Stage 3 / P1 |
| 영상 상세 | `/video/[id]` | `app/video/[id].tsx` | 재생·메타·다시 편집하기·저장 영상 | Stage 3 / P1 |
| 호환용 고급 설정 | `/advanced-settings` | `features/settings/SettingsScreen.tsx` | 기능 유지, 라이트/다크·모달·입력/버튼 | Stage 5 / P1 |
| 호환용 스튜디오 | `/legacy-studio` | `features/studio/StudioScreen.tsx` | 이전 작업물·이미지 가져오기·삭제/진행 모달 | Stage 5 / P1 |
| 호환용 영상 편집 | `/legacy-video-edit` | `features/trip-clip/TripClipScreen.tsx` | **고정 밝은 팔레트**, 음악·전환·기존 영상 드래프트 | Stage 5 / P0 |

### 1.1 루트 내비게이션 고정

- 하단 노출 탭은 `camera`, `studio`, `trip-clip`, `settings` 4개만 유지한다.
- `account`는 실제 route이지만 하단 탭 숨김(`href: null`), 설정 진입을 유지한다.
- `app/(tabs)/_layout.tsx`, `components/tab-glyph.tsx`에서 선택 색상/아이콘 규칙 변경 시 기기 뒤로가기·탭 이동 확인.
- OAuth redirect와 호환용 3개 route는 제거하지 않는다.

## 2. React Native Modal 선언 전수

코드 검색 `<Modal` 결과의 앱 소스 12개를 읽어 총 **22개 JSX 선언**을 확인했다. 아래 수는 **모달 인스턴스 코드 선언 수**이며 상태 분기에서 파생되는 선택지 수 또는 Alert 다이얼로그의 수가 아니다.

| 소스 파일 | 선언 수 | 사용 맥락 / 확인 항목 | 작업 단계 |
| --- | ---: | --- | --- |
| `features/camera/BodyFrameProjectSwitcher.tsx` | 2 | 프로젝트 선택, 새 프로젝트 생성. 길이·키보드·하단 버튼 | Stage 4 |
| `features/records/BodyFrameProjectDetailScreen.tsx` | 2 | 촬영 알림 설정, 프로젝트 설정. 저장·취소·요일·입력 오류 | Stage 4 |
| `features/records/BodyMeasurementEditorSheet.tsx` | 1 | 날짜·몸무게 등 수치 입력/수정·삭제. 데이터와 연결 유지 | Stage 4 |
| `features/records/PhotoPositionSheet.tsx` | 1 | 사진 순번 이동. 입력 및 고정 액션 | Stage 4 |
| `features/trip-clip/BodyFrameVideoOptionsSheet.tsx` | 1 | 동적 옵션(사진 선택·간격·화질·비율·텍스트 등), 선택·적용 | Stage 4 |
| `features/settings/BodyFrameSettingsScreen.tsx` | 1 | 화면·저장·기준사진 등 여러 설정을 한 Modal에서 분기 | Stage 4 |
| `features/account/AccountScreen.tsx` | 2 | 계정/데이터 삭제 안내, 플랜/구독 구매 안내 | Stage 4 |
| `features/camera/CameraScreen.tsx` | 2 | 카메라 도구/촬영 설정, 가이드 설정 | Stage 4/5 |
| `features/settings/SettingsScreen.tsx` | 5 | 삭제 안내, 옵션 선택, 백업 진행·확인·진행 표시 등 | Stage 4/5 |
| `features/trip-clip/TripClipScreen.tsx` | 2 | 프레임 채우기/맞춤, 영상 출력 진행·오류 | Stage 5 |
| `features/studio/StudioScreen.tsx` | 2 | 사진 가져오기 진행, 작업물 삭제 진행 | Stage 5 |
| `components/app-guide-overlay.tsx` | 1 | 최초 환영/온보딩 안내 및 다시 보기 | Stage 2/4 |
| **합계** | **22** | native `Alert.alert` 및 OS 권한 팝업은 별도로 테스트 | |

`BodyFrameSheetHeader`/`BodyFrameSheetFooter`는 여러 신규 화면에 적용되어 있지만 위 모든 경로에는 적용되지 않았다. 기존 모달을 공통화할 때 파괴적 작업의 동작·스크롤·키보드 회귀를 우선한다.

### 2.1 별도 시스템/상태 창 — 공통 Modal과 구분

- `Alert.alert`로 노출되는 사진 삭제, 구독/계정, 카메라 권한, 비디오 오류 등 OS 네이티브 경고는 `<Modal>` 집계에 포함하지 않는다.
- `app/photo/[id].tsx`, `app/edit.tsx`, `app/video/[id].tsx`, `features/account/CloudBackupProjectSlotsSection.tsx`, `components/body-health-connect-import-card.tsx` 등에서 조건/경고/권한 흐름 확인 필요.
- 계정 구매/복원·삭제, 백업 삭제·복원, 알림 권한, Health Connect 동의는 임의 디자인 모달로 대체하지 않는다.

## 3. 시각적 차이 및 선택 적용 대상 (정적 분석)

| ID | 문제 위치 | 현 상태 근거 | 담당 |
| --- | --- | --- | --- |
| G01 | `constants/app-theme.ts`·탭·버튼 | `bodyFrameAccent = #C6FF4D`가 주요 CTA/활성 탭에 널리 사용됨 | Stage 1 |
| G02 | `app/video/[id].tsx` | 기본 영상 상세 `pageTitle`은 18px, 공통 BodyFrame `pageTitle`은 26 | Stage 1/3 |
| G03 | `features/settings/BodyFrameSettingsScreen.tsx` | 메인 설정에 “폰트 스타일” 행·선택 Modal이 있음 | Stage 1/3 |
| G04 | `features/account/account-screen.styles.ts` | 일부 버튼 `minHeight: 40`으로 44dp 최소 터치 정책과 불일치 | Stage 1/3 |
| G05 | `features/trip-clip/components/TripClipGuideTab.tsx` | 가이드 색상 선택 역할/선택 상태를 PR #72와 재비교 | Stage 5 |
| G06 | `features/trip-clip/components/TripClipMusicTab.tsx` | 음악 미리듣기 접근성 이름/비활성 상태를 PR #72와 재비교 | Stage 5 |
| G07 | `features/trip-clip/trip-clip-screen.styles.ts` | 밝은 `colors` 참조 다수 및 일부 단면 border·shadow | Stage 5 |
| G08 | `CameraScreen.tsx` / `BodyFrameCameraScreen.tsx` | 촬영 설정·가이드 팝업·헤더·시각 우선순위 별도; 기본 기능 삭제 금지 | Stage 2/4 |
| G09 | 프로젝트·수치·사진·영상 상세 | PR #82 적용 중. 실제 기기 화면과 가이드의 CTA·타이포·간격 비교 필요 | Stage 2~4 |
| G10 | 온보딩·빈 상태·아이콘 | 앱에는 PNG 8종 적용, 원본 ZIP 142종은 별도. 모든 아이콘의 자동 복사 금지 | Stage 6 |

## 4. 실기기 회귀 케이스 인덱스

| 그룹 | 화면/상태 | 기기·조건 |
| --- | --- | --- |
| 기본 | 최초 환영 안내 → 촬영/기록/영상/설정, 프로젝트 선택 | 360dp·412dp |
| 기록 | 프로젝트 0/1/다수, 사진 0/1/2/다수, 순번 변경, 전후 비교 | 360dp·412dp·600dp |
| 수치 | 기록 0/1/다수, 수동 수치·Health Connect 가져오기 안내 | 360dp·600dp |
| 영상 | 프로젝트 영상 생성 → 저장·재생·재편집, 취소·실패·앨범 재시도 | 412dp·600dp |
| 모달 | 생성/설정/촬영 알림/수치/순번/영상옵션/구독/백업/삭제 | 키보드 표시·스크롤·권한 거절 |
| 접근성 | 주요 버튼 44×44dp, 글자 크기 small/medium/large | 시스템 100/130/150%·TalkBack |
| 태블릿/폴더블 | 본문 최대 750dp, 전체 페이지·시트 및 Safe Area | 600dp·750dp 이상 |
| 테마 | 다크 기본 + 라이트/시스템, 카메라·사진 편집 어두운 작업 화면 | 화면 캡처 비교 |
| 위험 업무 | 개인정보·구매/복원·클라우드 백업·데이터 삭제 | 실제 권한 및 데이터 불변성 확인 |

자동 테스트 **성공**은 이 표의 모든 항목을 실기기에서 직접 확인했다는 뜻이 아니다. 장면별 스크린샷과 출처(커밋 SHA/기기 크기/OS/폰트/테마)를 남겨야 최종 PASS로 변경한다.

## 5. 보호 대상 및 작업 분리

- 로컬 사진·영상·수치·정렬 ID·프로젝트 상태, 클라우드 백업·복원, Google Play Billing·권한·Health Connect 연동을 디자인 편집 대상으로 취급하지 않는다.
- 레거시 영상의 음악·전환·렌더링 캔버스와 화면 스타일은 분리한다. `/legacy-video-edit`의 이미지 레이아웃만 보고 출력 영상을 변경해서는 안 된다.
- `main`에 디자인 문서/코드를 직접 push하면 `Android Play test release` 워크플로가 실행될 수 있다. 유효한 Play 업로드 인증서 검증 전 문서 PR조차 자동 merge하지 않는다.
- 추후 Stage 1 작업은 본 인벤토리를 기준으로 별도 디자인 브랜치/PR에서 진행한다.

## 6. 확인 근거

- [현재 `main` 소스](https://github.com/hebi10/travelframe/tree/2f1189fc9ba570b2224e6b1cfd2fe3d76a3fd846)
- [PR #82 (디자인 1차)](https://github.com/hebi10/travelframe/pull/82)
- [PR #72 (미병합 마이크로 개선)](https://github.com/hebi10/travelframe/pull/72)
- [Issue #73 (디자인 QA)](https://github.com/hebi10/travelframe/issues/73)
- [Android Native device QA, 통합 브랜치](https://github.com/hebi10/travelframe/actions/runs/41966268365)
- [Play AAB 배포 실패 (기존 서명키 검증)](https://github.com/hebi10/travelframe/actions/runs/41962132356)

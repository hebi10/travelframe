# Body Frame 디자인 통합 Stage 2 — 촬영·기록·프로젝트·비교·수치

> 기준: **Stage 1 브랜치 `81a083a7c81255e7b8868da1b0fce4cf3840681e` 위 누적 적용**.
> Stage 1이 아직 `main`에 병합되지 않았으므로 Stage 2는 Stage 1 브랜치를 부모로 한 **stacked PR**로 검증한다.
> 사용자 사진·프로젝트·수치·영상·백업 데이터 모델, 결제, Health Connect 저장/권한, 카메라 셔터 및 출력 로직은 변경하지 않는다.

## 적용된 화면·컴포넌트

| 모듈 | 화면 변경 | 보호 대상 |
| --- | --- | --- |
| `BodyFrameCameraScreen.tsx` | 사진 위에 표시되는 촬영 안내 텍스트의 가독성을 위해 작은 반투명 안내 패널 적용. 사진 저장 완료 안내를 접근성 라이브 영역으로 표시 | 촬영 세션, 포즈 정렬, 기준 사진·투명도, 촬영 한도·알림/수치 진입 |
| `BodyFrameProjectSwitcher.tsx` | 프로젝트 선택 버튼의 비활성·사용 설명 접근성 추가. 선택한 프로젝트 체크 표시를 공통 텍스트 색상으로 정리 | 프로젝트 생성/선택, 모달·플랜·저장 |
| `BodyFrameRecordsScreen.tsx` | 프로젝트 숫자 헤더, 2열 스마트폰/3열 넓은 화면의 가변 카드, 1개일 때 가로형 카드 유지. 빈 프로젝트 썸네일에 기존 로컬 이미지 사용. 진행률을 진행 막대로 알림 | 프로젝트 정렬, 사진/썸네일, 보관/복원 및 이동 |
| `BodyFrameProjectDetailScreen.tsx` | 기존 첫·최근 사진을 crop 없이 요약하는 전후 미리보기 및 비교 진입 카드. 촬영 Primary CTA 흰색 계열, 진행률 접근성, 기록 건수 정렬, 수치 카드 우선·촬영 알림 후순위 | 사진 그리드·순서/드래그·촬영 알림·수치·프로젝트 저장 |
| `BodyFrameCompareScreen.tsx` | 드래그 분할선 중앙 핸들, 벡터 뒤로가기 아이콘, 25/50/75 선택색 통일, TalkBack 조절형 증감 동작 | 원본/최근 사진 및 PanResponder 슬라이더, 클램프 |
| `BodyMeasurementHistoryScreen.tsx` | 1/3/6개월·전체 기간 필터(기본 전체로 기존 동작 유지), 그래프 상단 우선 배치, 기간·지표 선택을 접근성 radio로 표시 | 수치 로컬 저장·편집·삭제, Health Connect 데이터 및 개별 기록으로 이동 |
| `body-measurement-period.ts` | 표시 기간만 계산하는 순수 헬퍼 추가. 말일 월 계산 보정 및 잘못된 날짜 거부 | DB·타임존·실제 저장 구조 변경 없음 |

## 필수 회귀 확인

- **촬영:** 프로젝트 선택/교체, 첫 사진, 기준 사진 투명도, 타이머·가이드/자세 정렬, 저장 권한 거절 대체 동작, 수치 기록 안내 버튼.
- **기록:** 프로젝트 0/1/2/다수, 폭 360/412/600/750dp, 사진 있을 때/없을 때, 실제 미리보기 URI, 보관 및 복원, 프로젝트 생성 제한.
- **상세:** 첫 사진·최근 사진 순번, 드래그 순서 변경과 사진 이동, 비교 카드, 진행률 0~100%, 촬영/영상/수치/알림/설정 동선.
- **전후 비교:** 사진 2개·다수·없음, 25/50/75% 프리셋, 드래그 충돌, TalkBack 조절, 제스처 핸들 터치 간섭 없음.
- **수치:** 월말·윤년, 올바르지 않은 날짜, 전체 기록 기본 선택, 1/3/6개월 차트·요약·목록 동기 필터, 추가·수정·삭제 및 Health Connect 가져오기.
- **범용:** 앱 글자 3단계, 시스템 글자 100/130/150%, 다크·라이트, 저장된 5종 글꼴, 작은 화면 Safe Area·스크롤, 기존 사진 원본 및 렌더링 불변성.

## 검증과 병합 제한

- JS/TS 정적 회귀: `tests/body-frame-design-stage2.test.mjs`, 기존 `body-frame-*`, `20-body-frame-stage-9-6-measurement-history` 등.
- CI: TypeScript, Format/Lint, 전체 테스트, Firebase Rules/Functions, Android Manifest/Kotlin, Secret Scan, Native device QA.
- 디자인 최종 수용: 실제 360/412/600/750dp 캡처와 Drive 디자인 가이드 대조로 PASS/FAIL 기록. CI 성공만으로 픽셀 일치 완료 판정 금지.
- `main`에 병합하면 Play 자동 배포가 시도되므로 **업로드 서명키 복구 이전에는 Stage 1/2 PR 병합, Play 배포 실행 금지**.

### 진행 상태

- Stage 2 코드/회귀 테스트는 별도 PR에서 검증하고 결과를 업데이트한다.
- 다음 Stage 3는 영상·계정·설정의 개별 화면 디자인으로 분리한다.
- 참고 자료: [Drive 실행 계획](https://docs.google.com/document/d/1zVWidRZGMB-usvm-xBPU09_hdOvJD1s04h_NC1I236M/edit) · [Stage 1 PR #84](https://github.com/hebi10/travelframe/pull/84)

# Body Frame 디자인 10단계 — 기록 목록·프로젝트 상세 정밀 리디자인

기준: 2026-11-06 KST, `main@6f25925703fa68f284f1ca0102196ab2047deef8`

## 디자인 근거

- [Google Drive 화면별 시안](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view): 기록 프로젝트 카드, 프로젝트 상세의 상단 `기록·수치·통계` 전환, 사진 중심 콘텐츠 우선 배치.
- [앱 디자인 시스템](https://drive.google.com/file/d/124i6p8cCW1vxM_2N2H321fw4L9QZsNqK/view) 및 [다크 UI 시안](https://drive.google.com/file/d/19Kh11wAzwNoc-Cfpjjhbtqezk1S7bqfG/view): 상단 밀도/프로젝트 카드/작은 썸네일·진행률, 다크 기반과 44dp 터치.
- 이전 native Android 실제 캡처: `mobile-records.png`, `mobile-project.png`, `tablet-records.png`, `tablet-project.png`에 표시된 텍스트 중심 구성과 비교.
- 시안의 실제 신체 사진과 CI에 사용한 숫자 패턴 fixture는 서로 다르므로 콘텐츠 이미지 차이는 구현 미반영으로 간주하지 않음.

## 코드 변경

### 기록 목록 (`BodyFrameRecordsScreen.tsx`)
1. 기존 빈 설명 문구와 독립된 2개 큰 CTA가 기록 목록보다 높은 위치를 차지하던 구조를 줄여, `기록` → `내 프로젝트·개수·작업` → 사진 카드로 시작하도록 재배치.
2. 프로젝트 추가 기능(`BodyFrameProjectSwitcher`의 createOnly), 촬영 진입, 생성 제한·결제 안내, 프로젝트 저장/복원 로직 유지. 촬영 버튼은 48dp 아이콘 및 접근성 레이블 제공.
3. 한 프로젝트일 때 가로로 과도하게 늘어난 단일 예외 카드와 다중 프로젝트 세로형 grid 표현을 제거. **휴대폰 1열 / 콘텐츠 560dp 이상 2열**의 동일한 작은 가로형 사진 카드 사용.
4. 커버 선택 및 최신 sequence 우선 정렬은 변경하지 않고 `previewUri ?? uri`를 사용. 사진/프로젝트명/생성일/현재·목표 사진 수/진행률/예상 영상 길이 표시. 터치 카드 전체로 프로젝트 열기 유지.
5. 기본 색상, radius, 선 두께는 기존 Body Frame 토큰을 사용하며 한쪽 테두리, 그림자, 추가 그라데이션 없음.

### 프로젝트 상세 (`BodyFrameProjectDetailScreen.tsx`)
1. 상단의 중복 제목을 프로젝트 이름으로 정리하고 `기록 | 수치 | 통계` 세 탭 제공. 선택 상태·비활성화 상태를 화면 판독기에 알려주며, 순번 드래그·저장 중에는 탭 전환을 잠금.
2. **기록 탭**: 원본 크롭을 하지 않는 첫/최근 사진 비교 카드가 최상단에 위치, 진행률·오늘 사진 찍기·사진 3열 기록·정렬/사진 추가·변화 영상 기능 유지. 전후 비교는 기존 비교 페이지로 이동.
3. **수치 탭**: 기존 BodyMeasurementSummaryCard 및 그래프, 기록 추가/전체 기록으로 이동. 수치 기능 미사용 프로젝트는 설명과 설정 진입 제공. 측정값은 기존 로컬 데이터 모델·설정에 유지.
4. **통계 탭**: 현재 기록/목표/달성률, 시작일, 예상 영상 길이, 기존 촬영 알림 설정 화면. 알림 저장/권한 동작은 그대로 유지.
5. 모든 프로젝트 설정·기존 사진 순번 변경·보관·업그레이드·알림 모달과 원본 사진 저장 정책을 변경하지 않음.

## 회귀 검증

- `tests/body-frame-design-stage10.test.mjs`: TSX 구문·태블릿/휴대폰 카드 열 수, 사진 썸네일·기존 생성/보관 기능, 세 탭의 접근성 상태/활성 콘텐츠, 기존 앨범 추가/순번/수치/알림/설정 동선 검증.
- `tests/body-frame-design-stage2.test.mjs`는 신형 디자인에 맞게 단일 예외 카드/2-3열 grid의 과거 정적 기대를 교체하고 수치 비교·카메라 계약은 유지.
- Quality: TypeScript·Lint·전체 테스트·Firebase Rules·Functions·Android Manifest/Kotlin 및 Secret Scan.
- Android native device QA에서 기록/프로젝트/수치 진입 및 기존 모달이 깨지지 않는지 확인. 가능하면 실제 모바일·태블릿 캡처 아티팩트를 원본과 재대조.

## 아직 확인할 실기기 영역

실제 인물 사진의 크롭과 전후 정렬, 장문 프로젝트명/글자 배율 150%, 사진 0/1/2+ 및 프로젝트 0/1/다수, 순번 드래그, 수치 기록 로컬 데이터, 실제 Android 폴더블 기기와 TalkBack 음성 순서. Synthetic CI 캡처만으로 완전한 원본 이미지 일치를 주장하지 않음.

## 배포

기존 `main` 푸시의 Play 게시 게이트 유지. 업로드 키 인증서 확인·11월 7일 11:01 KST 배포 가능 제한 및 명시적 승인 설정 전 Play 업로드 없음. 프로젝트별 저장 데이터, 구독/백업/Health Connect·영상 렌더링 변경 금지.

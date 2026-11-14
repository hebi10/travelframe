# UI-R10-02A — 기록·프로젝트 화면 정보 밀도 보정

기준: 2026-11-12 · main 9bff05b2a03752eb7f3b6ce13bb31d592ecce843 · 독립 UI PR

## 기획안/실제 차이
- 기준: TravelFrame v3 핵심 9화면 및 Android PR #153 캡처.
- 목록은 대표 사진 크기(기존 108~128dp), 카드 제목(14dp), 핵심 기록/진행률 위계가 기획안보다 약함.
- 프로젝트 상세의 실 코드에서 사진 열은 **3열 고정**. 기존 보고서의 '폰 2열 구현' 서술과 달라 본 PR에서 폰 2열/태블릿 3열로 바로잡음.
- 촬영 버튼은 사진 목록 앞에 위치하여 첫 폴드 기록 노출을 밀어내고, 사진 추가 버튼은 기록 헤더에 있음.

## 이번 변경
1. 목록 카드: 썸네일을 기본 116~144dp로 확대하고 130% 이상 글꼴은 100~120dp로 조정, 제목 18dp와 상태 안내를 추가. 사진은 contain 유지, 진행률 중성색.
2. 프로젝트 상세: 폭 600dp 미만 2열, 이상 3열. 열 개수를 그리드 너비와 드래그·자리 이동 계산에 함께 전달.
3. 프로젝트 상세: 사진 썸네일 contain으로 원본 구도 노출, 기록 그리드를 촬영/사진 추가 CTA보다 먼저 배치. 글꼴 130% 이상은 두 CTA를 수직 배치.
4. 비교 카드: 누르는 전체 카드 동작 유지, '비교하기' 액션 문구 보완. 72×110 미리보기와 기존 원본 사진 선택 방식을 보존.

## 변경하지 않은 기능
- 사진 photoId/sequence, 앨범 가져오기, 새 프로젝트 생성, 보관/복원, 요금제 한도, 전후 비교 3모드, 수치/통계, 카메라, 영상 생성/앨범 저장, 클라우드 백업·Health Connect·결제·Firebase·Google Play, 사진 원본 데이터.
- 기존 SortableProjectPhotoTile Gesture 및 accessibilityActions를 보존하고 열 계산만 일관화.

## 필수 테스트·병합 기준
- 선행 PR #155·#156의 Android CI/QA 및 순차 main 병합 전에는 본 PR 병합 금지.
- TypeScript, ESLint, Node 회귀, Android APK, Firebase Rules/Functions, Secret Scan 모두 Success.
- 360·412·600·750dp × 라이트/다크 × 글꼴 100/130/150% 24환경 실제 캡처(PNG/XML/매니페스트, 동일 HEAD).
- 프로젝트 0/1/3개, 사진 0/1/2/3/다수, 긴 제목, 360dp 150% 화면, 600dp 그리드 변경, 사진 선택·순서 이동·저장/복원 수동 또는 에뮬레이터 검증.
- 실사진의 크롭, ARM64·TalkBack 실제 읽기 순서 및 OS 사진 권한/앨범 저장은 별도 물리 기기 QA 대상.
- QA 통과해도 디자인 이미지의 픽셀 일치로 단정하지 않음.

## 자료
- v3 기획: https://drive.google.com/drive/folders/1ElpylZuwTLdPA2VFqnyUO9PxKk8faCcT
- 화면별 비교 보고서: https://docs.google.com/document/d/1Mh6-cyEVLhKfHHPP2NxvkeXc7x5Jesu1KiblWk0eeUg/edit
- Android 이전 실행 증빙: https://drive.google.com/drive/folders/1ExCbwVZmYG42x0UkAt3-mtUNmV-IyZuu

다음 작업 UI-R10-02B — 수치·그래프 잔여 시각 차이 보정.

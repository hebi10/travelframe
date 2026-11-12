# TravelFrame UI-R10-02D — 영상·설정 및 보조 32화면 잔여 디자인 보정

기준일: 2026-11-12
기준 main: 4a78e8c544d69410f6663634070bbefa8ad38ea3
증거: Google Drive UI-R10 v3 기획안, PR #154 이후 412dp 라이트 실제 Android QA 원본, 보조 32개 캡처 키 목록.
기존 24환경 캡처는 합성 QA 예시이며, 새 HEAD에서 캡처 재검증 전에는 이번 변경의 시각 QA 완료로 표시하지 않는다.

## v3 기획과 실화면의 주요 차이·조치

- 07 영상 홈: 기획은 선택한 프로젝트 실사진 썸네일/3장·0.3초와 제작 CTA를 독립 구조로 표시. 기존 main은 일반 영상 아이콘과 제작 CTA가 같은 카드에 있음. 개선: 선택 프로젝트의 실제 대표 사진(원본 contain), 사진 수·예상 길이, 독립 제작 CTA. 0개 프로젝트는 기존 버튼 비활성·일러스트를 유지한다.
- 08 영상 만들기: 기획은 세로 미리보기·설정 5개·읽기 전용 예상 길이가 압축되어 보임. 기존 main의 미리보기는 0.30 화면 높이 제한. 개선: 0.34로 제한 확대하며 상단·설정 헤더 여백 일부 축소. 실제 프레임 렌더러/간격/비율/기록 순서는 불변. 버튼은 기존 Safe Area 고정 푸터 유지.
- 영상 보관함: 0개 비어 있음/1개/다수 정보 구성에서 제목 가독성과 안내 문구를 보정. 실제 저장/재생/삭제·원본 파일 로직 미변경.
- 옵션 시트 5종(사진·간격·화질·비율·텍스트): 사진 선택 미리보기 contain으로 전체 비율 표시. 스크린리더 선택/해제·라디오 현재값 안내 강화. 실제 출력 파일 비율에 맞는 크롭과 저장 정책은 변경하지 않음.
- 09 설정: 기존 6개 그룹을 보존. 저장 방식·계정·결제 항목에서 정책 설명을 읽을 수 있게 하되 기존 로그인/Pro/Cloud 권한·동의·결제·약관·스토어 경로 그대로 보존. PR #156의 글꼴 150%/좁은 화면 wrapping 기능이 아직 미병합이므로 **PR #156 성공 후 재병합·충돌 재확인 필수**.

## 보조 화면 32종 · 독립 기획 PNG 없음

아래 32종은 기존 Android 캡처에 대응하는 화면 키입니다. 직접 기획 이미지가 없으므로 'v3 픽셀 동일' 여부는 판정하지 않습니다. 이번 PR은 영상 6종과 설정 공통 진입 일부의 가독성만 수정했으며, 나머지는 선행 PR 또는 최종 QA의 검수 대상으로 유지합니다.

### 촬영 보조 (9)
- camera-project-picker: 스모크 대상. 
- camera-new-project: 스모크 대상. 
- camera-settings: 스모크 대상. 
- camera-settings-storage: 스모크 대상. 
- camera-guide-settings: 스모크 대상. 
- camera-color-panel: 스모크 대상. 
- camera-zoom-panel: 스모크 대상. 
- camera-light-panel: 스모크 대상. 
- capture-preview: 스모크 대상. 
처리/보류: 선행 UI-R10-02C PR #162. 촬영·구도·권한·사진 미리보기·오버레이가 현재 코드에서 유지되는지 확인; 실사진/ARM64 카메라 미검증.

### 기록·프로젝트 (8)
- empty-projects: 스모크 대상. 
- new-project: 스모크 대상. 
- project-settings: 스모크 대상. 
- project-reminder: 스모크 대상. 
- project-metrics: 스모크 대상. 
- project-stats: 스모크 대상. 
- photo: 스모크 대상. 
- photo-measurement: 스모크 대상. 
처리/보류: 선행 UI-R10-02A PR #160 및 UI-R10-01D PR #156. 프로젝트 CRUD, 비교 카드, 측정/알림·사진 상세, IME 150% 확인.

### 수치 입력 (1)
- measurement-create: 스모크 대상. 
처리/보류: 선행 UI-R10-02B PR #161. 키보드, 단위, 기록 저장·삭제 및 Health Connect 권한/로컬 저장 검수.

### 영상 옵션·보관함 (6)
- video-interval: 스모크 대상. 
- video-quality: 스모크 대상. 
- video-ratio: 스모크 대상. 
- video-photos: 스모크 대상. 
- video-overlay: 스모크 대상. 
- video-library: 스모크 대상. 
처리/보류: 이번 PR의 사진 전체 표시·옵션 레이블·빈 상태 및 저장 영상 카드 개선. 0/1/다수·옵션 적용·MP4·취소·앨범 저장은 실제 네이티브 QA 증빙 필요.

### 설정·계정·레거시 (5)
- account: 스모크 대상. 
- edit-login-required: 스모크 대상. 
- settings-reference: 스모크 대상. 
- legacy-advanced-settings: 스모크 대상. 
- legacy-studio: 스모크 대상. 
처리/보류: 이번 PR은 설정 진입 설명 개선. PR #156의 접근성·계정/온보딩 UI와 겹칠 수 있어 최종 main 통합 후만 완료 판정. 계정 결제/백업·로그인 게이트 불변.

### 온보딩 (3)
- onboarding-first-run: 스모크 대상. 
- onboarding-next: 스모크 대상. 
- onboarding-welcome: 스모크 대상. 
처리/보류: PR #156 검증 범위. 이번 PR에서 onboarding 파일 변경 없음. 150%·키보드·하단 버튼 실검증 필요.

## QA·병합 인수 기준

1. 정확한 최신 HEAD의 Quality(TypeScript/ESLint/Node/Firebase Rules·Functions/Android 빌드), Secret Scan 성공 및 미해결 리뷰 0건.
2. Stage13 Android 360/412/600/750dp × 라이트·다크 × 글꼴 100/130/150%=24환경 실제 PNG·XML·manifest/해시. 9개 핵심 + 32개 보조 키는 장비·캡처 조건에 따라 수가 달라질 수 있으므로 실제 성공/실패만 집계.
3. 저장 영상 0/1/다수, 비로그인 주 1회 및 유료 한도/영상 길이 초과, 사진 선택 0/1/다수, 간격·화질·비율·텍스트 시트, 원본 사진 누락/손상 및 MP4 저장·재생·취소에 대한 회귀 유지.
4. 설정 6그룹·150%·클라우드/결제/계정 삭제 안내 및 기존 운영 정책 보존. PR #156 최신 main 병합 후 settings 중첩 변경을 다시 검증한다.
5. 현재 UI-R10-02A #160, UI-R10-02B #161, UI-R10-02C #162, UI-R10-01D #156과 병합 순서 확인. QA 완료 전 독립 Draft PR 병합 금지.
6. 물리 ARM64 촬영, 사용자 실사진, TalkBack 발화, Play 결제·실제 클라우드 백업은 이 작업에서 검증 완료로 간주하지 않음.
7. **Google Play 내부/비공개/운영 업로드 금지**. 모든 UI-R10 기획 및 UI-R10-03/04 QA 완료 후 별도 승인 시에만 최종 배포.

## 참조
- v3 이미지 폴더: https://drive.google.com/drive/folders/1ElpylZuwTLdPA2VFqnyUO9PxKk8faCcT
- 9화면 기획·실화면 비교: https://docs.google.com/document/d/1Mh6-cyEVLhKfHHPP2NxvkeXc7x5Jesu1KiblWk0eeUg/edit
- 기존 Android 원본 증빙: https://drive.google.com/drive/folders/1ExCbwVZmYG42x0UkAt3-mtUNmV-IyZuu

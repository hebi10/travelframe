# TravelFrame C5 — 색감·줌·조명 패널 리디자인

- 디자인: Frame Journal / Body Frame, 블랙·차콜·그레이 중심. 불필요한 그림자·그라데이션·애니메이션 추가 없음.
- 기준: C4 PR #143, `feat/r3-frame-journal-camera-c4-20261109`.
- 신규 구현: `feat/r3-frame-journal-camera-c5-20261109` 스택형 PR. **아직 `main`에 병합하지 않음.**
- 기존 C0 Before QA에서 일부 작은 화면의 색감 패널 `설정 저장` 버튼 접근 오류가 3건 발생. C5는 해당 UI 배치를 직접 개선하되, 실제 Android After 캡처 및 버튼 접근 검증 전에는 해결됐다고 판단하지 않음.

## 1. 색감 패널

현재 `cameraColorFloatingOverlay`의 상/하단 동적 여백과 촬영 프리뷰 경계는 유지한다.

- 고정 헤더: `색감` 제목·설명·닫기 버튼
- 독립 스크롤: 5개 저장 슬롯 → 노출·온도·틴트·밝기·대비·채도 슬라이더
- **고정 푸터**: `초기화`와 `설정 저장`은 ScrollView 밖의 `cameraColorActions`에 배치해 작은 화면에서도 접근 가능하도록 개선
- ScrollView는 `flex: 1`, `minHeight: 0`; 컨텐츠는 슬롯·6개 슬라이더만 스크롤하며 스크롤 인디케이터 제공
- 푸터 버튼 접근성 이름 `색감 조절값 초기화` / `선택한 색감 슬롯에 현재 설정 저장` 추가
- 기존 `saveCameraColorSettings`, `resetCameraColorSettings`, `applyCameraColorSlot`, `queueAppSettingsUpdate`, 6개 값의 저장 의미·제한 범위·슬롯 5개 유지

## 2. 줌 및 조명 패널

- 공통 `cameraQuickPanel` 컨테이너: 어두운 배경·얇은 중립 테두리·44dp 이상 터치·반응형 버튼 줄바꿈
- 줌: `확대` 헤더와 현재 실제 배율 `cameraZoomFactor` 표기, 각 프리셋 `selected` 접근성 상태. 후면·전면 렌즈별 지원 배율과 `setZoomPreset` 유지
- 조명: `조명` 헤더에 `손전등 켜짐/꺼짐`, 후면 지원 불가 상태를 표시. 기존 켜기/끄기와 카메라 가용성 제한 보존, 두 버튼의 선택·비활성 접근성 상태 추가
- 플래시 촬영 설정, 카메라 방향 변경, 토치 세션 복구나 촬영 저장 로직에 새로운 정책 적용 없음

## 3. 테스트 및 수용 기준

- TypeScript/ESLint, Node 전체 회귀 및 C5 구조 테스트, Android Manifest/Kotlin, Firebase Rules/Functions, Gitleaks/GitGuardian
- Stage13 API35 실제 에뮬레이터 QA: 휴대폰 360/412dp, 태블릿 600/750dp 및 라이트/다크/글꼴 확대 케이스
- 신규 캡처: `camera-color-panel`, `camera-zoom-panel`, `camera-light-panel`. PDF/시안 이미지가 아닌 실제 네이티브 스크린샷(PNG), UI XML/JSON, SHA/실패 로그를 보관.
- 색감 패널을 연 직후 **별도 스크롤 없이** 초기화·설정 저장 두 버튼이 모두 사용 가능 화면 안에 있는지 `qa.target_bounds`로 검사. ScrollView 존재도 함께 확인.
- 색감 6개 슬라이더 스크롤, 슬롯 선택·저장·초기화 후 값 보존, 44dp 터치, 작은 화면과 150% 글꼴에서 겹침/잘림 여부는 실제 캡처 육안 검수.
- 실제 ARM64 기기에서 사진 색감·저장된 MP4(본 C5 작업 대상 아님)·줌 렌즈·플래시와 토치의 하드웨어 성능 및 OS 접근성 읽기 순서는 별도 수동 점검 필요.

## 4. 병합 및 배포

C0 검수 PR 별도 정리. C1 #140 → C2 #141 → C3 #142 → C4 #143 → C5 PR 순으로 검증·안전 병합한 뒤 C6/C7 진행.

현재 C5는 **Google Play 비공개 테스트 재배포를 요청하지 않음**. 앱 서명·릴리스 버전·스토어 이미지·Firebase 운영 배포·계정 데이터·저장 기능은 변경하지 않는다.

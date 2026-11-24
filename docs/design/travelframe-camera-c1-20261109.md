# TravelFrame C1 — Frame Journal 촬영 메인 리디자인

- 기준: `main@74c4a1a81506ae3ef5295445f5fff984a0a7f5d2`
- 콘셉트: Frame Journal — 같은 프레임에 기록하는 시간의 변화.
- 범위: 촬영 메인 화면의 상단 프로젝트, 프리뷰, 셔터 및 상태 안내. **모달/가이드 구성·저장 로직은 C2–C6으로 분리**.
- Before: [C0 캡처 PR #138](https://github.com/hebi10/travelframe/pull/138) / [Android run #42558968203](https://github.com/hebi10/travelframe/actions/runs/42558968203). C0 172상태 중 169정상·3실패(작은 화면 색감 설정 저장 버튼 접근, C5 대상).
- 새 UI는 이 파일에 열거된 앱 코드의 실제 표현이며, 생성형 디자인 시안과 무관하다.

## 변경사항

1. **상단 프로젝트 선택** — 계정 / 중앙 프로젝트 / 촬영 설정 3열은 보존. 중앙 `BodyFrameProjectSwitcher`만 높이 48dp, 제목 14sp, 진행 메타 11sp로 정리하고 별도 큰 정보 카드를 만들지 않는다.
2. **프리뷰** — 상단에서 '오늘 N번째 기록' 안내를 제거하여 촬영 콘텐츠가 보이게 한다. 카메라 렌더·초점·제스처·가이드·참고사진 정렬·선택 비율 계산은 유지.
3. **셔터 트레이** — 갤러리 52dp / 셔터 68dp / 기준 사진 조작 72×52dp를 한 줄의 중심축에 정렬. 어두운 단색 바탕과 여백·선 두께만 미세 보정, AI식 일러스트·그라디언트·그림자 추가 없음.
4. **상태 안내** — 현재 프로젝트/첫 사진/플랜 제한 문구를 셔터 바로 위의 1–2줄 전용 슬롯에 표시. 사진 저장 후 'N번째 사진 저장'은 같은 슬롯에 4.2초 동안 교체 표시. 수치 기록·플랜 보기 CTA와 접근성 액션은 유지. 색감/줌/조명 패널, 기준사진 편집, 모달을 열면 상태 슬롯을 숨겨 도구와 겹치지 않게 한다.
5. **측정 기반 레이아웃** — 기존 `cameraControlsHeight` 측정과 `CAMERA_PREVIEW_CONTROL_GAP` 계산을 그대로 써서 새 상태 슬롯 높이까지 카메라 프리뷰의 안전 영역에 반영. 원본 카메라 가로세로 비율·촬영 파일 처리에는 영향 없음.

## 수정 파일

- `features/camera/BodyFrameCameraScreen.tsx`: 상단 절대 위치 안내/별도 스낵바를 셔터 트레이 상태 슬롯으로 통합
- `features/camera/CameraScreen.tsx`: `footerStatus` 슬롯 및 상단 Safe Area 조정
- `features/camera/camera-screen.styles.ts`: 트레이·촬영 버튼·상단 아이콘 대비 및 간격
- `features/camera/BodyFrameProjectSwitcher.tsx`: `compact` 스타일만 정리, 선택/생성 모달 불변
- `tests/body-frame-camera-c1-layout.test.mjs` 및 기존 헤더/Stage B 계약 테스트

## 수용 기준

- 프로젝트 0/1/다수, 긴 이름·0장·상한 달성: 안내와 액션이 카메라 헤더나 셔터를 가리지 않을 것.
- 촬영 성공, 저장 중, 저장 완료, 수치 기록 CTA: 기존 `saveMessage`와 ID 연결 유지, 클릭 가능.
- 다크/라이트, 360/412/600/750dp, 글꼴 100/130/150%: 카메라 프리뷰 및 셔터, 44dp 액션, 탭 바의 잘림/겹침 없음.
- 기존 1:1/3:4/4:3/4:5/9:16/16:9 프리뷰 위치, 전면·후면, 손전등/플래시, 가이드·사진 오버레이, 타이머·연속 촬영, 사진 저장/원본 보존 회귀 테스트 통과.
- 디바이스 프리뷰는 에뮬레이터 합성 이미지로만 자동 검증 가능; ARM64 실제 광학 품질/실사진·OS 권한/실계정 구독·백업 미검증으로 분리.

## QA/배포 안전

- GitHub PR의 TypeScript, Lint, Node 테스트, Firebase Rules, Functions, Android Manifest/Kotlin, Secret Scan, Native Android QA와 Stage13 디자인 캡처를 판정 근거로 기록.
- **main 병합 전 PR 캡처**. C0 이미지 169개는 변경 전 기준이며 현재 C1의 After 증거가 아니다.
- Google Play 내부/비공개/프로덕션 트랙, 업로드키, Firebase, 원격 데이터, 결제, 광고, 앱 출시 버전은 변경·게시하지 않는다.

# TravelFrame C0 — 촬영 탭 Android Before 캡처 기준

- 날짜: 2026-11-09 KST
- 기준 앱 소스: main@74c4a1a81506ae3ef5295445f5fff984a0a7f5d2
- 디자인 기준: Frame Journal — 같은 프레임에 기록하는 시간의 변화
- 목적: C1~C7 리디자인 착수 전에 촬영 탭·모달·조작 상태의 실제 Android Before PNG 및 UI XML 확보.
- 변경 범위: QA 스크립트/워크플로만. 앱 코드·테마·촬영/저장 데이터/권한/결제/백업 동작 변경 없음.
- 배포: Google Play, Firebase 운영 환경 게시 없음.

## 모달 및 패널 전체 인벤토리

1. 촬영 기본 / 프로젝트 진행률 / 셔터 / 갤러리 / 기준 사진
2. 프로젝트 선택 Modal, 새 프로젝트 Modal, 빈 프로젝트/생성/키보드/플랜 제한
3. 촬영 설정 Modal: 촬영 도구 / 방향 / 타이머 / 비율 / 플래시 / 촬영 품질 / 저장 범위 / 셔터음 / 햅틱
4. 가이드 설정 Modal: 유형 7종 / 크기 / 선 두께 / 색상 / 표시 / 그리드 및 도형 위치
5. 최초 실행 및 사용 가이드 Modal: 첫 화면, 다음 화면, 다시 보기
6. 기준 사진 위치·투명도 10~85%·크기 및 첫 사진/최근 사진 전환
7. 색감 패널: 저장 슬롯 / 노출 / 온도 / 틴트 / 밝기 / 대비 / 채도 / 저장·초기화
8. 줌·라이트 플로팅 패널과 가이드 위치·모양·선 조정 상태
9. 카메라 권한 거부, 사진 저장 상태·앨범 권한 안내, 오류·스낵바
10. 촬영 미리보기 라우트와 앱 설정의 촬영 옵션 동기화(인접 경로, 필요 시 후속 확인)

관련 소스: features/camera/CameraScreen.tsx, BodyFrameCameraScreen.tsx,
BodyFrameProjectSwitcher.tsx, components/app-guide-overlay.tsx,
components/photo-reference-overlay.tsx, features/settings/BodyFrameSettingsScreen.tsx.

## Android 자동 캡처 기준

- 360/412/600/750dp, API 35 google_apis x86_64 에뮬레이터.
- 다크 100%, 라이트 130%, 핵심 모달의 다크/라이트 150%.
- 기준 APK는 QA 브랜치에서 빌드하되 앱 코드/리소스는 위의 main 커밋과 완전히 동일한 범위만 사용.
- 오프라인 로컬 게스트, 합성 숫자 사진 1·2·3. 사용자 계정·사진·클라우드·결제 액세스 금지.
- 각 프로필 아래 PNG/XML/JSON, gallery.html, screen-index.csv, capture-manifest.json, logcat 저장.
- 누락된 조작/검은 화면/설정 접근 불가 등은 실패 PNG·XML과 이유로 표시; 캡처 성공으로 대체하지 않음.
- C0 통과는 Android UI/이미지 증거로만 판정. 실제 인체 사진, 카메라 광학, ARM64, TalkBack 발화, Google Play Billing/Health Connect/Firebase 동작은 별도 검증.

## 캡처 후 육안 검수 항목

- 상단 프로젝트와 안내문 겹침, 카메라 프리뷰 높이, 셔터·보조 버튼 정렬
- 설정 Modal과 가이드 Modal의 색상·선택 상태·타이포 불일치
- 색감 패널 가림, 줌/라이트 사용 불가 시 표시, 가이드 도형·라인 편집
- 프로젝트 새로 만들기와 키보드, 버튼 잘림, Safe Area
- 시스템/앱 글자 확대 및 라이트·다크 대비
- 사진 저장 중 프로젝트 전환/실패 안내·권한 선택지의 원래 동작 보존

**상태: C0 실행 준비 문서. 실제 성공 수와 결과 ZIP 링크는 캡처 이후에만 기록.**

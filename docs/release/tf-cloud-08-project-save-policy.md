# TF-CLOUD-08 — 프로젝트별 저장 정책 구현 및 검증

- 기준: 2026-11-18 Google Drive 프로젝트별 저장·촬영 직후 수치 입력 기획
- 분기: feature/tf-cloud-08-project-save-mode-20261118
- 사용자 저장 모드: 클라우드 / 로컬+클라우드 / 로컬에만
- 앱 보관함은 항상 필수. '로컬'은 앱 저장 외 기기 앨범 사본.
- 신규 프로젝트 기본값 local_only. 기존 프로젝트 saveMode 미설정 상태와 전역 cameraSaveScope는 무손실 보존; 새 모드를 명시적으로 선택하면 해당 프로젝트에만 적용.
- 촬영 전 프로젝트 정책 및 현재 프로젝트 ID를 확인하고 촬영 후 앱 보관함 저장을 먼저 처리. 기기 앨범 권한 거부·Firebase 실패는 앱 내부 저장을 롤백하지 않음.
- 프로젝트별 유료 클라우드 모드는 인증된 Pro 이상 사용자 및 지정된 백업 슬롯을 필수 확인. 로컬 전용 프로젝트는 신규 자동/수동 사진·연결 영상 백업에서 제외.
- 기존 원격 백업은 저장 모드 전환 시 삭제하지 않는다. 새 기기 프로젝트 단위 복원·측정 수치/프로젝트 설정 백업은 TF-CLOUD-01~03에서 구현.
- 이번 기능은 코드/검증 PR 단위. Firebase 운영/Google Play/AdMob 업로드 금지.

## 개발 후 확인
- 앱 보관함 저장은 기기 앨범 또는 네트워크 실패보다 선행
- 각 프로젝트 저장 모드 독립, 원본 photoId와 sequence 유지
- 구독/슬롯 미충족 시 클라우드 변경 안내
- 단말 저장 공간/저장 권한 부족 시 앱 내부 보존 확인
- 기존 cameraSaveScope=app/device/cloud 등 조합의 실기기·회귀 테스트
- Firebase Rules 및 구독·백업 업로드의 실제 스테이징 검증
- Android 다양한 화면/계정/구독 전환 후 촬영 확인

기획서: https://docs.google.com/document/d/1WFGiKf3r8wKFRi2khGpb4i1fPbIWfaRyF888IRV5gFY/edit

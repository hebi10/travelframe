# PR #72·#111 선택적 이관 — 2026-11-08

최신 main 기준. 오래된 PR을 직접 병합하지 않고 아직 필요한 변경만 이관합니다.

- PR #72: 대부분의 디자인·접근성 변경은 A~D 단계에 이미 반영됐습니다. 레거시 영상 편집의 음악 미리듣기 버튼 높이(34→44dp), 가이드 색상(9px 글자) 및 음악/색상 컨트롤의 TalkBack role/label/selected/disabled만 보완합니다. MP4 출력과 작업물 복원 로직은 변경하지 않습니다.
- PR #111: 최근 네이티브 QA는 성공했지만 `capture-devices` 작업의 FFmpeg 준비 구간에 무제한 네트워크 패키지 설치가 남아 있습니다. Ubuntu 24.04로 러너를 고정하고 FFmpeg 확인·설치의 시간 상한을 적용합니다. 앱/QA 데이터 및 Play 게시 워크플로는 불변입니다.
- PR #75: 예시 사진 기반 Play 마케팅 캡처는 기존 고정 APK SHA와 현재 main이 다르므로, 이전 브랜치를 병합하지 않고 최신 커밋의 실제 APK를 기준으로 별도 재검토합니다.

검증: 전체 Quality, Secret Scan, Android APK/기능 QA 및 QA 준비 회귀 테스트. Play/Firebase 운영 배포를 하지 않고, 검증된 변경만 [skip ci] 병합합니다. 실제 ARM64와 TalkBack 음성 탐색은 후속 수동 QA로 계속 보류합니다.

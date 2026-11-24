# TF-FINAL-08 — 최종 Android QA 사전 보완 (2026-11-24)

기준 main a2cd8f8a9530a1f1e604b5a4a592473fa075f37e (PR #203 병합). 2026-11-24의 이전 실제 실행 https://github.com/hebi10/travelframe/actions/runs/45302725434 에서 APK 생성 성공 후 캡처 및 MP4 QA가 실패했다.

- 실제 Android hierarchy의 비교 화면 헤더는 '이전 · #1', '현재 · #3'이다. capture-android-qa.py는 현재 라벨을 이미 검증한다. Stage13 CASES의 비교 화면만 이전 라벨('첫 사진', '마지막 사진')을 요구하는 것이 확인되었다. 동일한 실제 시드 사진의 두 순번을 기대하도록 맞추며 비교 검증 자체를 제거하지 않는다. 24환경 및 캡처 수 유지.
- 독립 MP4 검사 job 138146638861에서 FFmpeg 설치가 exit 124로 종료되었다. 필수 영상/캡처 job의 FFmpeg·FFprobe 설치를 기존 capture-devices의 150초 update/600초 install, 제한된 HTTP(S) 재시도 및 비대화형 방식으로 정합화한다. 실제 두 도구 사용 가능 여부를 확인한다. 독립 검증 job 시간은 25분으로 조정한다. 검사 실패를 성공으로 바꾸거나 증거 없이 통과시키지 않는다.
- 실제 Android QA 워크플로의 main SHA 동결, release_qa=true, workflow_dispatch 조건 및 출시 필수 9개 job을 유지한다. Play/서명/Firebase 승인 게이트 변경 없음.
- 기존 native MP4의 실제 파일 H.264, 720x960, 9프레임, 원본·취소·해시 및 캡처 검증을 보존한다. ARM64 실기기, FHD/BGM 및 100/200/365장 실제 시간/메모리 검증은 별도 필요. 100/200/365장 모의 테스트 통과는 실제 성능 측정이 아니다.
- 이 PR의 Quality 및 호스트 회귀 검사 결과와 최신 main의 정확한 SHA를 확인한 뒤 최종 Android QA를 수동으로 한 번만 실행한다. 이전 실패 실행을 재실행하거나 과거 SHA의 성공을 재사용하지 않는다.

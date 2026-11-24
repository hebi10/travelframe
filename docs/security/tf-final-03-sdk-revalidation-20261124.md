# TF-FINAL-03 — SDK 호환성 후보 최신화 및 Android 의존성 근거

- 기준 main: bcb8b73ef8e34effeba1f6a919e69f66d937284d (PR #198~200 병합, Quality / Secret Scan / OPS-08 성공).
- 기존 후보 PR #128은 최신 main보다 434개 커밋 뒤에 있었다. 최신 main 트리에서 후보의 SDK lockfile, SDK 버전 계약, 격리된 emulator/staging 스크립트만 이관한다. 기존 main의 Gitleaks 및 Quality 정책 유지. 운영 데이터, 앱 잠금 파일, 배포 승인/키/가격 변경 없음.
- Functions SDK 후보는 기존에 시험한 Admin 14.5.0 / Functions 7.4.0의 lockfile을 그대로 사용한다. 최신 배포 대상 버전이라고 주장하지 않는다. 등록 계약에 deleteCloudBackupProject를 포함하고 전체 export 이름 일치를 검사한다.
- Dependency Audit는 기존 npm audit 보고서에 Android 생산 JavaScript/Hermes export의 소스맵 기반 패키지명 포함 여부, lockfile의 영향받는 위치·버전, npm explain 의존 관계를 추가한다. 실제 소스맵, 번들, 원본 소스 내용은 artifact로 게시하지 않는다. React, React Native, Expo Router의 소스맵 경로가 확인되지 않으면 판정을 중단한다. 패키지 포함 여부는 취약 함수 실행 여부나 서명 APK 안전성 증명이 아니다.
- 공식 Expo 참고: https://docs.expo.dev/guides/analyzing-bundles/ , https://docs.expo.dev/guides/using-hermes/
- #128은 Draft 유지. 독립 스테이징 실제 검증, 라이선스 테스트 결제/환불/RTDN, 이전 버전 호환성 및 보안 위험 검토 전 main 병합 금지. 기존 승인 SHA를 새 커밋에 재사용하지 않는다. #106/#125/#192 유지.

검증: 후보 최신 HEAD의 Quality, Secret Scan, OPS 정책, Dependency Audit 및 실제 Firebase emulator 결과를 확인한다. 스테이징 승인이 없으면 실행하지 않는다. 결과를 얻기 전 성공으로 표시하지 않는다.

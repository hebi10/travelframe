# Stage 18 — Firebase Functions Admin 모듈형 API 선행 전환 (2026-11-08)

## 범위

- 기준 `main@b39aa30714aa55e7d228254ba683d9f627a2dde4`.
- Firebase 공식 [Admin 모듈형 이전 가이드](https://firebase.google.com/docs/admin/migrate-node-v10) 기준: `firebase-admin/app`의 `initializeApp`, `firebase-admin/firestore`의 `getFirestore`, `FieldValue`, `Timestamp`, `firebase-admin/storage`의 `getStorage`로 변경.
- 결제 생성자의 실제 미사용 `admin` 인자를 제거하되 Firestore/타임스탬프/HttpsError 주입은 유지.
- 런타임 의존성 검사는 `google-gax/build/src/fallback` 비공개 내부 경로 대신 공식 공개 import 및 Firebase 모듈형 API를 검사.
- Functions package/lockfile의 Firebase Admin 13.10.0, Functions 6.6.0, Node 22, body-parser 1.20.9, qs 6.16.1 보존.
- 관리자 파괴적 삭제 스위치, 백업 세션·권한, Pro/Plus/Expert 구매 검증·RTDN, 운영 Firebase/Play/AdMob 설정 변경 없음.

## 단계별 검증

1. 현재 버전의 Functions `npm ci` / `npm run quality:functions`(Node 22) / 전체 TypeScript·Lint·테스트·Firebase Rules / Secret Scan.
2. Android 빌드·기능 회귀 QA: 실제 앱 코드는 변경하지 않더라도 Cloud callable 계약 오류가 없는지 최종 확인.
3. 이후 **별도 격리 PR**로 Admin 14 + Functions 7 + 새 lockfile 업데이트, 런타임 `npm ci`·실제 Function 로딩·callable 이름·결제/백업의 기능 회귀 검증.
4. SDK 메이저 변경은 새 Firestore / Cloud Storage / Gax 전이 의존성과 권한·응답 차이, RTDN·백업 안전성을 테스트 프로젝트에서 증명하기 전 `main` 병합 금지.
5. 테스트 프로젝트 검증과 실제 ARM64/Play 구매/환불/RTDN, 운영 Rules·Functions 배포 버전 대조가 완료되기 전 출시 승인 금지.

## 보안 판단

이 선행 전환만으로 npm audit 앱 high 9개 또는 Functions moderate 8개가 **줄었다고 주장하지 않는다**. 실제 의존성 버전을 바꾸지 않았으므로 보안 이슈 [#106](https://github.com/hebi10/travelframe/issues/106), SDK 업그레이드 이슈 [#125](https://github.com/hebi10/travelframe/issues/125), 출시 차단 이슈 [#63](https://github.com/hebi10/travelframe/issues/63)는 모두 열린 상태를 유지한다.

개발·CI 코드 검증을 통과해도 Firebase 운영 배포·Play 테스트 업로드 또는 실제 결제·기기 검증을 자동 수행하지 않는다.

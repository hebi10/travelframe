# TravelFrame 16단계 — Android 외부 링크 DoS 방어 및 잔여 위험

기준: 2026-11-06, 시작 커밋 `main@ff0dbcff8f8bde3d59eb53d48417c984d40b0d64`

## 변경 범위
- `app/+native-intent.tsx`의 Expo Router 공식 `redirectSystemPath` 진입점에서 비정상·과도한 Android 외부 링크를 앱 기본 화면으로 안전하게 돌립니다.
- `lib/native-deep-link.ts`: 최대 4096자, 쿼리 최대 2048자/64개 필드, 잘못된 % 인코딩·UTF-8 및 제어 문자를 통과시키지 않습니다. 기존 정상 라우트, OAuth 리디렉션, 한글 인코딩은 원문을 그대로 전달합니다. 개인 정보·링크 값을 로그에 기록하지 않습니다.
- `tests/body-frame-stage16-native-link-security.test.mjs`: 유효/유해/과대 URL 동작과 출시 승인 게이트 보존 확인.
- JavaScript/TypeScript 레벨의 진입점 보완으로 Expo SDK/React Native/Router/Firebase·Android 네이티브 코드, 계정·사진·영상·과금 모델은 변경하지 않습니다.

## 근거 및 한계
- `expo-router@55.0.14 → query-string@7.1.3 → decode-uri-component@0.2.2`의 외부 문자열 과도한 처리/DoS 경로가 남아 있습니다. 해당 패키지의 직접 수정판은 `decode-uri-component >=0.5.1`이나, 기존 query-string 7의 CommonJS 호환성을 확인하지 않고 전역 npm override를 해서는 안 됩니다.
- 이 조치는 **Android OS가 Expo Router에 전달하는 시스템 경로의 위험 입력을 제한**하는 방어 계층이지, npm 감사상 취약 패키지를 없애거나 앱 내부의 모든 decode API 호출을 검사한다는 의미가 아닙니다. `npm audit` high 수치가 그대로 남아도 놀라지 않아야 합니다.
- Expo CLI의 `zod@3.25.76`는 수정판 Zod 4와 호환 검증 전 강제 업데이트하지 않습니다.
- Firebase Firestore가 고정하는 Node gRPC `@grpc/grpc-js@~1.9.0` 역시 수정 버전 1.13.6으로 강제 대체하면 의존 범위를 벗어납니다. 실제 Android release bundle 포함/사용 여부를 분리 확인해야 합니다.

## 출시 차단 유지
- [ ] 실제 Android deep link와 Google 로그인 리디렉션 실기기 검증
- [ ] SDK 55 내 해결 가능한 라우터/Expo 패치 및 번들 분석
- [ ] Firebase Firestore·백업 및 Node gRPC의 실사용 경로/취약 API 영향 검토
- [ ] Functions moderate 9개 안전한 SDK 조합 검토
- [ ] 변경 후 npm audit full/production/Functions 재실행 및 증거 보관
- [ ] ARM64 실기기 QA, Play 인증서 3자 대조, 실제 구매·복원/RTDN

개발자용 CI 통과만으로 취약점 수정이나 Google Play 출시 승인을 주장하지 않습니다.

추가 주의: `decode-uri-component@0.5.0`도 2026년 10월 공개된 quadratic replacement DoS (GHSA-qr28-fpjm-wq7f)에 영향받으므로, 패치 호환성 평가 시 0.5.1 이상을 기준으로 삼아야 합니다. 기존 CommonJS 기반 query-string 7에 단독 오버라이드하지 않습니다.

## 최신 main 통합 및 추가 DoS 완화 (2026-11-08)
- 기준 main: `271064567d3b6ab6836d95ca90d59e3eae93a112`. 이 PR은 보안 파일 5개만 최신 A/B/C/D 디자인/QA 코드 위에 재적용하여 기존 변경을 보존합니다.
- 외부 시스템 URL 최대 4096자·쿼리 2048자/64 필드 외에 **'%' 인코딩 구간 개수 96개 상한**을 추가했습니다. Native Router에 넘기기 전에 선형 시간으로 검사하고 초과 시 '/'로 대체합니다. 일반 한글 인코딩 및 Google 로그인 콜백을 유지합니다.
- 2026-11-06 `npm audit` 기준 앱 high 9 패키지(Expo Router/Query-string/decoder, Firestore/gRPC, Expo CLI/Zod), Functions moderate 9개는 **패키지 자체의 미수정 경고**입니다. 본 PR은 URL 유입 공격면 완화이며 `npm audit` 개수 감소를 의미하지 않습니다.
- `decode-uri-component`는 최신 GitHub Advisory `GHSA-qr28-fpjm-wq7f`상 0.5.1 이상 필요하지만 Expo Router 55가 요구하는 `query-string@^7.1.3`의 CommonJS API와 일괄 오버라이드의 호환성이 검증되지 않았습니다. 기존 Expo SDK 55/React Native 0.83/Google OAuth 코드를 임의 변경하지 않습니다.
- `@grpc/grpc-js@1.9.16`의 인증 컨텍스트 advisory(`GHSA-m9gg-hp2v-232j`)는 Node **gRPC 서버의 `getAuthContext` 사용 조건**을 설명합니다. Android Metro 번들/실제 서버 노출이 입증되지 않았고 Firestore의 의존 범위는 `~1.9.0`이므로 강제 1.13.6은 보류합니다.
- Expo CLI의 `zod@3.25.76`은 4.6.6 이상 변경 시 메이저 API 호환성이 검증되지 않아 강제 수정하지 않습니다. Functions 잔여 moderate는 firebase-admin 13.x/fn 6.x 범위 밖 상위 SDK 업그레이드·운영 결제/백업 회귀가 필요합니다.
- 호환 가능한 라이브러리 패치만 별도 검토/검증 후 적용합니다. **출시 차단 이슈 #106은 OPEN**입니다.

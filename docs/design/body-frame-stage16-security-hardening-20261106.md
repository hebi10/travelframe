# TravelFrame 16단계 — Android 외부 링크 DoS 방어 및 잔여 위험

기준: 2026-11-06, 시작 커밋 `main@ff0dbcff8f8bde3d59eb53d48417c984d40b0d64`

## 변경 범위
- `app/+native-intent.tsx`의 Expo Router 공식 `redirectSystemPath` 진입점에서 비정상·과도한 Android 외부 링크를 앱 기본 화면으로 안전하게 돌립니다.
- `lib/native-deep-link.ts`: 최대 4096자, 쿼리 최대 2048자/64개 필드, 잘못된 % 인코딩·UTF-8 및 제어 문자를 통과시키지 않습니다. 기존 정상 라우트, OAuth 리디렉션, 한글 인코딩은 원문을 그대로 전달합니다. 개인 정보·링크 값을 로그에 기록하지 않습니다.
- `tests/body-frame-stage16-native-link-security.test.mjs`: 유효/유해/과대 URL 동작과 출시 승인 게이트 보존 확인.
- JavaScript/TypeScript 레벨의 진입점 보완으로 Expo SDK/React Native/Router/Firebase·Android 네이티브 코드, 계정·사진·영상·과금 모델은 변경하지 않습니다.

## 근거 및 한계
- `expo-router@55.0.14 → query-string@7.1.3 → decode-uri-component@0.2.2`의 외부 문자열 과도한 처리/DoS 경로가 남아 있습니다. 해당 패키지의 직접 수정판은 `decode-uri-component >=0.5.0`이나, 기존 query-string 7의 CommonJS 호환성을 확인하지 않고 전역 npm override를 해서는 안 됩니다.
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

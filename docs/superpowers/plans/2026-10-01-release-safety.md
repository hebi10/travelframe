# 출시 전 광고·결제 보완

## 범위
사용자가 승인한 2026-10-01 출시 점검의 코드 보완. Android 전용, 기존 상품·가격·프로젝트 한도 유지. 운영 배포, 실제 구매, AdMob 승인 및 실기기 QA는 별도이며 완료로 추정하지 않는다.

## 순서
- [x] 실제 subscription/ad-entitlement 소스를 실행하는 회귀 테스트에서 8개 실패 확인.
- [x] 캐시 읽기·쓰기 실패와 서버 검증 실패 분리, 확인 전 광고 보류, 독립 광고 제거 권한 유지. 전체 Node 테스트·타입·린트 통과 확인.
- [x] 실제 purchaseProduct 콜백 테스트에서 6개 플랜 변경과 확인 취소 오류 재현.
- [ ] 구독 변경 안내·시간 비례 전환·서버 검증 흐름 전체 CI 확인.
- [ ] 전면 광고 실패·타임아웃·화면 이탈·빈도 제어 회귀 테스트 및 구현.
- [ ] 현재 BodyFrameVideoScreen 저장 성공 경로 연결 및 실패 시 광고 미요청 검증.
- [ ] UMP 동의 확인, 요청 차단, 개인정보 옵션 진입점, 측정 초기화 지연.
- [ ] 출시 문서 최신 한도와 외부 확인 항목 정리.
- [ ] 최종 커밋 CI와 PR 변경 내용 재확인.

## 결정
상향·하향 모두 WITH_TIME_PRORATION을 사용한다. 기존 서버의 즉시 권한 전환 모델을 유지하며 가격/프로모션 차이로 CHARGE_PRORATED_PRICE가 하향에 사용되는 문제를 피한다. 변경 전 기능·백업 한도 즉시 적용, 남은 금액의 기간 환산, 다음 결제일 변동을 명시한다. DEFERRED(다음 갱신 전환)를 구현한 것으로 설명하지 않는다.

광고 상태 미확인은 광고를 보류하는 근거일 뿐 클라우드 유료 권한을 부여하는 근거가 아니다. 현재 무료 로그인 사용자만 광고 대상이며 비로그인 showAds=false 정책을 유지한다.

## 검증 근거
- RED 광고: Quality 36846716770, Typecheck/Lint/Test job 110318488866.
- GREEN 광고: Quality 36847172895, Typecheck/Lint/Test job 110319968054.
- RED 결제: Quality 36847561261, Typecheck/Lint/Test job 110321245860.
- 기본 CI는 출시 AAB 전체 빌드나 실제 결제·광고 송출을 대체하지 않는다.

## 공식 참고
- https://developer.android.com/google/play/billing/subscriptions
- https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent

## 출시 전 별도 확인
기존 npm ci에서 7개 취약점 경고(중간 3, 높음 4)가 출력됐다. 상세 영향 분석 없이 npm audit fix --force를 실행하지 않는다. 운영 Functions/Rules/RTDN, Play 상품 활성화·복원·환불, AdMob 승인·app-ads.txt, Health Connect 신고, 실제 ARM64 기기 및 출시 AAB는 별도 증빙이 필요하다.

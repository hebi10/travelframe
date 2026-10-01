# 출시 전 광고·결제 보완

## 범위
사용자가 승인한 2026-10-01 출시 점검의 코드 보완. Android 전용, 기존 상품·가격·프로젝트 한도 유지. 운영 배포, 실제 구매, AdMob 승인 및 실기기 QA는 별도이며 완료로 추정하지 않는다. 수정 브랜치는 `fix/release-readiness-2026-10-01`, PR은 #56이며 main은 변경하지 않았다.

## 코드 보완 결과
- [x] 실제 subscription/ad-entitlement 소스의 회귀 테스트에서 8개 실패 확인 후 수정.
- [x] 캐시 읽기·쓰기 실패와 서버 검증 실패 분리, 확인 전 광고 보류, 독립 광고 제거 권한 유지.
- [x] 실제 purchaseProduct 콜백에서 6개 플랜 변경과 확인 취소 오류를 재현하고 수정.
- [x] 구독 변경 안내·시간 비례 즉시 전환 구현, 결제 요청 회귀 검사 통과.
- [x] 전면 광고 실패·타임아웃·화면 이탈·동시 요청·빈도 제어 구현 및 회귀 검사 통과.
- [x] 현재 BodyFrameVideoScreen 저장 성공 경로 연결, 실패 시 광고 미요청과 광고 오류의 저장 결과 격리 검증.
- [x] UMP 동의 확인·요청 차단·개인정보 옵션 진입점·측정 초기화 지연·생성된 Android R8 규칙 검사.
- [x] 기존 얇은 Expo Router 구조 유지. 설정 화면은 feature 모듈에서 개인정보 옵션과 합성.
- [x] 출시 문서의 최신 한도와 외부 확인 항목 정리.
- [x] 코드 커밋 `00b375323c875c66d735f147e4f2a2fb55f21da8`의 전체 Node 테스트·TypeScript·lint·clean prebuild·release:verify·비밀정보 검사·Functions·Firebase Rules 통과 확인.
- [x] 위 코드 커밋의 Android 릴리스 매니페스트 검사 통과 확인.
- [ ] Android Kotlin 컴파일의 최종 결과 확인. 이 기록을 작성할 때 해당 단계는 실행 중이었다. 최신 완료 상태는 PR의 Checks와 검증 결과 요약을 기준으로 확인.
- [ ] 출시 AAB·실제 결제·광고 송출·실기기 QA. 코드/CI 통과와 별개.

## 결정
상향·하향 모두 WITH_TIME_PRORATION을 사용한다. 기존 서버의 즉시 권한 전환 모델을 유지하며 가격/프로모션 차이로 CHARGE_PRORATED_PRICE가 하향에 사용되는 문제를 피한다. 변경 전 기능·백업 한도 즉시 적용, 남은 금액의 기간 환산, 다음 결제일 변동을 명시한다. DEFERRED(다음 갱신 전환)를 구현한 것으로 설명하지 않는다.

광고 상태 미확인은 광고를 보류하는 근거일 뿐 클라우드 유료 권한을 부여하는 근거가 아니다. 현재 무료 로그인 사용자만 광고 대상이며 비로그인 showAds=false 정책을 유지한다.

## 검증 근거
- RED 광고: Quality 36846716770, job 110318488866.
- GREEN 광고: Quality 36847172895, job 110319968054.
- RED 결제: Quality 36847561261, job 110321245860.
- 코드 커밋 00b3753의 Quality: https://github.com/hebi10/travelframe/actions/runs/36850306036
- 전체 테스트·타입·lint·release:verify·비밀정보 검사: job 110330117020 성공.
- Functions: job 110330116539 성공. Firebase Rules: job 110330117018 성공.
- 신규 회귀 검사 52개: 광고 권한 15, 결제 변경 9, 동의/영상 저장 9, 전면 광고 8, 화면 생명주기 11. 생성된 Android manifest/R8 규칙도 별도 assertion으로 확인.
- 실제 소스를 실행하되 Play·AdMob·Firebase·React Native 경계는 테스트 대역을 사용한다. 실제 구매나 광고 송출이 성공했다는 의미가 아니다.
- 이 문서 갱신은 코드 검증 이후의 문서 전용 변경이다. 이후 커밋의 CI 결과는 별도로 확인한다.

## 공식 참고
- https://developer.android.com/google/play/billing/subscriptions
- https://developers.google.com/admob/android/privacy
- https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent

## 출시 전 별도 확인
npm ci에서 7개 취약점 경고(중간 3, 높음 4)가 출력됐다. 상세 영향 분석 및 의존성 보완은 미완료이며 npm audit fix --force를 실행하지 않았다. 운영 Functions/Rules/RTDN, Play 상품 활성화·복원·환불, AdMob 승인·app-ads.txt·지역별 개인정보 메시지, Health Connect 신고, 실제 ARM64 기기 및 출시 AAB는 별도 증빙이 필요하다.

광고 동의의 네이티브 설정이 변경되어 Android 빌드를 다시 생성해야 한다. 자세한 검증 항목은 `docs/release-ad-billing-qa.md`와 `docs/body-frame-release-checklist.md`를 사용한다.

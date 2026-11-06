# TravelFrame Stage 15 — 전체 회귀 검증·Play 출시 준비

기준: 2026-11-06 (KST), `main@cdad09e74f8f116f141ff8149c1e6bbd2e23e1d0` (14단계 디자인 보정)

## 판정 원칙
- **소스/CI 정상 ≠ 출시 승인**: 테스트 대역과 합성 데이터는 실제 Google Play 결제, 실기기 카메라, Firebase 운영 권한을 검증하지 못한다.
- 앱 데이터/프로젝트/수치/사진/영상 처리 및 원격 데이터 모델은 Stage 15에서 변경하지 않는다.
- Play 서명·신규 승인값·테스트 트랙은 자동 생성/수정하지 않는다. 업로드는 2026-11-07 11:01(KST) 이후라도 기존 게시 승인, Play Console 인증서 비교, 릴리스 계획이 먼저 필요하다.
- 승인되지 않은 결과는 모두 **미검증**으로 기록하고, 생체사진·구매 토큰·서명키·Firebase 인증값·실사용자 정보를 기록하지 않는다.

## 기존 완료 증거 (Stage 14)
| 영역 | 확인된 근거 | 판정 |
| --- | --- | --- |
| 최신 main TypeScript·ESLint·전체 Node 테스트 | [main Quality #42184439759](https://github.com/hebi10/travelframe/actions/runs/42184439759) | 성공 |
| Firebase Rules·Functions / Android Kotlin·Release Manifest | 동일 Quality 워크플로 | 소스·생성 Android 프로젝트 검사 성공 |
| Secret Scan | [#42184439854](https://github.com/hebi10/travelframe/actions/runs/42184439854) | 성공 |
| 에뮬레이터 실제 QA·영상 제작 smoke | [Stage 14 Native QA #42183879197](https://github.com/hebi10/travelframe/actions/runs/42183879197) | 성공 (소스 트리 동일) |
| 360·412·600·750dp / 다크·라이트·큰 글씨 | [232개 화면별 실제 캡처 및 시안 비교](https://drive.google.com/file/d/1oB3-Q8gnvyiwicb79QgpNSDMFyxDt3vn/view) | 캡처 232/232, PNG 무결성 검증 |
| 업로드키·Play inventory 무게시 사전 점검 | [기존 Play Preflight #42155636459](https://github.com/hebi10/travelframe/actions/runs/42155636459) | 설정된 서명키/Play 목록 조회 성공. Play Console 인증서 지문 대조는 별도 필요 |
| Play 자동 게시 | [main Play workflow #42184439787](https://github.com/hebi10/travelframe/actions/runs/42184439787) | skipped, 실제 AAB 업로드·게시 없음 |

## 15단계 자동화 추가
- `scripts/report-stage15-release-readiness.mjs`: 저장소 소스 계약 12개 영역과 기존 핵심 회귀 테스트 8개 영역의 등록 여부만 오프라인 확인. 기기·운영 환경 10개 항목은 **명시적으로 수동 증거 필요**로 기록. 출력 `stage15-release-readiness.json`, `stage15-release-readiness.md`.
- `tests/body-frame-stage15-release-readiness.test.mjs`: 출시 승인 거부 상태, 테스트 트랙 제한, 11/7 키 유효 시간, 읽기 전용 inventory, 외부 증빙 없이는 출시에 적합하지 않다는 판정을 회귀 테스트.
- `.github/workflows/dependency-audit.yml`: Stage 15 QA PR에서 앱 전체/프로덕션 및 Functions 프로덕션 `npm audit`를 수집하고 기존 `scripts/summarize-npm-audit.mjs`로 경고 목록 출력. 보고서는 참고용이며 자동 강제 업그레이드 금지.
- `quality.yml`의 전체 Node 테스트/타입·Lint/Android Manifest·Kotlin/Firebase/Secret Scan 유지.

## 기능별 회귀 매트릭스

| 기능 | 소스/테스트 | Android 에뮬레이터 | 실계정/실기기 출시 승인 |
| --- | --- | --- | --- |
| 사진 촬영/편집/저장 | 사진 ID 불변·순서 변경·백업 삭제 경쟁 테스트 포함 | 기존 네이티브 QA 성공 | ARM64 카메라·사진 원본·권한 거절·동일 사진 처리 재확인 |
| 프로젝트/전후 비교/수치 | 단계별 상태·연결 키/그래프·3탭 검사 포함 | 캡처/터치 경로 검증 | 0/1/다수 프로젝트, 실제 신체 사진, 장문/복원 필요 |
| 영상 생성·보관·재편집 | 원본 이미지 프레임·H.264·취소·타임아웃·재편집 보존 검사 | 네이티브 smoke 성공 | 실제 영상 공유/앨범 저장/재편집 후 동등성 재확인 |
| 계정·Firebase/백업 | 백업 슬롯·실패 재시도·동기화·소유권·삭제 보안 테스트 | 합성 오프라인 UX만 | 배포된 Rules/Functions, 로그인·백업·복구/삭제 실계정 검증 |
| 구독·복원·광고 제거 | 신규 구매 차단/스토어 조회, 서버 상품 검증, 타임 프레이션/환불 관련 테스트 | 스토어 연결 없는 대역 | 실제 3개 플랜 구매·복원·6방향 변경, RTDN·환불 검증 |
| AdMob·UMP | 동의/광고 요청 게이트·영상 저장 후 광고·중복 방지 테스트 | 실제 라이브 광고 미검증 | 테스트 광고 단위/기기 및 동의 지역·app-ads.txt 검증 |
| Health Connect | Weight·BodyFat 읽기 전용·30일·중복 방지 검사 | 실제 제공자 미연결 | 권한 허용/거부/회수, Play Health/Data Safety 신고 필요 |
| Play 빌드·서명·트랙 | 서명 검증·버전코드/원본 SHA·기존 작업 보존·날짜 및 승인 게이트 테스트 | QA APK일 뿐 Play 서명 AAB 아님 | Console 업로드 인증서/서명 AAB·테스트 트랙/Pre-launch 확인 필요 |

## 운영상 차단 조건 (수동 증거 없으면 출판 불가)

1. **새 업로드 키 SHA-256:** GitHub 등록 핀/실제 키스토어 지문과 Play Console의 Upload key certificate 지문 **3자 대조**, App Signing certificate와 혼동 금지.
2. **Play 내부·비공개 트랙:** 기존 완료/초안/중단 릴리스 상태, 전역 최대 versionCode 재조회. 기존 초안이나 staged release는 자동으로 덮어쓰지 않음.
3. **프로덕션 AAB:** 서명된 ARM64 AAB/Play 설치용 APK, 실제 release manifest, R8 mapping/네이티브 심볼 확인. QA x86_64 APK는 출판 근거로 사용 금지.
4. **스토어 상품:** `creator_monthly`, `plus_monthly`, `expert_monthly` 활성/가격·구매·복원·갱신·취소·만료·환불·RTDN; 과거 영구 광고 제거 구매 보존.
5. **Firebase 운영:** 배포된 Functions/Firestore Rules/Storage, Publisher 권한, RTDN Pub/Sub 및 저장·백업/복구/삭제 권한 확인.
6. **AdMob/UMP:** 스토어 연결, 개인정보 메시지, 실제 테스트 단위, 광고 개인정보 설정, app-ads.txt, 동의 실패 및 구매 상태 불확실 시 무광고 검증.
7. **Health Connect:** 공용 개인정보처리방침 URL, Health apps declaration, READ_WEIGHT/READ_BODY_FAT, Data Safety, 권한 거절/회수/중복 방지.
8. **ARM64 실기기:** 첫 실행, 실제 촬영·사진 저장/삭제, 포즈 보조 OFF/ON, MP4 생성/재편집/저장, 백그라운드 및 앱 재실행, 폴더블·TalkBack/글자 150%.
9. **스토어 등록:** 최종 앱 아이콘/화면·기능 그래픽, 계정 삭제 URL, 광고 ID·권한·개인정보 신고, Play pre-launch report.
10. **의존성:** 최신 실제 npm audit 결과 검토 및 직접 의존성/프로덕션 영향별 조치. 과거 2026-10-01 취약점 7건은 오늘 결과로 추정하지 않음.

## 다음 실행 순서
1. Stage 15 PR Quality·Secret Scan 및 npm 의존성 보고서 확인. 실패한 소스 테스트·보안 항목은 수정 후 재실행.
2. 실제 Play Console 키 지문과 signed AAB/버전/트랙 계획을 **읽기 전용으로 점검**. 승인 전 빌드/게시 금지.
3. Firebase 운영/구매/광고/Health Connect 및 ARM64 실기기 테스트의 각 결과·날짜·증거를 기록.
4. 자동·운영·실기기 근거가 모두 모인 경우에만 사용자가 승인한 **내부 또는 비공개 테스트** 트랙에 게시. 운영 출시/프로덕션 자동 전환 없음.

참고: [원본 출시 체크리스트](../body-frame-release-checklist.md), [실기기 체크리스트](../manual-device-qa.md), [광고·구독 회귀 검증](../release-ad-billing-qa.md).

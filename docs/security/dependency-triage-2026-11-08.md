# TravelFrame 의존성 보안 위험 분류 · 출시 게이트 (2026-11-08 KST)

## 검토 기준과 적용 범위

- 기준 소스: `main@080b67887dcde866c332df29806c64590c779256`.
- 원본 증거: [Dependency Audit #42448053580](https://github.com/hebi10/travelframe/actions/runs/42448053580)의 `app-full-audit.json`, `app-prod-audit.json`, `functions-prod-audit.json`; [이슈 #106](https://github.com/hebi10/travelframe/issues/106).
- 해당 검사 당시 앱 전체 **high 9 / moderate 17 / low 1 = 27개 패키지**, 앱 `--omit=dev` **high 9 / moderate 10 / low 1 = 20개 패키지**, Functions `--omit=dev` **high 0 / moderate 8 = 8개 패키지**. 이 수치는 **CVE 건수도, Android APK 안에 포함된 악용 가능 취약점 건수도 아님**.
- 이 문서는 취약성 해결 완료 판정이 아닌, 위험·증거·차단 조건의 추적 문서다. `Dependency Audit` 워크플로 SUCCESS는 보고서 생성 성공을 의미하며 보안 경고 0개를 뜻하지 않는다.

## 앱 고위험 9개: 의존 경로별 분류

| 패키지 묶음 (고위험 집계) | 의존 경로 · 원인 | 확인된 완화/미해결 범위 | 권장 후속 검증 |
| --- | --- | --- | --- |
| `expo-router`, `query-string`, `decode-uri-component` (3) | `expo-router@55.0.14 → query-string@7.1.3 → decode-uri-component@0.2.2`. 퍼센트 인코딩 DoS [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | PR #116의 Android OS native intent 길이·UTF-8·제어 문자·필드 수·퍼센트 인코딩 반복 제한은 **외부 유입 일부 완화**일 뿐 라이브러리 패치가 아님 | 앱 내부 URL/인증 콜백 등 추가 진입 경로 검토, URI fuzz/복구, 실제 Android OAuth 딥링크 |
| `firebase`, `@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js` (4) | `firebase@12.13.0 → @firebase/firestore@4.14.1 → @grpc/grpc-js@1.9.16`. gRPC [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) | advisory는 **특정 서버측 getAuthContext 인증서 설정** 문제. 앱 소스의 직접 호출은 확인되지 않았으나 APK 포함/실행 및 네이티브 대체 경로는 검증 전 | 실제 Android release/Hermes 번들 내 Node gRPC 포함 여부, Firestore Auth·계정 소유권·백업 회귀 |
| `@expo/cli`, `zod` (2) | `expo@55.0.26 → @expo/cli@55.0.32 → zod@3.25.76`. 제한된 컬렉션 검증시 메모리 고갈 [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Expo CLI 개발·빌드 도구 경로로 추정되나 `--omit=dev` 감사에는 포함됨. APK 미포함 판정은 아직 불가 | release 번들 포함 여부, CI/빌드 입력의 비신뢰 스키마 도달 가능성, SDK 호환 범위 |

**안전 제한:** `npm audit fix --force` 금지. 감사 도구가 제시하는 `expo@52`·`firebase@9` 역방향 변경 금지. `expo-router@58` 단독 상향 또는 `decode-uri-component@0.5.1`(ESM-only)를 `query-string@7`(CommonJS) 하위에 강제로 override 금지. Firestore가 요구하는 `@grpc/grpc-js@~1.9.0`을 호환성 검증 없이 `1.14.x`로 강제 상향 금지.

## Functions 잔여 중간 위험 8개

| 구간 | 해당 패키지 | 검증 / 대응 |
| --- | --- | --- |
| Firebase Admin/Cloud SDK | `firebase-admin`, `@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `retry-request`, `teeny-request` | 현재 Node 22 Functions API·트랜잭션·백업/삭제·구매 검증/RTDN 보존이 우선. 감사의 `firebase-admin@14.5.0` 제안은 **메이저 업그레이드 후보**이지 검증된 안전 패치가 아님 |
| 하위 요청/식별자 | `gaxios`, `uuid` | UUID advisory [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) 는 특정 buffer 인수 경로를 검토. 전체 하위 패키지에 `uuid@11` 강제 override 전 API/Node 호환 검증 필요 |

Functions의 `body-parser@1.20.9` 및 `qs@6.16.1` 패치는 PR #107에 이미 병합되어 **현재 감사에서 high 0**. 다만 소스 패치 자체는 운영 Firebase Functions에 반영된 증거가 아니며, 운영 배포·회귀 확인 전까지 출시 차단을 유지한다.

## 변경 승인 전 테스트 증거

1. **하위 의존성 패치:** 공식 지원 SDK 범위와 lockfile 경로 일치; `npm ci`, `npm ls`/`npm explain`, 앱 전체 및 `--omit=dev`, Functions `--omit=dev` 감사 전후 JSON 비교.
2. **자동 기능 QA:** TypeScript, Lint, Node/Rules/Functions, Android Kotlin/Release Manifest, Secret Scan, 실제 x86_64 APK/영상 캡처 검사.
3. **런타임 경계 QA:** Android ARM64 실기기 인증/외부 URI/사진·영상, Firebase 운영/테스트 소유권·백업/복구, 결제/RTDN. 이 항목은 GitHub CI만으로 완료할 수 없다.
4. **게시 안전:** Play Console Upload key 인증서 SHA-256 3자 대조, 테스트 트랙·버전코드·서명 AAB·승인 변수 확인. `main`에 대한 CI 통과만으로 게시 승인하지 않는다.
5. **판정 기록:** 취약 패키지별 수정 완료, 범위 외 근거, 수용 위험의 승인자·일자·검증 결과를 이슈 #106에 기록. 해결 완료 전 이슈 닫지 않는다.

## 오래된 PR·저장소 설정 연계

- [PR #72](https://github.com/hebi10/travelframe/pull/72)·[PR #111](https://github.com/hebi10/travelframe/pull/111)은 **미병합 종료 및 기록 보존**하고 필요한 레거시 접근성/QA 제한만 최신 [PR #121](https://github.com/hebi10/travelframe/pull/121)로 이관해 검증 중이다. 원 PR 소스는 직접 병합하거나 삭제하지 않는다.
- [PR #75](https://github.com/hebi10/travelframe/pull/75) 예시 사진 캡처도 **미병합 종료**했으며 최신 APK/소스 SHA 기반 재구성은 [이슈 #123](https://github.com/hebi10/travelframe/issues/123)로 이관했다.
- 확인 시점 `main`은 `protected:false`, 적용 중인 repository rulesets `[]`. PR 승인·필수 Quality/Secret Scan·게시 게이트를 강제할 branch protection 설정이 필요하지만 **현재 연결 권한의 branch-protection 관리 API는 403**이므로 이 문서는 보호 설정을 완료했다고 주장하지 않는다.
- `.github/workflows/android-play-aab.yml`은 `main` push에서 승인 변수 조건이 참이면 테스트 트랙 빌드/게시를 진행할 수 있다. 별도 출시 승인 없이 `main`에 보통 커밋을 넣어서는 안 된다.

## 현재 판정

**출시 승인: 보류 / 보안 이슈 #106: OPEN.** 고위험 패키지 9개는 아직 lockfile에서 제거되지 않았으며, 안전한 수정은 SDK 호환성 및 실제 Android/운영 회귀 결과에 따라 별도 PR로 진행한다. 이 문서 자체는 코드·잠금 파일·Play·Firebase·서명키를 변경하지 않는다.

## Functions 14.x 후보의 실제 호환성 시험 (2026-11-08)
- [PR #122](https://github.com/hebi10/travelframe/pull/122)는 **미병합 종료한 시험 브랜치**다. `firebase-admin@14.5.0` 단독 업데이트는 현행 `firebase-functions@6.6.0`의 peer 범위(`^11 || ^12 || ^13`) 때문에 npm ci ERESOLVE.
- `firebase-functions@7.4.0 + firebase-admin@14.5.0`을 함께 사용하면 npm ci는 성공하고 생성된 lock은 Firestore 9.4.0 / Storage 8.4.0 / gRPC 1.14.7. Functions production audit high 0, moderate **7**로 감소하지만 기존 `google-gax/build/src/fallback` 비공개 경로에서 `ERR_PACKAGE_PATH_NOT_EXPORTED`가 발생해 런타임 호환 검증에 실패.
- Admin SDK 14에서 기존 `functions/index.js`의 namespace 형태(`admin.initializeApp()`/`admin.firestore()`/`admin.storage()`)를 공식 모듈형 import로 마이그레이션하는 일이 필요하다. 결제/RTDN/백업/Firestore/Storage 운영 QA를 포함한 작업을 [이슈 #125](https://github.com/hebi10/travelframe/issues/125)로 분리.
- 격리 잠금 파일·감사 원본: [GitHub Actions artifact](https://github.com/hebi10/travelframe/actions/runs/42451483725/artifacts/13606091069). **이 수치는 운영 Functions 업데이트 효과가 아니다. 운영 변경 0.**

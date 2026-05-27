# /project-check

사진 백업과 영상 만들기 기능을 포함한 Android 사진 앱을 서브 에이전트로 나누어 전반 점검한다.

## Arguments

- `scope`: `changed`, `full`, `release` 중 하나. 기본값은 `full`.
- `fix`: 발견한 문제를 수정할지 여부. 기본값은 `false`.
- `device`: 실제 Android 기기/에뮬레이터 수동 QA를 포함할지 여부. 기본값은 `false`.
- `deep`: Firebase Rules, 보안 스캔, Android debug verify 같은 느린 검증을 포함할지 여부. 기본값은 `false`.

## Guardrails

1. 항상 한국어로 핵심부터 보고한다.
2. Android만 대상이다. iOS 파일, 설정, 네이티브 코드는 사용자가 명시하지 않으면 점검/수정 범위에서 제외한다.
3. `.env`, 인증서, 토큰, 서비스 계정, 키스토어 값은 출력하지 않는다.
4. 사용자가 `fix=true`를 주지 않았으면 코드 수정, 커밋, 푸시, 배포를 하지 않는다.
5. 파괴적 작업, 계정 삭제, 데이터 삭제, 강제 푸시, 직접 배포는 실행하지 않는다.
6. Android 빌드 검증은 루트 npm 스크립트를 사용한다. `cd android; .\gradlew.bat :app:assembleDebug`처럼 Gradle을 직접 장시간 실행하지 않는다.

## Workflow

1. 루트에서 `AGENTS.md`, `package.json`, `app.json`, `.github/workflows`, `scripts`, `tests`를 먼저 읽고 현재 검증 체계를 파악한다.
2. `git status --short`로 작업트리 상태를 확인하되, 사용자가 만든 변경을 되돌리지 않는다.
3. 사용자가 명시적으로 서브 에이전트를 허용한 명령이므로, 독립 영역별 에이전트를 병렬로 실행한다. 각 에이전트는 읽기 전용 분석을 기본으로 하며 `fix=true`일 때도 서로 다른 파일 소유권을 지정한다.
4. 메인 에이전트는 에이전트 결과를 자동 병합하지 말고 비교, 중복 제거, 우선순위화를 수행한다.
5. 기본 검증을 실행하고, `deep=true`일 때만 느린 검증을 추가한다.
6. 최종 보고는 실패/위험 항목을 먼저 쓰고, 그 다음 실행한 명령과 통과/실패 결과를 요약한다.

## Subagents

### Agent 1: UI/UX and Navigation

Scope:
- `app/`
- `features/*`
- `components/`
- `hooks/`

Check:
- 탭 구조: 카메라, 스튜디오, 여행 클립, 계정, 설정 흐름이 끊기지 않는지
- 사진 촬영, 캡처 미리보기, 편집, 저장, 상세 화면 이동
- 이전 사진 반투명 오버레이, 투명도/확대/회전/잠금, 가이드 표시가 촬영 화면에서 안정적인지
- 사진 선택, 다중 가져오기, 썸네일, 삭제, 백업 상태 표시
- 동영상 만들기 진입, 사진 순서/노출 시간/전환/음악, 빈 상태, 미리보기, 제목/저장/공유 UX
- 다크 모드, 폰트 설정, safe area, 모달 overflow, 버튼 텍스트 줄바꿈
- 권한 거부/취소/재시도 같은 사용자 실패 흐름
- 무료/구독/광고 제거 상태별 광고 노출과 워터마크/한도 안내

Return:
- 발견한 문제를 `Critical`, `High`, `Medium`, `Low`로 분류
- 재현 경로와 관련 파일
- 자동 테스트로 커버되는지 여부

### Agent 2: Media, Backup, and Data Integrity

Scope:
- `lib/photo-library.ts`
- `lib/work-library.ts`
- `lib/video-library.ts`
- `lib/cloud-backup.ts`
- `lib/backup-failure-queue.ts`
- `lib/image-backup-utils.ts`
- `lib/trip-clip-*`
- `features/trip-clip/`

Check:
- 로컬 사진/작업/비디오 라이브러리 정규화와 영속 저장
- 백업 대상 선택, 중복 방지, 실패 큐, 재시도, 삭제 중 백업 race condition
- cloud-only 삭제와 로컬 삭제 정책 분리
- 이미지 최적화 품질, 메타데이터, URI 처리, Android content URI/download URI
- 영상 만들기 draft, 사진 선택, 렌더 캐시, 음악 추가, export quota, 저장 옵션
- 앱 재시작 후 진행 상태와 백업 상태가 일관적인지

Return:
- 데이터 손실 가능성이 있는 항목을 최우선으로 보고
- 관련 테스트 파일과 누락 테스트 제안

### Agent 3: Firebase, Auth, Quota, and Security

Scope:
- `lib/firebase.ts`
- `lib/auth-context.tsx`
- `lib/cloud-backup-limits.ts`
- `lib/plan-entitlements.ts`
- `lib/subscription*`
- `functions/`
- `firestore.rules`
- `storage.rules`
- `.gitleaks.toml`

Check:
- Firebase Auth 상태별 접근 제어
- 이메일/Google 로그인, PKCE redirect, exported Activity scheme, Auth persistence가 Android 보안 요구에 맞는지
- Firestore/Storage Rules가 사용자별 백업, 동영상 export, 삭제 요청을 서버에서 강제하는지
- client write 허용 문서의 schema 제한, immutable 필드, owner/admin 경계가 충분한지
- Functions의 백업 quota, 삭제 안전장치, 사용자 음악/동영상 사용량 제한
- callable 함수의 `requireUid`/`requireAdminUid`, App Check, rate limit, session TTL, quota reserve/complete/release race
- 요금제/구독 entitlement가 클라이언트 표시와 서버 제한에서 일치하는지
- 사용자에게 노출되는 오류 메시지가 내부 경로나 민감 정보를 포함하지 않는지
- secret scan 대상과 예외가 적절한지
- AD_ID 권한, AdMob dev/prod unit 분리, 비개인화 광고 옵션, privacy/data-safety 문서 일치 여부

Return:
- 보안/권한 문제는 파일과 규칙 경로를 함께 보고
- Firebase emulator 테스트 필요 여부를 명시

### Agent 4: Android Native and Build Stability

Scope:
- `android/app/src/main/AndroidManifest.xml`
- `app.json`
- `plugins/`
- `patches/`
- `scripts/verify-android-debug.ps1`
- `scripts/build-android-aab.ps1`
- 네이티브 모듈 사용부: 카메라, 미디어 라이브러리, 비디오, 광고, view recorder

Check:
- Android 권한 선언과 런타임 권한 요청의 일치
- Android 13/14 media 권한, 부분 사진 접근, legacy storage, `allowBackup`, `requestLegacyExternalStorage`, `SYSTEM_ALERT_WINDOW` 필요성
- 카메라 셔터음/포커스/줌/비율/세션 복구 관련 Android 안정성
- expo-camera 패치, Vision Camera, Nitro modules, Reanimated/Worklets 호환성 위험
- 광고 SDK 초기화와 entitlement에 따른 광고 노출 제어
- debug/release 빌드 스크립트가 stale gradle/cmake/ninja 프로세스와 캐시 잠금을 처리하는지
- `file://`, remote URL, cache/document directory, 파일명 sanitization, 저장 공간 부족, 임시 파일 cleanup
- 영상 export의 FPS/프레임 수/bitrate/해상도, cache MP4 존재, 저장/공유 실패, quota 실패 해제
- 음악 파일 선택, 50MB 제한, MIME 검증, storage saver 모드에서 로컬 삭제 후 복원

Return:
- 빌드 실패 가능성이 큰 항목
- 직접 Gradle 실행 없이 검증 가능한 명령

### Agent 5: Tests, CI, and Coverage Gaps

Scope:
- `tests/`
- `scripts/run-tests.mjs`
- `scripts/run-firebase-rules-tests.mjs`
- `.github/workflows/`
- `package.json`

Check:
- 기존 테스트가 핵심 사용자 플로우를 충분히 커버하는지
- 카메라, 백업, 삭제, 동영상 export, Firebase Rules, 설정, 구독, 광고 영역별 테스트 누락
- CI와 로컬 검증 명령의 차이
- 느리거나 환경 의존적인 테스트를 기본/심화 검증으로 분리할 필요

Return:
- 현재 커버된 영역
- 우선 추가할 테스트 목록
- 로컬/CI 검증 명령 추천

## Verification Commands

기본 검증은 아래 순서로 실행한다.

```powershell
npm run typecheck
npm test
npm run lint
npm run android:verify:kotlin
```

`deep=true`일 때만 아래를 추가 실행한다.

```powershell
npm run test:firebase-rules
npm run security:secrets
npm run android:verify:debug
```

Cloud Functions 관련 변경이 있으면 빠른 문법 검사를 추가할 수 있다.

```powershell
node --check functions/index.js
node --check functions/backup-quota.js
node --check functions/backup-delete-safety.js
```

문제가 특정 영역에 한정되면 빠른 선별 테스트를 먼저 실행할 수 있다.

```powershell
npm test -- camera
npm test -- backup
npm test -- trip-clip
npm test -- video
npm test -- settings
```

주의: `npm test -- firebase`처럼 넓은 필터는 `firebase-rules-emulator.test.mjs`까지 포함할 수 있다. Firebase Rules emulator 검증은 `npm run test:firebase-rules`로 분리해서 실행한다.

배포/릴리스 계열 명령은 기본 점검에서 제외한다.

```powershell
npm run firebase:deploy-rules
npm run firebase:deploy-functions
npm run firebase:deploy-hosting
npm run deploy:firebase
npm run android:build-dev
npm run android:build-prod
npm run android:build-prod-local
npm run android:run-latest
```

Android 빌드가 멈춘 것으로 보이면 먼저 프로세스 상태만 확인한다.

```powershell
Get-Process java,gradle,cmake,ninja -ErrorAction SilentlyContinue
```

## Manual Device QA

`device=true`일 때는 실제 Android 기기 또는 에뮬레이터에서 아래 흐름을 확인한다.

1. 신규 설치 후 권한 허용/거부/재요청.
2. 사진 촬영, 가이드 조정, 미리보기, 저장, 편집, 덮어쓰기/새 저장.
3. 이전 사진 오버레이 선택, 투명도/확대/회전/잠금 조정 후 촬영.
4. 여러 사진 가져오기, 썸네일 표시, 삭제, 복구 불가 안내.
5. 로그인 전/후 백업 상태, 백업 시작, 기존 클라우드 데이터 발견, 실패 재시도, cloud-only 삭제.
6. 여행 클립 사진 선택, 순서/프레임 조정, 음악 추가, 미리보기, 저장, 공유.
7. 비로그인/무료/구독 상태별 MP4 저장 제한, 주간 한도, 3분 초과 차단, 저장 후 광고.
8. 네트워크 끊김, 저장 공간 부족, 권한 철회 후 오류 메시지.
9. 다크 모드, 글꼴 크기/패밀리 변경 후 주요 화면 레이아웃.
10. 광고 표시/미표시 조건과 구독 entitlement.

## Output

최종 보고 형식:

```markdown
## 종합 결과
- 상태: 통과 / 조건부 통과 / 실패
- 가장 큰 위험:

## 주요 발견
- [Severity] 영역: 문제 요약
  - 근거:
  - 재현/확인 방법:
  - 권장 조치:

## 서브 에이전트 요약
- UI/UX:
- 미디어/백업:
- Firebase/보안:
- Android/빌드:
- 테스트/CI:

## 실행한 검증
- `명령`: 통과/실패/미실행, 이유

## 다음 조치
- 우선순위 순으로 3-7개
```

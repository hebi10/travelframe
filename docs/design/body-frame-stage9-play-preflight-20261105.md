# TravelFrame Stage 9 — Google Play 업로드 인증서·내부 테스트 사전점검

작성 기준: 2026-11-05 KST, `main@8c6a1ffe494d74c9b7d2b8ca47b4cce090e34d68`.

## 배포 정책과 현재 한계

- 표시버전 후보는 `1.0.32`, 패키지 ID는 `com.haebi.photoguide`. 실제 새 `versionCode`는 배포 직전 Google Play의 전체 트랙·미할당 APK/AAB 인벤토리에서 결정.
- `BODY_FRAME_PLAY_SIGNING_APPROVED_20261107` 승인 변수가 정확히 `true`가 아니면 기존 자동 Play 계획/빌드/게시를 **건너뜀**.
- Stage 9부터 CLI도 `2026-11-07 00:00 KST` (`2026-11-06T15:00:00Z`) 이전에는 **publish를 무조건 거부**. 승인 변수가 실수로 조기 활성화되어도 게시 계획 또는 업로드가 진행되지 않도록 fail-closed 처리. `inventory`는 날짜 제한 없이 조회 가능.
- 이번 PR로 인증/배포 승인을 하지 않으며 서명키·인증서·Play Console 트랙 값을 변경하거나 AAB를 업로드하지 않음.

## 새 수동 사전점검 워크플로

GitHub Actions → **Body Frame Play release preflight (no publish)** → **Run workflow**에서 `main`을 선택.

| 선택 | 작업 | 부수 효과 |
| --- | --- | --- |
| `certificate` | GitHub에 기존 저장된 업로드 키 JKS/PKCS12의 별칭·키 접근, 인증서 유효기간, debug 키 여부, 설정된 `ANDROID_UPLOAD_CERT_SHA256` 일치 확인 | 임시 키 파일·CSR만 생성 후 삭제. 앱 서명/게시 없음 |
| `inventory` | Google Play Android Publisher API를 이용해 현재 트랙·번들·APK·최대 `versionCode` 조회 | **임시 Publisher edit 생성 후 삭제**. 트랙 변경·업로드·commit 없음 |
| `both` | 위 두 검사를 각각 별도 잡으로 실행 | 게시 안 함 |

`play_upload_certificate_sha256` 입력란은 **Play Console에서 직접 확인한 업로드 키 인증서 SHA-256**을 넣을 수 있는 선택 입력입니다. 해당 값이 있으면 실제 keystore → 저장소 pin → 수동 제공된 Play Console 지문의 **세 값 일치**를 확인합니다. 이 입력이 비어 있으면 처음 두 값만 확인하며, 실제 Play Console과 일치한다고 주장하지 않습니다.

### Play Console에서 확인할 인증서

1. <https://play.google.com/console/> → `com.haebi.photoguide` 앱
2. 앱 서명 / Play App Signing 화면(Play Console 버전에 따라 '출시 → 설정 → 앱 서명' 또는 '앱 무결성' 메뉴)
3. **Upload key certificate / 업로드 키 인증서**의 SHA-256을 확인. **App signing key certificate / 앱 서명 키 인증서**와 혼동하지 않기
4. 변경/재설정 중이라면 Play에 새 인증서 적용이 완료된 뒤 다시 비교. 기존 키가 일치하지 않는 상태에서 서명 Secret 또는 승인 변수를 임의 교체하지 말 것

참고: [Android Developers — Sign your app](https://developer.android.com/studio/publish/app-signing), [Play Console Help — Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).

### 보안 및 검증 경계

- 비공개 서명키 JKS, 비밀번호, OAuth 인증 파일/토큰, `.env` 값은 **채팅·Git 저장소·일반 Drive 폴더에 붙여넣지 않음**.
- `check-play-upload-certificate.mjs`는 `keytool`로 인증서 DER를 추출한 뒤 SHA-256을 비교하고 키로 임시 CSR 생성이 가능한지 점검. `RUNNER_TEMP` 아래 제한된 임시 디렉터리를 사용하고 작업 직후 제거. **인증서 원문·지문·키/암호를 로그에 출력하지 않음**.
- PKCS12 일부 구현에서는 별도 key-password 인자를 무시할 수 있으므로, 실제 AAB 서명과 key password까지 완전히 성공한다고 단정하지 않음. AAB 서명·R8·번들 및 설치 APK 검증은 기존 게시 워크플로에서 따로 수행.
- Play Console에서 업로드 인증서 지문을 실제 읽는 공개 Android Publisher inventory API는 사용하지 않음. 수동 입력값을 제공받기 전까지 실제 인증서 확인은 **미완료**.
- 운영 서명/게시 전 검사에 성공했어도 Google Play 검토·테스터 설치 완료는 별개의 결과.

## 9단계 구현 내역

- `scripts/publish-play-release.mjs`: `requirePlayPublishWindow()`를 resolve/plan/publish에 적용하고 날짜 경계를 단위 테스트로 검증. `inventory`는 예외.
- `scripts/check-play-upload-certificate.mjs`: 업로드 키·pin·선택적 Play Console SHA 및 임시 CSR 확인. 실패 메시지는 민감한 명령 출력/비밀번호를 숨김.
- `.github/workflows/body-frame-play-preflight.yml`: 수동 실행 전용, `main`에서만 동작, certificate와 inventory를 별도 최소 권한 잡으로 분리. 기존 Play 게시와 동일 concurrency 그룹으로 일시 충돌 방지.
- `tests/body-frame-stage9-play-preflight.test.mjs`: 날짜 경계, 실제 테스트 전용 PKCS12 키, pin 불일치/암호 오류/임시 파일 제거, 워크플로의 게시 코드 부재 검증.

## 내부 테스트 실제 출시 전 필수 조건

- [ ] 2026-11-07 00:00 KST 이후
- [ ] Play Console **현재 업로드 키 인증서**와 CI keystore·pin 세 값 일치(필요한 경우 reset 처리 완료)
- [ ] 현재 Play 트랙/미완료 릴리스 확인 및 최신 versionCode 계획
- [ ] Android signed release AAB, R8 mapping, app package/version/minification/ARM64 검사 및 보관
- [ ] `main` Quality/Secret Scan 및 QA와 필요 운영 검증 완료
- [ ] 실제 서명키와 테스트 트랙 상태 확인 후 담당자의 명시적 배포 승인 설정 활성화
- [ ] **기본 internal track** 업로드, Publisher commit·readback 확인; closed/alpha는 별도 사용자 요청이 있을 때만 진행
- [ ] Play 내부 테스트 설치, ARM64/폴더블 기존 앱 업데이트·저장 데이터/결제/백업/Health Connect 주요 기능 검증

## 완료 기준

Stage 9 코드와 테스트/병합 성공은 *배포 준비 코드 완료*에 해당. Play Console 인증서 실측/인벤토리, signed AAB 실설치, 내부 테스트 배포 성공은 상기 인증과 11월 7일 제한 충족 뒤에만 완료 처리.

## 인증서 검사 오류 유형 (2026-11-06 추가)

읽기 전용 사전점검의 `inventory` 잡은 별도로 성공할 수 있습니다. `certificate` 잡의 실패를 Play 트랙 오류로 간주하지 않습니다.

- `Upload keystore cannot be opened`: GitHub 저장소의 서명 keystore 파일/스토어 비밀번호가 서로 맞지 않거나 키 파일이 유효하지 않음.
- `Upload alias not found or inaccessible`: 저장소 keystore의 키 별칭이 설정된 값과 다름. 첫 번째 keystore 열기 검사는 통과했음을 의미.
- `Upload certificate could not be exported`: 별칭이 확인되었으나 인증서 추출 실패.
- `Keystore certificate does not match the configured upload-certificate fingerprint`: 추출한 인증서와 저장소의 SHA-256 pin이 다름. Play Console 실제 인증서와의 일치 여부는 별도.
- `Upload private key could not produce a certificate request`: 인증서 조회 이후 개인키 요청 단계에서 오류. 키 비밀번호, 개인키 존재/유형 또는 접근 권한 확인 필요.

원인별 실패 문구는 **단계 이름만 표시**하며 실제 `keytool` stdout/stderr, 별칭, 키·비밀번호·인증서 원문을 출력하지 않습니다. 해당 값을 채팅이나 Git 저장소에 게시하지 마세요. 기존 저장값을 임의로 변경하지 말고 원인이 확인된 후 검증된 업로드 키 복구 절차를 사용하세요.

2026-11-06T02:22:16Z의 [사전점검 #42149882497](https://github.com/hebi10/travelframe/actions/runs/42149882497): inventory PASS (최대 versionCode 26092622, internal completed, blocker 없음), certificate FAIL. 구버전 검사 코드에서는 `Keytool certificate/key verification failed`로만 표시되어 실패 단계의 상세 위치는 아직 구분할 수 없었습니다.

# 일반 사용자 클라우드 백업 슬롯 교체 안전성

## 기존 문제

기존 `replaceCloudBackupProject`는 기존 프로젝트의 Storage 파일과 Firestore 메타데이터를 먼저 삭제한 뒤, 다른 Firestore 호출로 새 프로젝트 슬롯을 설정했습니다. 중간 장애/동시 요청 시 **기존 파일은 삭제되었지만 슬롯이 이전 프로젝트를 가리키는 상태**가 가능했습니다.

## 변경

- 교체 시작 시 기존 슬롯을 `replacing`으로 변경하고 `backupProjectLocks/{previousProjectId}` 잠금 문서를 동일한 Firestore 트랜잭션에서 생성합니다.
- 사진/영상 업로드 예약과 완료는 같은 잠금 문서를 읽도록 변경합니다. Firestore Rules/Storage Rules도 잠긴 프로젝트에 대한 새 파일·메타데이터 저장을 차단합니다.
- 잠금을 획득한 이후에 진행 중인 백업 예약이 있는지 다시 확인합니다. 예약된 세션이 남아 있으면 **기존 데이터 삭제를 시작하지 않습니다**.
- 데이터 삭제 도중 실패하면 잠금과 `replacing` 상태를 보존합니다. 앱에서 동일한 새 프로젝트로 "교체 재시도"를 선택하면 남은 정리를 다시 수행할 수 있습니다.
- 최종 삭제 성공 후 새 슬롯 활성화와 잠금 해제를 같은 Firestore 트랜잭션에서 처리합니다.
- 전체 클라우드 삭제 시 프로젝트 잠금도 함께 정리합니다.
- 소유자 앱은 슬롯을 `replacing`으로 표시하고 자동 백업 대상으로 선택하지 않으며, 사용자 확인 후 동일한 새 프로젝트로 재시도할 수 있습니다.

## 중요한 한계

이 설계는 **삭제를 완료하는 roll-forward** 방식입니다. 이미 삭제된 파일 자체를 복원하는 rollback이 아니며, 프로젝트의 원본이 로컬에 남아 있는지 별도 확인해야 합니다. 전체 파일 삭제는 Firestore/Storage에 걸친 원자적 작업이 아닙니다.

## 검증

- `tests/backup-slot-replacement.test.mjs`: 실행형 실패 주입과 재시도, 경쟁 상태 결정 검사
- `tests/firebase-rules-emulator-runner.mjs`: 잠긴 프로젝트의 클라이언트 메타데이터·파일 업로드 차단, 타 프로젝트 업로드 유지
- `tests/project-slot-pricing-policy.test.mjs`: 기존 요금제 정책과 슬롯 선택 API 유지
- Github CI: TypeScript, lint, Node tests, Functions syntax, Firebase Rules Emulator, Android Kotlin/Manifest

운영 Functions/Rules 배포 전에는 이전 앱 버전 설치 데이터, 진행 중인 업로드, 대용량 클라우드 프로젝트, 계정 변경, 구독 만료, 슬롯 교체 실패/재시도, 사진·영상 복원에 대한 실제 Firebase 테스트와 Android 기기 QA를 수행해야 합니다.

**소스 코드 병합이 Firebase 운영 배포를 의미하지 않습니다.** 기능이 클라우드 Functions와 Firestore/Storage Rules에 걸쳐 있으므로 운영 반영 시 동일 릴리스 묶음으로 검증해야 합니다.

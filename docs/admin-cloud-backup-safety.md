# 관리자 클라우드 데이터 삭제 운영 안전성

## 기본 비활성

관리자 Cloud Functions `replaceAdminCloudBackupProject` 및 `deleteAdminCloudBackupData`는 저장된 사용자 데이터를 삭제할 수 있으므로, 운영 환경에 `FUNCTIONS_ENABLE_ADMIN_BACKUP_DELETION=true`가 **명시적으로 설정된 경우에만** 사용할 수 있습니다. 아무 설정이 없으면 서버에서 거부합니다. 프로젝트 슬롯 조회, 목록, 일반적인 관리자 관리 기능과 일반 사용자의 백업 삭제 API는 이 스위치의 영향을 받지 않습니다.

## 추가 보호

- 관리자 인증과 대상 사용자의 정확한 UID 재입력을 서버에서 확인합니다.
- 관리자 화면이 처음 조회한 슬롯의 `projectId`가 실제 서버와 다르면 삭제를 시작하지 않습니다.
- 변경할 새 프로젝트의 Firestore 메타데이터가 없다면 삭제를 시작하지 않습니다.
- `tests/admin-destructive-safety.test.mjs`가 기본 비활성, 정확한 UID와 스냅샷 일치를 실행형으로 검사합니다.

## 남은 위험 및 운영 전 필수 확인

Cloud Storage 객체 삭제와 Firestore 슬롯 갱신은 하나의 트랜잭션이 아닙니다. 삭제 도중 장애가 발생하면 파일이 일부만 삭제되는 상태가 발생할 수 있으며 **완전한 롤백을 보장하지 않습니다**.

- [ ] 개발/스테이징에서 사용자별 원본 사진·영상 백업과 복원을 검증
- [ ] 동시 업로드/슬롯 교체, 프로젝트 이름 변경, 데이터 부분 삭제 실패와 재시도 처리 검증
- [ ] 클라우드 삭제 전 복구 가능한 외부 보관본 확보 및 담당자의 승인
- [ ] 실기기·Emulator 테스트를 완료하고 운영 배포 버전을 일치시킨 이후에만 스위치 활성화
- [ ] 작업 후 Firestore·Storage 잔여 파일과 서버 로그 감사

PR을 병합하는 것과 이 스위치를 활성화하는 것은 별개입니다. 검증 전에는 Draft를 유지합니다.

## 읽기 전용 운영 권한과 UI

새로운 `getAdminBackupCapabilities` Callable은 로그인된 관리자에게 현재 서버 허용 상태만 전달합니다. 기본으로 관리자 교체 및 전체 삭제 버튼이 비활성화되며, 백엔드에서 설정을 명시적으로 켜지 않으면 요청도 거부합니다.

- `FUNCTIONS_ENABLE_ADMIN_BACKUP_DELETION=true`: 관리자 슬롯 변경 동작만 활성화
- `FUNCTIONS_ENABLE_ADMIN_FULL_BACKUP_DELETION=true`: **첫 번째 설정도 true일 때에만** 관리자 전체 클라우드 삭제 허용

전체 삭제는 슬롯 변경보다 피해 범위가 크므로 별도 스위치로 분리합니다. 기능을 테스트하지 않은 운영 환경에서는 두 설정 모두 비활성으로 유지합니다.

# Body Frame 안정성·에뮬레이터 검증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 승인된 사진 보존·백업·영상·사용성 문제를 수정하고 Android 모바일·태블릿 실화면을 제공한다.
**Architecture:** 기존 Expo 55 / React Native 앱의 저장소 및 외부 API 호환성을 유지한다. 파일 교체·목록 병합·백업 메타데이터·영상 준비를 책임별 helper로 분리한다.
**Tech Stack:** TypeScript, React Native, Expo, Firebase Functions/Rules, Node test, Android emulator.
**Spec:** docs/superpowers/specs/2026-11-03-body-frame-safety-design.md

## Global Constraints
- Android 전용. iOS 파일·설정은 수정하지 않는다.
- 기존 storage key, package ID, photoId와 프로젝트 데이터 형식을 유지한다.
- 사용자 사진·계정·운영 Firebase를 테스트 데이터로 사용하지 않는다.
- 운영 삭제·백업 슬롯 교체·Firebase 배포·스토어 배포는 실행하지 않는다.
- 새 의존성은 필요한 경우에만 추가한다. 기존 디자인 토큰과 색상을 사용한다.
- 미병합 PR72를 임의 병합하지 않는다.
- 에이전트는 맡은 파일만 수정하며 Git staging/commit은 통합 담당자가 수행한다.

## Review Focus
- 파일·목록 쓰기 실패 후 기존 편집본 조회/파일이 모두 보존되어야 한다 (Task1).
- 복원 중 완료된 촬영·삭제는 오래된 목록으로 덮이지 않아야 한다 (Task1).
- cloud_only 백업은 다른 UID의 Storage 경로나 원격 메타데이터를 허용하지 않아야 한다 (Task1/2).
- 이미지 비동기 로딩 실패·배경 전환은 빈 프레임 성공으로 보고되지 않아야 한다 (Task3).
- 360dp·키보드·큰 글씨와 TalkBack 조작으로 주요 행동에 접근 가능해야 한다 (Task4/5).

### Task 1: 사진 보존·클라우드 클라이언트
**Files:** lib/legacy-photo-library.ts, lib/photo-library.ts, lib/cloud-backup.ts, lib/work-library.ts, lib/video-library.ts; 새 저장/백업 helper; tests의 관련 실행형 회귀 검사.
**Interfaces:** 기존 public 함수·저장 키 유지. 필요한 merge*FromBackup 함수는 각 저장소의 mutation queue 안에서 최신 목록을 읽고 병합한다. metadata-only 백업은 기존 파일 경로/세션을 보존하며 Task2 규칙과 협의한다.
- [ ] 파일 copy/preview/metadata 실패, 동시 촬영·편집·삭제·복원, cloud_only 정렬 반영 테스트를 작성하고 RED 확인.
- [ ] 새 버전 파일/미리보기와 목록 저장이 끝난 뒤 이전 파일을 정리한다. 실패 시 새 임시 결과만 정리한다.
- [ ] 최신 로컬 배열과 tombstone을 각 저장소 변경 큐 안에서 읽고 복원 목록에 병합한다.
- [ ] cloud_only 사진은 파일 재업로드 없이 sequence/sourceUpdatedAt 등 허용 정보만 갱신한다.
- [ ] 관련 테스트 GREEN, 기존 데이터·마이그레이션 회귀 검증 후 보고.

### Task 2: 서버 백업 예약·삭제
**Files:** functions/index.js, functions/backup-quota.js 또는 새 좁은 helper, firestore.rules/storage.rules는 실제 필요한 경우, tests 서버·Rules 실행형 회귀.
**Interfaces:** 기존 reserve/complete API 및 365장 정책 유지. Task1 metadata-only 갱신이 기존 소유 Storage와 세션을 바꾸지 않는 경우 허용되는지 검증.
- [ ] 364장+만료 예약1건 허용, 유효 예약 차단, 중단 음악 업로드 전체 삭제 테스트 RED.
- [ ] 만료 정리를 한도 검사보다 먼저 수행하고 계산에서도 만료 예약을 제외한다.
- [ ] musicUploadSessions의 문서와 소유 Storage 경로를 전체 삭제 대상으로 포함한다. 실제 운영 삭제는 호출하지 않는다.
- [ ] 용량·소유권·중복 정리·재시도 검사를 GREEN으로 확인하고 Functions/Rules 검사.

### Task 3: 영상 연결·이미지 준비
**Files:** features/trip-clip/BodyFrameVideoScreen.tsx, components/trip-clip-recording-canvas.tsx, components/private-media-image.tsx 필요시, lib/body-frame-video.ts 또는 새 helper, 관련 tests.
**Interfaces:** Task1 photoId·sequence 저장 형식 불변. 현재 photoId가 연결된 수치만 영상에 표시하며 삭제된 사진의 순번 수치를 재사용하지 않는다.
- [ ] 사진 삭제→다른 사진 같은 순번으로 이동 시 다른 수치가 표시되지 않는 테스트 RED.
- [ ] 원본 이미지 검증 및 실제 현재 이미지 load/error handshake, 실패/시간 초과/배경 전환 처리 테스트 RED.
- [ ] 영상 export는 원본 준비와 이미지 로딩 완료를 기다린다. 무조건 대량 memory prefetch를 피한다.
- [ ] 동일 캔버스를 이용해 preview/export watermark 및 텍스트 위치를 일치시킨다.
- [ ] 장시간 작업 진행·취소/이탈·저장 부분 성공을 기존 UX에 맞춰 처리하고 관련 검사 GREEN.

### Task 4: 촬영·프로젝트 사용성·접근성
**Files:** features/camera/CameraScreen.tsx, features/camera/BodyFrameProjectSwitcher.tsx, features/camera/camera-screen.components.tsx, features/records/BodyFrameProjectDetailScreen.tsx, features/records/BodyFrameRecordsScreen.tsx, components/app-guide-overlay.tsx; 좁은 helper/components; 관련 tests.
**Interfaces:** 기존 cameraSaveScope를 사용한다. 앨범 권한 대체 동작은 정확한 '앱에만 저장' 문구와 local scope로 일치시킨다. 플랜 권한 기준은 lib/plan-entitlements.ts.
- [ ] 앨범 거절 대체 저장 문구/대상, 보관 복원 한도, 접근성 action 동작을 검사해 RED 확인.
- [ ] 생성·안내 시트는 작은 화면/키보드에서 스크롤과 접근 가능한 제출 버튼을 제공한다.
- [ ] 사진 타일 activate/increment/decrement 및 슬라이더 접근성 value/actions를 연결한다. 사진은 긴 드래그 대신 순번 이동 등 대체 조작을 제공한다.
- [ ] 저장/제스처 helper를 현재 책임에서 분리하되 다른 UI 색/장식을 바꾸지 않는다.
- [ ] 관련 검사 GREEN, 360dp/큰글씨·태블릿 확인 항목 보고.

### Task 5: 통합·에뮬레이터 캡처
**Files:** Android 검증/캡처용 workflow와 scripts, docs/manual-device-qa.md, 이 계획 진행 기록. 제품 기능에 테스트 UI를 추가하지 않는다.
**Interfaces:** Task1~4의 완성 코드. debug APK 또는 실제 Expo native host로 실행한 경우 실행 환경을 명시한다. 웹 모형을 native screenshot으로 표시하지 않는다.
- [ ] 전체 Node suite/타입/lint/Functions/Rules/native build를 수행하고 각 결과를 기록.
- [ ] 새로운 task-owned 모바일/태블릿 AVD를 실행하고 운영 계정과 분리된 데모 기록으로 앱 탐색.
- [ ] 촬영·기록·프로젝트·사진·편집·비교·측정·영상 생성/보관함·설정·계정의 캡처와 메타데이터를 저장.
- [ ] 작은 화면 키보드·큰 글씨, 저장 실패, 영상 image load와 앱 재실행 smoke를 확인.
- [ ] 독립 리뷰, scoped fix, 최종 검증 후 변경을 GitHub 작업 브랜치/PR에 반영하고 화면 이미지 묶음을 전달.

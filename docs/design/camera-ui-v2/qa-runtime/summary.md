# 촬영 탭 네이티브 QA 결과

- 범위: 신규 QA 에뮬레이터의 실제 UI·대표 기능 동작, 360dp/150%의 촬영 모달·패널 및 입력기 접근성.
- 결과: 아래 명시한 대표 시나리오를 통과했습니다. 전체 24조합·실기기·모든 값 조합을 검증한 결과는 아닙니다.
- 원본 Pixel_9/emulator-5554에는 개별 ADB·UI·설정·데이터 변경 명령을 보내지 않았습니다.

## 실행 환경

| 항목 | 값 |
| --- | --- |
| 장치 | BodyFrame_Camera_QA_20261110 / emulator-5556 |
| Android | API 36, Google Play x86_64, pixel_9 프로필 |
| 카메라 | 신규 AVD의 후면·전면 emulated |
| 앱 | com.haebi.photoguide, 기존 debug APK + localhost:8081 Metro 개발 클라이언트 |
| 화면 | 1080×2424px |
| 확대 검증 | density 480 / 폭 360dp / font_scale 1.5 |
| 복원·마지막 확인 | density 420 / font_scale 1.0 / 약 411dp 폭 |
| 마지막 상태 | 촬영 메인, 후면, 줌 1x, 손전등 끔, 타이머 끔 |
| 권한 | CAMERA·READ_MEDIA_IMAGES 허용. READ_MEDIA_VIDEO 미허용 |
| 테스트 데이터 | 게스트 프로젝트 ‘새 프로젝트’, 목표 100장, 최근 사진 기준, 실제 에뮬레이터 촬영 사진 2장 |

사진 2장은 에뮬레이터 샘플 화면을 실제 셔터로 저장한 자료입니다. `2 / 100 · 0.2초`는 촬영 화면의 진행 표시이며 이 QA에서 MP4를 생성한 것이 아닙니다. 직접 DB 쓰기, seed, 미디어 삭제·초기화, 계정 로그인, 커밋·푸시·배포는 수행하지 않았습니다. Tools 개발용 FAB는 신규 QA 장치에서만 숨겨 투명 터치 영역의 설정 버튼 가림을 제거했습니다.

## 확인한 결과와 근거

| 영역 | 실제 실행·확인 | 대표 최종 증거 |
| --- | --- | --- |
| 저장 | OS 사진 권한 허용 후 첫 저장 완료, 셔터 1회 추가로 정확히 2장·2/100 확인 | 03-first-photo-settled, 05-second-photo-settled |
| 프로젝트 선택 | 현재 프로젝트·2/100 진행·선택 상태, 신규/관리/닫기 액션 전체 노출 | 08-project-picker-360-150 |
| 프로젝트 생성 제한 | 1개 프로젝트 제한 메시지와 365장 비활성, 직접 입력 101, 제한 상태의 생성 시도 차단·취소 | 12-custom-target-visible, 18-project-limit-result |
| 프로젝트 IME 150% | 수정 후 숫자 101과 문자 QA title의 값·커서가 보이며 취소/생성/닫기가 키보드 위에 완전히 노출 | 118-project-number-ime-fixed-360-150, 122-project-title-ime-fixed-360-150 |
| 프로젝트 IME 100% | 복원 환경에서 숫자 입력·커서·고정 CTA의 온전한 노출 | 212-project-number-ime-fixed-420-100 |
| 촬영 설정 전체 | 촬영 도구→옵션→품질·6비율→저장→보조의 전체 스크롤 접근. 앨범 체크 off/on, 가이드·햅틱 off/on, 소리/무음 변경과 복원 | 43-settings-top-360-150, 44-settings-middle-360-150, 45-settings-bottom-360-150, 51-settings-support-360-150 |
| 가이드 선택·선 표현 | 7형태·6색·두께 1~5 옵션 존재. 파랑→흰색, 3px→1px 선택 상태 변경·복원 | 65-guide-top-360-150, 76-guide-blue-selected, 80-guide-thick-selected |
| 가이드 숫자·위치 편집 | 숫자 50 입력·Enter 반영 후 44 기본 복원. 위치 편집 진입, 중앙/초기화/완료 실행, 모달 복귀 | 84-guide-number-ime-fixed-360-150, 85-close-guide-ime-before, 93-guide-position-360-150, 98-guide-position-done |
| 사진 가이드 | 첫/최근 전환, 크게/작게, 표시 제거와 다시 표시. 원본 2장 해시 불변 | 103-reference-first-selected, 108-reference-hidden, 109b-reference-reopened |
| 사진 슬라이더·버튼 | 투명도 Tap 40→55→40, 확인. 150% ‘초기화’ 한 줄과 모든 액션 노출 | 194-reference-reset-one-line-360-150, 196-reference-opacity-changed, 198-reference-opacity-restored |
| 색감 접근성 | 닫기/초기화/저장이 스크롤과 독립된 44dp 액션으로 노출. 5슬롯·6슬라이더 존재, 마지막 3개도 스크롤 후 전체 노출 | 127-color-panel-top-360-150, 143-color-bottom-sliders-360-150 |
| 색감 슬라이더·저장 | 수직 swipe는 온도 0 유지·본문 약232px 이동. 가로 drag +40, Tap +20. 슬롯2 저장→초기화0→재선택+20 복원. 마지막 현재 값은 전부0 | 129-color-vertical-result, 132-color-horizontal-result, 136-color-tap-result, 139-color-neutral-reset, 141-color-slot-restored |
| 확대 | 3.0x 표시·selected 정확히 1개, 닫기/재진입 후 유지. 마지막 1x 복원 | 152-zoom-three-selected, 157-zoom-reopened-state, 225-final-zoom-one-420-100 |
| 조명·전후면 | 후면 켜짐 선택·닫기/재진입 유지 후 끔. 전면에서 ‘후면 카메라에서 사용 가능’ 및 양쪽 조명 버튼 비활성. 마지막 후면 복원 | 165-torch-on-selected, 170-torch-on-reopened, 178-front-light-360-150, 223-final-settings-confirm-420-100 |
| 타이머 탭 이탈 | 10초 선택, 실제 숫자7 countdown 확인 후 기록 탭 이동. 11초 대기 후 사진 수2 유지. 마지막 타이머 끔 | 185-timer-selected, 189-countdown-before-navigation, 191-records-after-timer-window, 204-timer-off-restored |
| 백그라운드 복귀 | Home으로 이탈 후 MainActivity 복귀. 프로젝트2/100·셔터 enabled 유지 | 206-camera-background-resumed |
| 권한 거절·복귀 | 신규5556만 CAMERA revoke. 거절 화면의 CTA48dp·기록 이동, 촬영 복귀, 명시적 요청과 OS ‘While using the app’ 재허용 | 214b-camera-permission-denied-ready, 216-records-without-camera-permission, 219-camera-os-regrant-dialog, 221-camera-after-regrant |
| 최종 보존 | 원본 파일2개·경로·SHA-256 모두 baseline과 동일. 420dpi/100%, 후면/1x/조명OFF/타이머OFF 촬영 메인 | 223-final-settings-confirm-420-100, 225-final-zoom-one-420-100, 227-final-camera-handoff, final-state.json |

각 증거 이름에 `.png`, `.xml`, `.json`이 대응합니다. 전체 동작과 스크롤·탭 좌표는 `actions.jsonl`에 있습니다. 원인 조사·실패 중간 장면도 원본으로 남아 있으므로 디렉터리의 모든 캡처를 최종 PASS 화면으로 취급하면 안 됩니다.

## 발견 후 재확인한 문제

1. 프로젝트 숫자 키보드가 고정 푸터 일부를 덮음: 14 PNG에서 재현. 메인/프로젝트 에이전트 수정 후 118·122·212에서 해결 확인.
2. 가이드 숫자 입력이 가로로 밀려 XML 폭이 음수: 65 XML·PNG에서 재현. 메인 에이전트의 slider flex 수정 후 84에서 정상 입력과 IME/닫기 노출 확인.
3. 가이드 슬라이더 위 수직 swipe가 값44→49를 바꾸고 스크롤을 막음: 65·71과 동작 기록. 공유 슬라이더 수정 후 색감129에서 수직 값 유지·스크롤, 132·136에서 가로 drag/Tap 동작 확인.
4. 사진 ‘초기화’가 150%에서 두 줄로 분리: 101에서 관찰. 가로 padding 보정 후 194 PNG에서 한 줄 확인.

품질·비율 변경 중 59b의 1:1 탭은 클리핑된 약5px 높이의 대상을 사용했습니다. 이후 selected=true 관찰은 있었지만 이를 완전 노출된 44dp 버튼 접근성 PASS로 세지 않습니다. 최종 품질 높음·비율3:4 상태는 후속 캡처에서 관찰했습니다. 후속 액션은 최소44dp(기기 픽셀 반올림 허용) 및 스크롤 경계 확인을 적용했습니다.

## 미검증·해석 제한

- ARM64 실기기, 광학 화질·초점·실제 조도·광학 줌·실제 셔터음은 미검증입니다. 신규5556의 emulated 카메라는 기존5554 virtualscene과 배율 지원 범위가 다릅니다.
- 7종 가이드의 모든 편집 조합·도형 꼭짓점·실제 손가락 핀치/드래그, 모든 슬라이더의 각 경계값 조합은 실행하지 않았습니다. 존재와 대표 동작을 구분해 기록했습니다.
- 슬라이더 수직/수평 축 분리는 공유 컴포넌트의 색감 실제 UI로 재검증했습니다. 수정 후 가이드·사진 각각의 모든 수직/수평 조합을 반복하지 않았습니다.
- 사진 색감 설정을 바꾼 새 사진을 추가로 저장하여 파일 픽셀 효과를 비교하지 않았습니다. 색감 슬롯의 실제 UI 저장·복원까지 확인했습니다.
- 타이머는 탭 이탈 취소를 확인했습니다. countdown 중 Home 이탈 취소는 별도 실행하지 않았습니다. 일반 Home 이탈·복귀는 별도 통과했습니다.
- 권한 user-fixed 영구 거절, 앨범 저장 실패·기기 저장 공간 부족·카메라 하드웨어 장애·타임아웃 주입, TalkBack 읽기 순서, 계정·클라우드·결제·영상 생성은 미검증입니다.
- 24개 전체 조합·별도 라이트 테마·태블릿 재검증은 이 runtime QA 범위가 아닙니다. 권한 복귀와 100% IME는 복원 환경420dpi/100%에서 실행했습니다.
- 구형 APK의 네이티브 코드와 Metro의 작업 트리 JS를 함께 실행한 개발 클라이언트 QA이며, 서명된 배포 APK·Play 검증 결과가 아닙니다.
- Git 작업 트리에는 다른 에이전트의 동시 수정과 hot reload가 있었습니다. 이 에이전트는 제품 코드를 수정하지 않았습니다.

## 원본 사진 SHA-256

초기 `original-media-before.json`과 최종 `original-media-after.json`이 완전히 일치했습니다.

| 앱 내부 파일 | SHA-256 |
| --- | --- |
| `files/photos/project-1794239159621-hbxln72m/photo-1794239296471-393lqn5h.jpg` | `ab9a11ab66b61156708c0a80c76f34b58dbe4249eb7f26f48cff9dcfc303865b` |
| `files/photos/project-1794239159621-hbxln72m/photo-1794239335909-sh0uu8pb.jpg` | `d6c70720be9a2dab11b717c387c4f2e3b8ad762d2f74211de89ccfdef6e99f97` |

## 최종 실행 메타데이터

- Git HEAD: `4ca8b4a` + 당시 작업 트리 hot reload.
- 기록 UTC 기준: `11-09 15:48:15.000` 이후 보존된 ReactNativeJS 로그에서 `Uncaught / OperationCanceledException / Error: / TypeError / ReferenceError` 매칭 **0건**. 로그 버퍼 범위 내 관찰 결과이며 영구 무오류 증명이 아닙니다.
- 권한: CAMERA=true, READ_MEDIA_IMAGES=true, READ_MEDIA_VIDEO=false.
- 최종 촬영 화면: [227-final-camera-handoff.png](227-final-camera-handoff.png).
- 최종 상태 상세: [final-state.json](final-state.json), 원본 해시: [original-media-after.json](original-media-after.json).
- 신규5556은 촬영 메인에 둔 채 제어를 인계합니다. AVD 종료·삭제는 이 에이전트가 수행하지 않았습니다.

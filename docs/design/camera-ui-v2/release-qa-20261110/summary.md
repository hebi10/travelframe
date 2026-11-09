# 배포 APK 설치·누락 연결 경로 마무리 검증

2026-11-10 KST. 완료 감사에서 구현 결함은 발견되지 않았으나 연결 경로 3개의 실제 진입 증거와 개발환경 안내의 버전 표기가 부족했다. 이번 작업은 그 증거·문서 보완이다. 제품 UI·코드를 변경하지 않았으므로 기존 생성 시안·구현·비교 결과를 유지하고, 새 디자인 이미지는 만들지 않았다.

## 검증 바이너리와 환경

- 앱: `com.haebi.photoguide`, `1.0.33 (26092625)`.
- 제출 소스: `6ebe3874c0e9545a97682f7d694ce9be36f04a39`.
- [서명 AAB·동일 번들 APK 빌드 및 alpha 게시 실행](https://github.com/hebi10/travelframe/actions/runs/42659941219).
- GitHub artifact `13694723865` ZIP SHA-256: `d84631b78f8eeb624d2f87b179682984a56814b54d4cca1f24ad4bc737fa65e6`.
- 실제 설치한 APK의 SHA-256: `f25f36aa4fab7b595a480e2f44225d461aca1c48e8b86df360f1787f7c79ec68`. 추출 후 해시와 aapt manifest, 설치 후 dumpsys 버전을 재확인했다.
- 완전히 새 `BodyFrame_Release_QA_20261110_26092625`, emulator-5558, API36/google_apis_playstore/x86_64, Pixel9, 1080×2424/420dpi/글꼴100%.
- APK 자체의 번들로 실행했다. 기존 Metro와 사용자 기기5554에 앱을 덮어쓰지 않았다. 기존5554 및 이전5556의 AVD 설정과 초기 repositories.json 보존은 환경 담당자가 전후 해시로 확인했다.
- 새 QA 기기에만 프로젝트1개·에뮬레이터 아바타 사진3장을 만들었다. 계정 로그인·몸무게·체지방률·메모 입력이나 영상 내보내기는 하지 않았다. 검증 뒤5558만 종료하고 AVD 파일·QA 데이터를 보존했다. 기존5554와 Metro8081은 실행 상태다.

## 실행 결과

| 확인 | 결과 | 실제 증거 |
|---|---|---|
| 첫 설치·카메라 권한·단독 앱 실행 | PASS | 01~04 PNG/XML |
| 촬영 상단 계정 → /account, 게스트 제목 | PASS | 05-account-route, 06-account-return |
| 새 프로젝트 생성·프로젝트 관리 → /studio | PASS | 07~11, 특히10-project-management-route |
| 수치 기록·촬영 후 제안 켜기 및 저장 | PASS | 12~19 |
| 실제 촬영 → 수치 기록 → /photo/[id]의 기록 정보 | PASS | 20-capture-measurement-prompt.xml, 24-photo-measurement-route |
| 입력 취소 후 사진 상세 #2·촬영 복귀 | PASS | 25-photo-detail-route, 26-camera-return-after-measurement |
| 3x 선택 후 패널 닫기·재열기 | PASS | 33~35, 35에3.0x |
| 3x 실제 촬영 후 기록 탭 왕복·촬영값 복원 | PASS | 36~38, 사진3장 및3.0x |
| Home·앱 복귀 후 촬영·줌 복원 | PASS | 39~42, 41에3.0x |
| 사용 가이드 6단계 표시·다음·완료 | PASS | 43~53, 46~51이각단계 |

`actions.jsonl`은 관측한 텍스트·접근성 이름과 실제 bounds로 누른 동작을 기록한다. `verification.json`은 9개 핵심 조건, 가이드6단계, 이전 검증 대상 제품10파일의 현재 SHA-256 일치를 확인한다. `native_audit.py`는 새 QA AVD 이름이 일치할 때만 실행되며 기존 데이터 seed/초기화 기능이 없다.

### 처음 촬영 권한 단계

첫 수치 기록 프롬프트 자동 관측은 Android 사진·영상 권한 창 때문에 `NOT_OBSERVED`였다. `20-capture-unexpected-state` 및 `22-after-capture-observation`은 Android permissioncontroller 화면이다. 새 QA 기기의 권한을 실제 허용한 뒤 재촬영했고, 다음 프롬프트는 셔터 후3.853초에 관측·탭되어 기록 정보로 정상 진입했다. 실패 흔적을 지우거나 앱 결함으로 분류하지 않았다.

### 프로젝트 촬영값 기억 정책

처음에는 마지막 촬영이1x인 상태에서3x만 선택하고 탭을 왕복하여1x가 복원됐다(29→32). 기본 켜짐인 촬영 설정 기억은 **성공한 마지막 촬영 조건**을 복원하므로 기존 [기기 QA 정책](../../../manual-device-qa.md)에 맞는 결과다. 패널 닫기 자체는3x를 유지했고(35), 실제3x 촬영 후 탭 왕복(38)과 Home 복귀(41)에서는3x가 복원됐다. 전역 설정과 프로젝트 마지막 촬영값을 혼동한 검증 기대를 정정했으며 제품 코드는 변경하지 않았다.

## 실제 배포판과 이전 최종 팝업의 1:1 비교

이전 `guide-popup-v2-20261109/after-final`과 이번46 캡처를 모두1080×2424 원본으로 비교했다. 첫 팝업 bounds는 양쪽 모두 `[47,636,1033,1867]`, 크기986×1231px로 일치했다. 원본 픽셀을 재색상·재배율하지 않았다.

- 팝업 전체 평균 RGB 절대차:0.2529/255. 픽셀 완전일치76.10%, 최대 채널차2이하99.26%.
- 텍스트·이미지·버튼의 시각 배치는 유지되며 미세 픽셀 차이가 남는다. 최대 단일 채널차219이므로 픽셀 완전일치라고 보고하지 않는다. 배경 스크롤·시스템 상태·개발 오버레이는 다르다.
- 가장자리48px을 제외한 내부 영역의 비교 수치도 `guide-first-native-comparison.json`에 원본과 함께 기록했다. 기존 생성 시안 대비 디자인 비교는 이전 comparison.md를 유지한다.

## 실행 로그·한계

- 최종 앱 PID 로그의 Camera is not active/OperationCanceledException, FATAL EXCEPTION, 처리되지 않은 Promise, HostFunction 예외는 모두0건이다. `runtime-log-summary.json` 참조.
- Google Play 계정이 없는 별도 기기에 upload-key APK를 설치한 환경이라 처리된 IAP 초기 연결 실패 로그3건이 있다. 실제 결제·복원과 Google Play 앱 서명본 설치까지 통과했다는 의미는 아니다.
- 이번 추가 검증은 에뮬레이터 대표 시나리오이다. 실기기·광학줌·실제 토치·TalkBack·전체 테마/글꼴/기기24조합을 검증했다고 확대하지 않는다.
- Play API commit/readback 성공과 Google 심사 승인·테스터 제공은 구분한다. 현재 게시 상태는 완료 보고 시 Console에서 별도로 확인한다.

## 병렬 감사와 반영

- 요구 범위 담당: 원 계획·시안·캡처·소스 해시를 대조해 위3경로 증거 공백과 오래된 /projects 표기를 발견했다. 실제 경로 /studio로 문서만 정정하고 새 증거를 독립 검토했다.
- 배포 담당: exact SHA의 Play/Quality/Secret Scan 성공, 영수증16조건 및 artifact digest 일치를 확인했다. 줌의 마지막 촬영 복원 정책을 코드·기존 검사로 독립 확인했다.
- 환경 담당:9개 저장소 폴더/원격 일치, Android Studio/Metro의 TravelFrame 경로를 확인하고 개발환경 안내를 갱신했다. 원본 AVD를 보존하며 새5558을 준비했다.
- 메인: 실제 서명 APK 해시·설치·UI·로그·1:1 비교를 검증하고 각 변경을 검토했다. 다른8개 앱은 폴더 준비 확인 범위이며 전체 빌드·배포까지 완료한 것으로 보고하지 않는다.

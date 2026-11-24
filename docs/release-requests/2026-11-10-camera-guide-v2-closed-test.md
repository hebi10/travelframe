# 촬영 탭·사용 가이드 V2 비공개 테스트 배포 요청

- 사용자 명시 승인: 위 변경을 GitHub에 반영하고 Google Play 비공개 테스트까지 배포.
- 대상 저장소: hebi10/travelframe, Android package com.haebi.photoguide.
- 표시 버전: 1.0.33. versionCode는 기존 보호된 Play 인벤토리 경로에서 모든 현재 트랙·번들·APK 최댓값+1로 정한다.
- 대상: 기존 비공개 테스트 alpha. 운영·공개 트랙, Firebase 서버, 상품·가격·테스터 설정은 변경하지 않는다.
- 기존 upload key/WIF/인증서 검증·정확한 main source SHA·AAB/APK manifest·R8·provenance·최종 commit/readback 검증을 유지한다.

## 변경 내용

- 실제 화면을 참고해 생성한 가이드 이미지와 사용 가이드 팝업 V2.
- 촬영 메인, 프로젝트 선택·생성, 촬영/라인 설정, 사진·색감·확대·조명 패널 정돈.
- 카메라 줌·노출 promise 수명 관리, 기기 지원 줌 프리셋과 소수 정밀도 저장.
- 큰 글씨 키보드 가림·숫자 입력 숨김·슬라이더 스크롤 충돌·탭 조절 영역 보정.
- 기존 사진·영상·프로젝트·저장/플랜 정책 보존.

## 검증과 증거

- 공식 기본 회귀362개 파일, 타입검사, 린트, diff 검사, 비밀정보 검사 통과. 표시버전 메타데이터 변경 후 release/Play 관련 검증도 별도 수행한다.
- 별도 QA 에뮬레이터에서 실제 사진2장 저장,360dp/150% 및 기본100% 대표 모달/입력, 색감 슬롯, 줌/조명, 타이머 취소, 권한·백그라운드 복귀 확인.
- 기획/시안/프롬프트/전후 실제 캡처/차이 보정: docs/design/camera-ui-v2/comparison.md, qa-runtime/summary.md, docs/design/guide-popup-v2-20261109/comparison.md.
- 사용자 기기의 기존 사진2장·0.2초 영상은 유지했고 개인 미디어 ID/해시 상세와 임시 캐시는 공개 커밋에서 제외한다. QA 중간 원본은 로컬에 보존하며 공개 증거는 보고서가 인용하는 핵심 자료로 제한한다.
- 실기기·광학줌·실제 토치·모든 상태 조합·서명 배포 APK의 설치 QA는 이 에뮬레이터 검증과 구분한다.

## 실행과 성공 판정

1. 검증된 앱 커밋을 main으로 fast-forward 푸시한다. 파괴적인 강제 푸시/리셋은 하지 않는다.
2. GitHub 연결 도구의 읽기 기능으로 실행을 확인하고, 기존 `[deploy-closed]` main 트리거를 한 번만 사용한다. 별도 수동 실행으로 중복 업로드하지 않는다.
3. 서명 AAB 빌드·게시 완료까지 추적한다. receipt가 committed-and-read-back이며 apiTrack=alpha, 해당 source SHA와 새 versionCode가 일치해야 API 배포 성공으로 판정한다.
4. Play 심사 승인·테스터 설치 가능 시점은 별도로 구분한다. 실행 시작이나 GitHub 테스트 통과만으로 스토어 배포 완료라고 보고하지 않는다.

# TravelFrame D단계 — Android 통합 화면·접근성 QA (2026-11-08)

기준: `main@e07ea55e3ff8543b8d9625328b1355106740698e`; A·B·C단계 UI 개선 병합본. 기존 디자인 QA #73 및 원본 시안·실제 Android 236개 캡처를 참고.

## 실제 화면에서 확인된 잔여 문제

- C단계 [600dp 레거시 사진 관리 화면](https://github.com/hebi10/travelframe/actions/runs/42435290018)에서 `편집`·`보기`·`삭제` 버튼의 접근성 트리 범위가 높이 32dp로 표시됐습니다. 750dp도 동일. 이는 권장 44dp 터치 영역보다 작습니다.
- 이전 QA의 반응형 변형은 다크 100%, 라이트 130%, 다크 150%만 검사해 **라이트 150%**의 화면/모달·온보딩·프로젝트 생성이 비어 있었습니다.
- 합성 사진 ‘1·2·3’과 실제 인체 사진은 콘텐츠가 다릅니다. PNG 무결성·UI 요소 렌더링 성공만으로 디자인 픽셀 일치, 실사진 품질 또는 TalkBack 읽기 순서를 완료 처리하지 않습니다.

## 이번 D단계 코드 보정

- `features/studio/studio-screen.styles.ts`의 레거시 사진/작업물 `편집`·`보기`·`삭제`, 페이지 이동, 재시도 버튼의 최소 높이를 공통 토큰 `bodyFrameDesign.minTouchSize`(44dp)로 통일합니다. 삭제 버튼의 최소 너비도 44dp. 기존 기능·라우트·저장 데이터 변경 없음.
- `features/studio/studio-screen.components.tsx`: 사진 썸네일 및 편집/보기/삭제 Pressable에 `accessibilityRole="button"`, 촬영 날짜가 포함된 구분 가능한 한국어 라벨을 부여. 아이콘·색상·그림자·애니메이션 추가 없음.
- `scripts/capture-android-qa.py`: 4폭 디자인 매트릭스에 `light-150`(시스템 폰트 150%, 앱 큰 글꼴, 라이트 모드)을 추가.
- `scripts/capture-stage13-android.py`: 360·412·600·750dp × 4변형에 **기존 59개 화면 + 라이트 150%의 핵심 12개와 첫 실행·신규 프로젝트 2개**를 추가(총 예상 **73장/폭, 292장**, 성공 후 실수치 확정). 안드로이드 에뮬레이터의 실제 PNG/XML/상태 매니페스트를 저장합니다.
- `scripts/check-stage6-visual-artifacts.py`·Stage6/Stage13 호스트 테스트: 새 변형을 실증. `tests/body-frame-design-stageD-integrated.test.mjs`: 44dp 터치 범위, 사진별 접근성 역할, 기존 편집·삭제 라우트, 4폭·테마/폰트 및 Play 게시 게이트를 회귀 확인.
- `.github/workflows/body-frame-device-qa.yml`: Stage D 브랜치에서 기존 x86_64 APK/네이티브 기능 검사와 4폭 원본 캡처를 모두 실행.

## 최종 QA·병합 기준

1. 최신 PR head 기준 Quality(TypeScript/ESLint/전체 테스트·Firebase Rules/Functions·Android Manifest/Kotlin), Secret Scan 성공.
2. 같은 head의 Android Native QA에서 APK 빌드, 오프라인 실기능/영상 렌더링·백그라운드·저장·키보드 동작 검사 성공.
3. 360/412/600/750dp에서 dark100/light130/dark150/light150, 최초 온보딩, 생성 모달, 빈 프로젝트, 설정·영상·기록·비교 포함 예상 292장 PNG 전체 성공. 누락/불균일·빈 화면/시스템 ANR는 실패로 보존.
4. D 실제 PNG와 직전 C 디자인/원본 시안 동일 프로필 대조, 600·750dp 레거시 사진 조작 버튼 높이 검수. 글자 확대에서 CTA/키보드·Safe Area 가림 여부를 수동 검토.
5. 통과할 경우에만 PR을 `main`에 병합. 병합은 `[skip ci]` 메시지로 이번 push의 Play 자동 게시를 건너뛰고, 실제 Actions 미실행·main HEAD 검증. 이전처럼 내부·비공개/프로덕션 Play 신규 게시 **금지**.

## 명시적 미검증

- 진짜 ARM64 휴대폰/태블릿의 촬영·프레임 정렬·앨범/MP4 재생, TalkBack 음성 순서·터치 탐색, 실사용자 사진/영상 및 실제 계정.
- 기존 레거시 `TripClipScreen`의 실제 저장 영상 재편집 동등성, 실구독 결제/복원·환불, Firebase·AdMob·Health Connect 운영 권한.
- 보안 이슈 #106/PR #116 및 Google Play Console 인증서 SHA-256 3자 대조.
- 이를 해결하지 않고 Play 출시 준비 완료로 보고하지 않습니다.

참고: [원본 디자인 비교 기획](https://docs.google.com/document/d/1EEPCjSOLidZloCC2v561nW-W-rU0-BjLVXejztWl_Ps/edit) · [디자인 QA 이슈 #73](https://github.com/hebi10/travelframe/issues/73) · [C단계 QA](https://github.com/hebi10/travelframe/actions/runs/42435290018).

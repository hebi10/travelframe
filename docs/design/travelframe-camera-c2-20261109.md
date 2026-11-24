# TravelFrame C2 — Frame Journal 프로젝트 모달 리디자인

- 작업: 촬영 탭의 **프로젝트 선택·새 프로젝트 생성** 2개 Android 바텀시트
- 기준: C1 PR #140 (`feat/r3-frame-journal-camera-c1-20261109`), 이후 C2 독립 PR로 순차 병합
- 콘셉트: Frame Journal — 기록 사진과 촬영 상태가 우선인 블랙·그레이 중심의 간결한 정보 구조
- 제외: 카메라 네이티브 로직, 촬영 프리뷰·가이드·셔터, 요금제 데이터·저장/백업·출시 변경, 그 밖의 모달

## 변경: 프로젝트 선택

1. 공통 `BodyFrameSheetHandle/Header`를 유지하고 제목 아래 '촬영할 프로젝트를 선택하세요.'를 표기.
2. 상단 '내 프로젝트 · N개'로 보관되지 않은 프로젝트만 집계. 목록은 높이가 제한된 독립 스크롤.
3. 항목에 프로젝트 이름(최대 2줄), **현재 사진 / 목표 사진·영상 길이** 표시. 현재 프로젝트는 모노톤 표면·테두리와 '촬영 중'·체크로 구별.
4. 프로젝트 0개는 짧은 빈 상태 안내. 하단에 '새 프로젝트' Primary / '프로젝트 관리' Secondary를 항상 유지.
5. 목록 선택 시 `onSelectProject`와 세션 동기화·저장 중 선택 차단은 그대로 둔다.

## 변경: 새 프로젝트

1. 공통 시트 제목·설명과 콘텐츠 ScrollView를 분리.
2. '프로젝트 이름' → '목표 기록 수' → '촬영 기준 사진 방식' 순서 유지.
3. 기록 목표 100/365/직접 입력과 플랜별 선택 제한은 현행 함수 `isBodyFrameProjectTargetAllowed` 사용. 선택은 테두리·배경·텍스트로 표시.
4. 첫/최근 기준 사진 라디오 선택은 기존 의미와 기본값 `latest` 유지.
5. 고정 하단 액션은 `BodyFrameSheetFooter`의 '취소 / 프로젝트 만들기'로 통일, 48dp 터치 높이 보존.
6. 생성 중 뒤로가기·외부 영역 터치로 시트가 닫히지 않도록 안전하게 보호. `onCreateProject` 거부 시 시트를 유지하고 오류를 표시, 입력 시 오류를 지움. 성공 시 기존 폼 초기화 유지.

## 테마·접근성

- 공통 `palette.surface/background/line/text/muted`, `getBodyFrameControlColors` 우선.
- 보조 문구 12sp, 목록 제목 15sp, 선택 항목 14sp; 컴팩트 헤더는 C1의 14sp·48dp 규격 보존.
- 최소 터치 44dp, 주요 동작 48dp, 시트 최대 높이 86%, 키보드 회피와 콘텐츠 스크롤 유지.
- 앱 화면을 벗어나지 않는 360/412/600/750dp, 다크/라이트, 글꼴 100/130/150% 검증.
- 색상만으로 선택 상태를 표시하지 않음; Radio `accessibilityState.selected`, 버튼 명칭, 입력 레이블, 오류 접근성 표시 유지.
- 추가 그림자·그라데이션·불필요한 애니메이션·한쪽 면 border 없음.

## 검증/출시 정책

- 실제 APK 수정은 C1 후속 PR과 QA를 통해 확인. 이번 자료는 UI 소스/자동 테스트 계획이며 촬영 실기기 완료 증거가 아님.
- C2 병합 순서: C1 PR 통과·병합 → C2 base main 변경 → 모든 CI·Android 에뮬레이터 실제 모달 캡처 확인 → 병합 검토.
- 기존 프로젝트 ID, 사진 수·목표, 상태, 새 프로젝트 생성 저장 및 플랜 제한은 변경하지 않음.
- Google Play 내부/비공개/프로덕션 배포, Firebase 운영 배포, 인증·업로드 키/결제/백업 변경 금지.

[프로젝트 저장소](https://github.com/hebi10/travelframe) · [디자인 기준](https://github.com/hebi10/travelframe/blob/main/docs/design/body-frame-r0-frame-journal-20261108.md)

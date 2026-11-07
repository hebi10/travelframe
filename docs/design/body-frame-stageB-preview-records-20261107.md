# TravelFrame B단계 — 영상·기록·촬영·전후 비교 정밀 보정 (1차)

기준: 2026-11-07. 독립 미병합 A단계 `feat/body-frame-design-stageA-density-20261107`의 head `2f590fe799f11a64ebfaa23990b89aaafcfb03e5`를 부모로 합니다.

## 구현 범위

1. 영상 만들기 `features/trip-clip/BodyFrameVideoScreen.tsx`
- 출력 비율 3:4/1:1/16:9 및 영상 렌더러는 그대로 둡니다.
- `previewDisplayWidth`의 화면 높이 계수를 0.35→0.30으로 축소, 360dp에서 영상 설정의 첫 행들이 더 일찍 보이도록 상단 부연/미리보기 라벨의 여백도 단축했습니다.
- 오버레이 텍스트, 화질, 전환, 사진 선택, 구독 한도, MP4 생성/앨범 저장 기능은 그대로 보존합니다.

2. 프로젝트 상세 `features/records/BodyFrameProjectDetailScreen.tsx`
- `기록/수치/통계` 탭 아래 여백 12→8dp, 첫/최근 비교 카드 이미지 높이 172→156dp, 카드 내부 패딩/진행률 영역과 CTA 하단 여백을 줄여 기록 사진 그리드를 조금 더 위로 배치했습니다.
- 사진 요약 미리보기는 여전히 `contentFit="contain"`으로 원본을 자르지 않습니다. 기존 사진 고유 ID·정렬/드래그·편집·저장 및 첫/최근 비교 기능은 유지합니다.

3. 촬영 `features/camera/BodyFrameCameraScreen.tsx`
- 카메라 프리뷰 상단에 겹치는 기록 안내 패널의 상/하 여백만 축소하고, 촬영 한도·프로젝트 전환·사진 저장 메시지·가이드의 동작은 그대로 유지합니다.

4. 전후 비교 `features/records/BodyFrameCompareScreen.tsx`
- 보조 영역 간격을 축소하고 안내 문장을 간결하게 교체했습니다.
- 중앙 분할선/드래그/25·50·75% 조절/접근성 `adjustable` 및 실제 이미지 표시 비율을 변경하지 않았습니다.

## 검증

- 신규 `tests/body-frame-design-stageB-layout.test.mjs`에서 TSX 구문 및 4개 화면의 핵심 기능/정보 보존을 검증합니다.
- `tests/body-frame-design-stage14.test.mjs`의 고정 이전 UI 치수 기대만 현재 값으로 업데이트했습니다.
- `Body Frame native device QA`의 360/412/600/750dp 디자인 캡처 매트릭스를 B단계 브랜치에 연결했습니다.
- 모든 변경은 Android UI 배치 위주이며 저장/결제/광고/백업·Android 권한·Google Play 서명·원격 데이터·영상 출력 엔진 수정이 없습니다.
- 현재 A단계 PR #117의 네이티브 검증/병합이 선행되어야 합니다. B단계는 그 위에 쌓는 PR로 관리하며 A 병합 후 base를 main으로 옮깁니다.
- 스크린샷 PNG 무결성과 실제 실사진·ARM64 기기/클라우드/실결제 결과는 구분합니다.
- Play 자동 배포 승인 변수를 직접 읽을 수 없기 때문에 디자인 병합은 GitHub Actions push/PR 이벤트 건너뛰기(`[skip ci]`)로 무게시를 보장하되, 그 커밋의 main 검사가 생략되는 점을 별도 기록하고 사전 PR CI 통과를 의무화합니다.

참조: A단계 PR https://github.com/hebi10/travelframe/pull/117, UI 비교 기획 https://docs.google.com/document/d/1EEPCjSOLidZloCC2v561nW-W-rU0-BjLVXejztWl_Ps/edit

# TravelFrame 디자인 시안 마무리 — Stage 10 이후 영상·설정·아이콘·빈 상태

작성일 2026-11-06 · 기준 `main@b212add0aa94c081c361ce984e3491af07164a0e`.

## 디자인 기준
- [피트니스 화면별 디자인 시안](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view)
- [디자인 시스템](https://drive.google.com/file/d/124i6p8cCW1vxM_2N2H321fw4L9QZsNqK/view)
- [다크 UI](https://drive.google.com/file/d/19Kh11wAzwNoc-Cfpjjhbtqezk1S7bqfG/view)

[Stage 10 프로젝트·기록 PR #97](https://github.com/hebi10/travelframe/pull/97)은 이미 `main`에 병합되었습니다. 예전 브랜치 [PR #96](https://github.com/hebi10/travelframe/pull/96)의 기록·프로젝트 상세 파일을 다시 합치면 **Stage 10에서 추가한 기록·수치·통계 탭이 사라집니다.** 그러므로 Stage10 코드를 그대로 보존하고 필요한 6개 파일만 새로운 브랜치로 분리했습니다.

## 이번에 반영한 UI

1. 영상 홈: 원본 시안의 영상 관련 일러스트를 상단 카드에 함께 표시하고, 18dp 세로 간격·14dp 카드 패딩으로 위계를 압축. 영상 만들기, 영상 관리, 프로젝트별 사진, 최근 영상 모두 유지.
2. 영상 제작: 시안 대비 너무 작았던 미리보기 프레임을 화면 너비 72→82%로 확대(360dp 한도), 사진/영상 인코딩 프레임 계산과 구독/앨범 저장 로직은 그대로 유지.
3. 설정: 6개 그룹과 모든 저장/결제·백업/사용자 글꼴 설정은 그대로 두고, 섹션 간격·행 높이를 정돈. 기능별 Feather 아이콘을 일반 상태색으로 표시하고 주요 터치 영역 44dp 이상 유지.
4. 하단 탭: 기록 `image`, 영상 `youtube`로 아이콘 의미를 강화. 촬영·기록·영상·설정 4탭, 숨김 계정 라우트 유지.
5. 빈 상태: 새 프로젝트·저장 영상 안내 문구를 간결하게 정리하고 기존 원본 일러스트/주요 버튼 유지.

## 수동 시각 검증으로 남는 항목
- 자동 Android 에뮬레이터는 인물 사진 대신 임시 숫자 패턴 사진을 사용하므로 시안과 실제 사람 사진의 사진 구성·구도·크롭은 실기기에서 별도 확인.
- 360/412/600/750dp 및 글자 100/130/150%, 카메라 Safe Area, 녹화 재진입, 타이틀 줄바꿈, 모든 바텀시트·빈/오류/권한 거부·결제·계정 상태를 실제 캡처로 검수.
- 기존 [10단계 Android 탭 QA PR #98](https://github.com/hebi10/travelframe/pull/98)의 프로젝트 상세 새 탭 검사와 병행하고, 해당 QA 스크립트를 이 PR에서 덮어쓰지 않음.
- 현재 브랜드 런처 아이콘은 인물 프레임. Drive의 BF 모노그램과 다른 것은 확인했으나, 승인되지 않은 브랜드 교체를 임의 실행하지 않음.
- 2026-11-07 11:01 KST 이전 새 업로드 키 유효 제한과 자동 Play 게시 승인 게이트 유지. 본 작업에서 AAB 업로드/Keytool/Secretes 변경 없음.

## 완료 조건
최신 `main` 기준 TypeScript·Lint·전체 테스트·Firebase·Kotlin/Manifest·Secret Scan 성공, Native QA와 Android 캡처 결과 확인 후 `main` 병합. 사람 눈 디자인 동일성은 자동 테스트만으로 완료 판정하지 않음.

# TravelFrame UI-R10-02C — 촬영·기준 사진·전후 비교 사용성 보정

기준: 2026-11-12 · main 4a78e8c544d69410f6663634070bbefa8ad38ea3
근거: Google Drive v3 기획 01/02/05 및 9화면 1:1 비교 문서
현재 상황: 선행 PR #156, #160, #161은 별도 QA·병합 진행 중. 본 작업은 독립 Draft PR로 분리.

## 변경 범위
1. 카메라 미탐색 상태 문구와 명도를 개선하되 Camera native device / onStarted / onStopped / useCameraPermission / 캡처 저장 로직은 변경하지 않는다.
2. 기준 사진 조정 패널: 검은 미디어 크롬 유지, 제목·원본 무변형 설명·현재 기준(첫/최근/직접 선택) 상태 문구, 작게/크게/초기화 접근성 이름 강화. 프로젝트 기준 전환 버튼은 '최근 사진으로 변경'과 '첫 사진으로 변경'을 명확히 구분한다. 저장·삭제·크기·위치·투명도 슬라이더 계산은 불변.
3. 전후 비교: 사진 순번 바로 아래로 촬영일 날짜를 이동하고 360dp/큰 글자에서 줄바꿈·정렬 보완. 3모드 선택 힌트와 슬라이더 조작 접근성 힌트 추가. 중앙 핸들 크기 44→48dp 확대. PanResponder 및 10~90% clamp, 25/50/75%, EXIF·원본 파일, 비율 contain 그대로 보존.
4. 사진 0/1장 부족, 오류, 카메라 권한 거절은 기존 안내·복구 흐름 유지. 새 사진 저장/공유 기능, 수치·영상/결제 기능 추가 없음.

## 테스트 게이트
- 동일 HEAD에서 TypeScript·ESLint·Node/Android Gradle/Firebase Rules·Functions/Secret Scan 성공.
- Android API35 x86_64 360·412·600·750dp × Light/Dark × 폰트100/130/150%=24환경 원본 PNG/XML/manifest 검증(기존 Stage13).
- 프로젝트 기준 사진 없음/첫/최근/직접 선택, 패널 0/40/100%·가이드 원본 유지, 360dp 150% 확인 버튼 노출, 비어 있는 카메라·권한 거절·연결 재시도, 비교 사진 0/1/2/다수, 이종 종횡비, 3모드, 10~90% 손 제스처, TalkBack 기본 접근성 이름.
- 실제 ARM64 카메라 렌즈·조명·권한·EXIF·비식별 실사진 전후 정렬·TalkBack 발화는 이 자동 캡처로 보증할 수 없으며 **UI-R10-04 최종 출시 게이트**까지 미검증으로 구분.
- 선행 PR #156·#160·#161 안전 병합 후 최신 main 재검증, 이 PR도 CI/디자인 검수와 리뷰 미해결 0건일 때만 안전 병합.
- 전 기획 완료 전 Google Play AAB 내부/비공개 테스트 업로드·승격 금지.

## 참고
기획 v3: https://drive.google.com/drive/folders/1ElpylZuwTLdPA2VFqnyUO9PxKk8faCcT
비교 보고서: https://docs.google.com/document/d/1Mh6-cyEVLhKfHHPP2NxvkeXc7x5Jesu1KiblWk0eeUg/edit

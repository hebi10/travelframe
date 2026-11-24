# 사용 가이드 팝업 V2 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the UI implementation; a separate agent checks existing QA selectors and contracts.

**Goal:** 생성한 팝업 시안을 실제 Android 안내 화면으로 구현하고 같은 크기에서 비교·보정한다.

**Architecture:** Overlay는 고정 헤더·진도 막대·스크롤 내용·고정 탐색을 담당하고 Card는 제목·이미지·설명을 담당한다. 기존 가이드 상태 훅은 유지한다.

**Tech Stack:** React Native, Expo Image, AppText, Feather, 기존 Body Frame 토큰.

**Spec:** ../specs/2026-11-09-guide-popup-v2-design.md

## 시안 생성 후 분석

- 선택 시안: `docs/design/guide-popup-v2-20261109/design-reference.png`, 1122×1402(4:5). 앞선 긴 초안은 design-draft.png로 보존하고 채택하지 않는다.
- 기준 폭375dp로 환산하면 약469dp 높이. 좌우 여백약20dp, 헤더44dp, 현재 단계와 X, 가는 진도6개, 제목24sp, 넓은 촬영 조작 이미지, 본문2줄, 전체폭48dp CTA이다.
- 이미지 프레임은 시안에서 약2:1이다. 생성한 원본 안내 이미지는1672×941(16:9)이므로 표시할 때 검은 위아래 여백만 cover로 잘라 조작부의 비율을 보존한다. 다른 안내 이미지는 기존3:2 contain을 유지한다.
- 시안의 미세 질감·안티앨리어싱은 네이티브 UI에 복제하지 않는다. 단색 토큰과 사용자 선택 글꼴을 유지하며 남는 차이로 보고한다.
- 제목·진도·본문·버튼은 네이티브 UI, 촬영 예시만 PNG이다. 시안 전체를 화면에 붙이지 않는다.

## Global Constraints

- Android만 변경. 가이드 버전4·seenIntro·첫방문/설정 재보기 정책과 기존 사용자 변경을 보존한다.
- 첫 실행의 전체화면·시작하기/나중에보기와 기존 사진/카메라/영상/서버·저장 동작은 유지한다.
- 커밋·푸시·배포 없음. 44dp 닫기, 48dp 주요 CTA. 큰 글씨에서 본문을 자르지 않는다.

## 작업과 담당 파일

- [x] 1. 메인: constants/app-guide-artwork.ts에 새 촬영 이미지 연결. app-guide-card.tsx에서 첫 이미지 cover, 제목700/32행간·본문22행간·전체폭 다음과 이전 버튼 구현.
- [x] 2. 메인: app-guide-overlay.tsx에 고정 닫기·진도 막대 구현. ScrollView를 step.id로 구분해 새 단계가 맨 위에서 시작하도록 한다. constants/app-guide-steps.ts의 첫 제목/설명을 시안과 일치시킨다.
- [x] 3. QA 담당: 이전 첫 제목을 쓰는 기존 테스트4개·캡처 Python2개를 보정한다. C6 검사는 상단 닫기와 고정 푸터의 위치·콜백을 검증한다. 앱 조작·저장소 시딩은 하지 않는다.
- [x] 4. 메인: 타입·린트·관련 공식 회귀 실행, Pixel_9 실제 캡처. 비교용으로만 팝업을 잘라 시안과 같은 픽셀 크기에 맞춰 나란히 대조하고 차이 표를 작성한다.
- [x] 5. 메인: 주요 차이를 수정한 뒤 재캡처·재비교. 360dp/150%에서도 조작 확인, 기기 설정 복원. 독립 코드 리뷰 후 최종 결과를 기록한다.

## Review Focus

- 첫 방문 전용 화면이 설정 재보기 시안으로 바뀌지 않을 것.
- X/Android 뒤로/완료가 같은 기존 종료 처리를 사용할 것.
- 4단계 긴 설명을 읽고 이동해도 새 단계 제목이 위에서 보일 것.
- 확대 글씨에서 헤더·이전/다음이 본문과 겹치지 않을 것.
- 비교용 crop·정렬은 QA 산출물에만 사용하고 앱용 생성 PNG 원본을 편집하지 않을 것.

## 최종 확인

시안/첫 구현/차이 보정 후 재캡처와 비교를 완료했다. 외곽 높이는 동일 폭986px에서 시안1232px·실제1231px이다. 첫 이미지 표시 비율은 비교 후1.95로, 진도는4dp로 보정했다. 글자·질감·삽입 이미지의 남는 차이와 검증 범위는 `docs/design/guide-popup-v2-20261109/comparison.md`에 기록했다. 사용자 데이터·커밋·푸시·배포 변경 없음.

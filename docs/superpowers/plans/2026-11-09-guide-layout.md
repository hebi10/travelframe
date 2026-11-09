# 사용 가이드 레이아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the small presentation change. Preserve all prior uncommitted work.

**Goal:** 중복 안내를 줄이고 실제 화면 이미지와 설명을 읽으면서 탐색 버튼에 항상 접근할 수 있게 한다.

**Architecture:** AppGuideCard는 안내 내용, 같은 파일의 AppGuideNavigation은 탐색 버튼을 담당한다. Overlay가 고정 헤더·스크롤 내용·고정 푸터를 배치한다.

**Tech Stack:** React Native / Expo / TypeScript, 기존 AppText·expo-image·테마 토큰.

**Spec:** ../specs/2026-11-09-guide-layout-design.md

## Global Constraints

- Android만 변경. 저장·카메라·플랜·서버·첫 방문 판정과 APP_GUIDE_VERSION=4 보존.
- 커밋·푸시·배포 금지. 같은 D:/dev_app/travelframe 개발 폴더에서 Fast Refresh 확인.

## Review Focus

- 첫 방문 전체 화면과 설정 재보기가 구분되는지 확인한다.
- 360dp·150%에서 스크롤과 세 탐색 버튼이 겹치지 않는지 확인한다.
- 이미지 전환 시 이전 단계의 이미지가 남지 않는지 확인한다.

## 작업

- [x] 1. Card의 내용/탐색을 나누고 Overlay의 중복 헤더를 단일 가이드 헤더로 교체한다.
- [x] 2. 환영 문구·기존 QA 선택자·푸터 위치 회귀 검사를 현재 흐름에 맞춘다. QA 담당만 테스트/캡처 스크립트를 수정한다.
- [x] 3. 타입·린트·관련 회귀와 실제 에뮬레이터 화면을 확인하고 독립 리뷰를 반영한다. 수정한 UI는 캡처로 남긴다.

커밋 단계는 사용자의 명시적 금지에 따라 생략한다.

## 확인 결과

- 타입 검사·린트·가이드/Stage6/StageC/C6/공통 접근성 관련 공식 회귀 통과. QA Python 두 파일 문법 검사 통과.
- Pixel_9에서 가이드 1~6단계 이동과 스크롤 바깥의 탐색 영역 확인. 360dp·시스템 글자 150%에서도 닫기·이전·다음에 접근 가능함을 확인.
- 독립 리뷰에서 발견한 닫기 터치 폭을 최소44dp로 보완. 긴 단계 제목은 짧게 정리.
- 최종 기본 화면: `D:/dev_app/.setup/guide-captures/guide-redesign-final.png`. 큰 글씨 검증: 같은 폴더의 `guide-redesign-360-150.png`, `guide-redesign-360-150-metrics.png`(제목 최종 축약 전 캡처).
- 기기 배율을 원래 density420/시스템 글자1.0으로 복원. 저장소 시딩·사진/영상 생성·삭제·커밋·푸시·배포 없음.
- 마무리 시 `git fetch origin` 및 `git pull --ff-only origin main`: Already up to date, HEAD=origin/main=4ca8b4a. 기존 미커밋 변경 보존.

# TravelFrame Stage 6 — 이미지·아이콘·전체 시각 QA

2026-11-05 · 선행: Stage 5 PR #88 HEAD `185d6af`. 본 단계는 Stage 5 브랜치 기반 스택형 PR이며 `main`을 변경하지 않음.

## 검토한 디자인 기준 및 자산

- Google Drive 화면 기획: [피트니스 앱 디자인 가이드](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view).
- 공통 토큰: [앱 디자인 시스템](https://drive.google.com/file/d/124i6p8cCW1vxM_2N2H321fw4L9QZsNqK/view), [다크 UI 가이드](https://drive.google.com/file/d/19Kh11wAzwNoc-Cfpjjhbtqezk1S7bqfG/view).
- 원본 [UI 에셋 ZIP](https://drive.google.com/file/d/1Dj_7bSnoY_7WMz3aLNSuNmMEuICZMybb/view): PNG 142개(아이콘 44종 × 3색 = 132, 일러스트 9, 브랜드 마크 시안 1). 별도 README/manifest/출처 포함.
- 기존 앱 자산: 일러스트 8개 보유, 네비게이션/상세 아이콘은 Feather 단일 계열 사용. 승인된 런처 아이콘 유지.
- 새 에셋: 원본 패키지에서 백업 안내 `feature-backup.png`를 분리해 474×300 투명 팔레트 PNG로 최적화하여 추가. 계정 백업 온보딩에 정확히 매핑하며 기존 촬영 안내 이미지와 구분.
- 라이선스: Font Awesome Free 기초 아이콘은 CC BY 4.0 표기를 assets/ui/README에 유지. 사용자 사진·건강기록·영상 원본을 에셋으로 사용하지 않음.

## UI 코드 변경

- 앱 가이드의 백업 안내에 적절한 백업 일러스트 사용. 제목·보조 버튼·라벨을 공통 BodyFrameTypography 토큰으로 통일.
- 사진·영상·프로젝트·수치 상세의 '뒤로' Feather를 공통 20dp 아이콘 토큰으로 통일. 기존 44dp 터치영역 및 기능 유지.
- CSS/React Native UI 그림자·그라데이션·단방향 테두리 등 장식성 변화 없음.
- 기존 사용자 데이터, 사진, 백업, 구독, Health Connect, 영상 렌더링 및 Play 서명/배포 코드 미변경.

## 자동화된 실제 Android 캡처

새 Stage 6 visual QA는 기존 빌드한 x86_64 native QA APK를 사용하여 *로그인하지 않은 일회용 오프라인 에뮬레이터*에서 다음 변형을 캡처함.

| 해상도 | 설정 |
| --- | --- |
| 360dp | 720×1600px, 320dpi |
| 412dp | 824×1832px, 320dpi |
| 600dp | 900×1600px, 240dpi |
| 750dp | 1125×1800px, 240dpi |

각 해상도마다 다크/100%·라이트/130%·다크/150%에서 촬영/기록/프로젝트/전후비교/수치/영상홈/제작/보관함/설정/계정/프로젝트 설정/영상 사진선택 12개 화면을 캡처. 추가로 150% 온보딩 및 100% 빈 프로젝트를 확인(총 152건).

검사 결과는 `body-frame-stage6-visual-qa-<run_id>` 아티팩트에 `capture-manifest.json`, PNG, Android 접근성 계층(XML), 스크린샷 크기/해시 및 `stage6-visual-report.md`로 보관. `scripts/check-stage6-visual-artifacts.py`는 크기·개수·실제 PNG/Android 계층·foreground 근거를 검증하며 실패와 누락을 명시. **실제 디자인 가이드와 픽셀 단위로 일치한다고 주장하거나 실기기·실결제·백업 검사를 대체하지 않음.**

## 이전 Android 검증 참고 (Stage 4 코드 기준)

이전에 확보한 2026-11-05 실행 [#41992107550](https://github.com/hebi10/travelframe/actions/runs/41992107550)은 가상 프로젝트 이미지로 78개 대상 중 74개를 실제 캡처했고 4개 영상 간격/백그라운드 연관 시나리오가 실패. **Stage 6 PASS 근거로 전용하지 않음.** 이 결과에서 온보딩 및 긴 텍스트가 작은 화면에서 주요 버튼과 분리되어 보임은 직접 확인했으나 화면별 디자인 가이드 최종 동등성은 여전히 별도 검수 필요.

## 남은 검증 및 릴리스 제한

- Stage 6 신규 아티팩트 출력 확인 후 화면별 실제 PASS/FAIL 및 시각 차이 비교; 모든 뷰의 완전한 수동 pixel QA는 별도 검토 대상.
- 100/130/150% 폰트, 네이티브 키보드, 44dp 터치, TalkBack 음성 순서, 밝음/다크, 모달 오류·권한 거절·한도 상태를 실제 기기에서 최종 점검.
- 로그인한 계정의 기존 영상 재편집 전후 프레임·음악·길이 및 Play 구매·복원/백업 결과는 에뮬레이터 synthetic fixture 범위 밖.
- Stage 1~5 PR 순차 통합, 업로드키 일치 확인 후에만 `main` 병합. 자동 내부 테스트 파이프라인은 키 문제로 신뢰할 수 없으므로 현재 Google Play 업로드 금지.

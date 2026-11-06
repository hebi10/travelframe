# TravelFrame Stage 13 — 전체 Android 캡처·잔여 시각 보정

기준: 2026-11-06 · \`main@a19c1af8cd23fdd4c530b48b7b5f43b8334fe5ce\`

## 원본 시안 및 기존 캡처

- [화면별 원본 디자인 PNG](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view)
- [다크 디자인 시스템 PNG](https://drive.google.com/file/d/19Kh11wAzwNoc-Cfpjjhbtqezk1S7bqfG/view)
- [디자인 기준 Google Drive 폴더](https://drive.google.com/drive/u/0/folders/1Rtycj9BTjaIAwC65UcazVUxZJaGnSIXu)
- [기존 Android 성공 스냅샷 80개 · Stage 10~12 이전 베이스라인](https://drive.google.com/file/d/1Tuw8PKXONbnaltEZ4sYzcSaRebbV3cy5/view)
  - 기준 성공 run: [42152791027](https://github.com/hebi10/travelframe/actions/runs/42152791027)
  - 이 스냅샷은 **현재 Stage 13 앱 결과가 아닌 이전 버전**이다. 합성 카드 1/2/3은 실제 인물 사진의 크롭·합성 품질을 대표하지 않는다.

## Stage 13 코드 변경

1. \`app/capture-preview.tsx\`: 촬영 직후 **사진 사용** Primary CTA를 라임 \`#C6FF4D\`에서 디자인 토큰의 흰색 Primary / 어두운 반전 글자로 변경. 저장·다시 촬영·로딩·Safe Area 동작은 유지.
2. \`scripts/capture-stage13-android.py\`: 실제 Android 에뮬레이터 스크린샷을 매 화면 PNG와 UI 구조 XML, 텍스트·버튼 탐색 결과 JSON으로 저장. CSV 인덱스와 로컬에서 열 수 있는 \`gallery.html\`을 생성한다.
3. \`.github/workflows/body-frame-device-qa.yml\`: 기존 독립 QA APK 빌드 결과를 재사용하여 **4개 화면 폭 별 병렬 스냅샷**. 모바일 360/412dp, 태블릿·폴더블 크기 600/750dp.
4. \`scripts/test_capture_stage13_qa.py\` 및 \`tests/body-frame-design-stage13.test.mjs\`: 캡처 화면 인벤토리, 실패 기록·이미지 보존, 4개 화면 폭, 실사용자 기기 금지, CTA 토큰 회귀 검증.

### 캡처 범위와 상태

- 다크 100%: 촬영, 기록, 프로젝트 상세 기록·수치·통계, 프로젝트 설정/알림, 사진 상세·편집 로그인 안내, 전후 비교, 수치 기록·입력, 영상 홈/생성·사진·간격·화질·비율·문구 옵션, 영상 보관함, 설정·시트, 계정, 레거시 스튜디오/고급 설정, 촬영 미리보기.
- 추가: 새 프로젝트 생성 시트, 프로젝트 0개 빈 상태, 온보딩 첫 화면·다음 화면.
- 라이트 130%: 핵심 15개 화면. 다크 150%: 레이아웃·글자 확대에 민감한 핵심 12개 화면.
- 총 **예정 캡처 케이스 58장/화면 폭 × 4 = 232장**. 실제 수집 수·PASS/FAIL은 각 아티팩트의 \`capture-manifest.json\`으로만 확정한다.
- CI 스크린샷은 녹화된 mp4 렌더와 실제 인물 사진을 검증하지 않는다. 영상 상세·내보내기 성공/실패 상태는 기존 Native smoke 또는 실기기 QA 결과로 별도 보존한다.
- 기기는 에뮬레이터만 허용하며 오프라인 합성 guest 데이터만 사용한다. 실제 계정, 개인 사진, Play 결제, Health Connect, 클라우드 백업, 광고 계정과 무관.

### 캡처 무결성 판정

- \`gallery.html\`: 해당 화면 폭의 화면별 실제 PNG와 캡처 실패 스크린샷 표시.
- \`screen-index.csv\`: 화면별 파일명, 라우트, 상태, 해상도, 오류 메시지.
- \`capture-manifest.json\`: APK SHA256, CI 체크아웃 SHA, 화면 폭/배율, 실제 PASS/FAIL 수, 시스템 오류.
- \`logcat.txt\`와 UI XML: 원본과 불일치한 페이지의 원인 추적.
- 기기 프레임워크나 Pixel Launcher 오류는 앱 디자인 오류와 혼동하지 않는다. 실패 케이스는 정상 캡처로 분류하지 않는다.

## 원본 시안 대비 다음에 검토할 항목

| 화면 | 원본 기준 | 코드 적용 또는 검증 상태 |
| --- | --- | --- |
| 온보딩 | 인물 사진 중심의 시작 화면과 흰 CTA | 공통 버튼 토큰 적용 완료, 실사진·레이아웃 육안 대조 미완료 |
| 프로젝트 목록 | 사진 중심의 컴팩트 카드/진행률 | Stage 10 적용, 0개/1개 외 다수 프로젝트 실제 QA 추가 필요 |
| 프로젝트 상세 | 기록/수치/통계 탭, 사진 비교 우선 | Stage 10 적용, 장문·폴더블·글자 확대 육안 비교 필요 |
| 촬영 | 사진 전체 노출, 오버레이·셔터·설정 | 실제 실사진/카메라 권한 수동 확인 필요 |
| 전후 비교 | 중앙 핸들, 25·50·75% | Stage 12 헤더·이미지 정렬 보정, 촬영 각도 일치 확인 필요 |
| 수치 기록 | 차트·기간 필터·값·기록 목록 | 코드 적용, 차트 숫자/레이블 잘림·모달 확인 필요 |
| 영상 홈 | 일러스트/목록/CTA | Stage 11 보정, 실제 영상 썸네일 비교 필요 |
| 영상 만들기 | 큰 사진 미리보기와 옵션 정보 | Stage 11 보정, 4크기 화면 옵션 높이/레이아웃 점검 |
| 새 프로젝트 | 이름/목표/사진 선택 | 모달 시각 밀도와 키보드 대응 재확인 필요 |
| 설정/계정 | 6개 그룹, 일관된 기능 아이콘 | Stage 11 보정, TalkBack·130/150%·모달 확인 |
| 촬영 미리보기 | 검정·회색 바탕, 흰 Primary CTA | **Stage 13 수정**, 신규 APK에서 실제 색상 캡처 검증 필요 |

모든 페이지를 코드만으로 ‘시안 일치’로 표시하지 않는다. 실제 Android PNG 수집 → 인물 사진·색·위계·폭·잘림 확인 → FAIL 화면별 후속 PR 순으로 운영한다.

## 배포 및 데이터 안전

- 저장된 사진의 \`photoId\`, sequence, 영상 결과·드래프트, Firebase 데이터, 구독/결제·백업, Health Connect, AdMob, Google Play AAB·서명·업로드 변수는 변경하지 않는다.
- 원본 앱의 디바이스 검사 도구는 유지. Stage 13 잡은 에뮬레이터 크기별 별도 시각 캡처임.
- 2026-11-07 11:01 KST 이전 Play AAB 업로드 금지. 이후에도 업로드 키 인증서/Play Console 동일성 및 명시 승인 확인이 선행되어야 함.

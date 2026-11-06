# TravelFrame · Stage 14 원본 시안 대비 Android 화면 밀도·배치 정밀 보정

기준: 2026-11-06 KST · main@138cc67c692a79af437605d566a2c4db9b4143d5

## 검토 자료

- [사용자 Google Drive 원본 화면별 디자인 가이드](https://drive.google.com/file/d/1M2GNjJdO_O6JiNzeA8UcD9-RPaVlJACX/view)
- [원본 다크 UI 디자인 가이드](https://drive.google.com/file/d/19Kh11wAzwNoc-Cfpjjhbtqezk1S7bqfG/view)
- [Stage 13 최신 Android 화면별 캡처 232장·HTML 갤러리](https://drive.google.com/file/d/1X5Y9gZGh1K4W4-q1zKTuCYOGF0asKYvi/view)
- [4개 화면 폭별 원본 ZIP 및 12개 변형의 전체 화면 썸네일](https://drive.google.com/drive/folders/1hmEyzXMYmoweR0zaWOIYhFJAFC9ljU_R)
- [기존 디자인 QA 이슈 #73](https://github.com/hebi10/travelframe/issues/73)

시안의 인체 사진과 Android CI의 합성 숫자 카드 1·2·3은 콘텐츠가 다릅니다. 콘텐츠 차이만으로 UI FAIL을 판정하지 않습니다. 기존 13단계의 232개 캡처는 모두 정상 PNG였지만 가이드와의 픽셀 동등성·실사진·TalkBack 품질은 별도 검증입니다.

## 화면별 10개 시안 평가

| 화면 | Stage 13 실제 화면에서 확인된 차이 | Stage 14 적용/후속 |
| --- | --- | --- |
| 온보딩 | 현재 사용 가이드 오버레이로 시안의 독립 첫 실행 화면과 형태가 다름 | 14단계는 기존 안내·첫 실행 라우트 보존. 전체 화면 재설계는 기능/내비게이션 변경 우려로 별도 정책 결정 |
| 기록/프로젝트 목록 | 제목과 카드 사이에 사용하지 않는 높이, 1개 합성 프로젝트만 존재 | 제목 아래·프로젝트 헤더 여백 축소, 카드 정보 간격/패딩 정리. 다수 프로젝트 시각 QA 별도 |
| 프로젝트 상세 | 비교 사진이 세로 공간을 크게 차지. 750dp에서는 넓은 가로 이미지 영역과 사진의 세로 구도가 어색함 | 기록·수치·통계 3탭 보존; 첫/최근 사진 카드를 최대 560dp로 중앙 정렬, 사진 높이 190→172dp, 카드/진행률 간격 축소 |
| 촬영 | 합성 숫자 이미지와 실제 실사진 배경이 다름 | 기존 안전영역·셔터·기준 사진·가이드/투명도/카메라 루틴 유지, 실제 촬영 비교는 실기기 QA |
| 전후 비교 | Stage 12 중앙 제목·50% 핸들·3개 프리셋 이미 반영 | 사진 원본 fit과 확대/증감 조작 유지. 실사진 자세 정렬은 별도 QA |
| 수치 기록 | 필터 두 행과 프로젝트 헤더가 차트 위에 높은 공간 차지 | 상단/프로젝트/메트릭·기간 필터 간격 축소, 44dp 버튼과 차트·기록 데이터 보존 |
| 영상 홈 | 설명, 히어로, 로그인 한도 공지 후 저장 영상 영역이 첫 화면 아래 | 히어로 삽화 76×88→72×72, 섹션 간격 18→12dp, 카드/행 밀도 개선. 정책 공지·영상 관리 버튼 유지 |
| 영상 만들기 | 360dp에서 대형 이미지와 여러 안내가 첫 설정 항목을 아래로 밀어냄 | 미리보기 최대 화면 높이 계수 39→35%, 사진 중심 82% 가로·360dp 제한 유지. 출력 렌더러·캔버스·앨범 저장 불변 |
| 새 프로젝트 | 기준 사진 선택/목표 기록 수/키보드 모달의 높이와 여백이 큼 | 제목과 필드/기준 사진 선택 간격 축소, 기존 44dp 터치·목표 수/권한/생성 제한 보존 |
| 설정 | 설명 2줄·섹션 간격으로 주요 설정이 적게 보임 | 설명은 화면상 한 줄 표시, TalkBack accessibilityHint에 전체 설명 유지; 그룹 간격 16→12dp, 6개 섹션과 모든 값 보존 |

## 코드 범위

- features/records/BodyFrameRecordsScreen.tsx
- features/records/BodyFrameProjectDetailScreen.tsx
- features/records/BodyMeasurementHistoryScreen.tsx
- features/trip-clip/BodyFrameVideoHomeScreen.tsx
- features/trip-clip/BodyFrameVideoScreen.tsx
- features/settings/BodyFrameSettingsScreen.tsx
- features/camera/BodyFrameProjectSwitcher.tsx
- tests/body-frame-design-stage14.test.mjs
- .github/workflows/body-frame-device-qa.yml — Stage 14 브랜치 Android 실제 캡처 매트릭스 연결

**변경하지 않음:** 사진 photoId/sequence, 실제 신체 사진·촬영 엔진, 영상 렌더링/오디오·동영상 출력, 수치/프로젝트/계정 상태·Firestore, Google Play Billing/서명키·버전/배포 동작, Firebase 백업/복구, Health Connect, 유료 정책, 네이티브 앱 권한.

## 검증 및 병합 게이트

1. TypeScript, ESLint, 전체 Node 회귀 테스트, Firebase Rules/Functions, Android Manifest/Kotlin, Secret Scan 성공.
2. Android QA에서 네 가지 크기 (360/412/600/750dp) × 3 테마/글꼴 변형, 페이지별 58 시나리오의 실제 픽셀 판독 결과 확인. PNG, UI XML, 개별 JSON, CSV와 `gallery.html` 포함. 기존 run의 자료를 재표기하지 말 것.
3. 변경 전 13단계·변경 후 14단계의 **동일 화면명/프로필/테마**를 나란히 비교. 확인하지 않은 실제 스크린샷을 임의 생성·보정하지 않음.
4. 실제 360dp에서 큰 글꼴/시트 푸터/영상 첫 화면 CTA 겹침이 없는지, 600/750dp에서 프로젝트 사진이 적절히 중앙 정렬되는지 확인.
5. 최종 정적·실기기 검증과 병합/Play 게시 상태는 분리 기록. 실사진·TalkBack·최종 디자인 등가성은 단순 CI 성공으로 판정하지 않음.

## Stage 14 산출물

새로 만든 PR의 코드·시각 확인표 및 Android QA run별 진짜 PNG ZIP을 Google Drive에 저장. 기존 Stage 13 변경 전 갤러리는 비교 기준으로 변경하지 않음.

업로드 제한: 2026-11-07 11:01 KST 이후 새 업로드 키 유효. 시각 보정 PR은 Play 서명 승인·AAB 업로드를 실행하지 않는다. 권한·토큰·키를 기록하지 않는다.

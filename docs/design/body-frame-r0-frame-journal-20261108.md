# TravelFrame R0 — Frame Journal 디자인 기준

> 2026-11-08 KST · 기준 `main@83f575b19edb64fbafcfd43cde6e3cf8a1b4596e`  
> 상태: **R0 디자인 원칙·화면 범위 확정 / 앱 소스 미변경 / 미배포**

## 1. 콘셉트 및 절대 보존 항목

**Frame Journal — 같은 프레임에 기록하는 시간의 변화.**

사진·촬영 프레임·기록의 연속성이 먼저 보이는 사진 중심 기록 앱. 브랜드 색을 UI 전체에 뿌리지 않고 무채색 바탕·선·타이포그래피·공간으로 정보의 위계를 표현한다. 액션·정보 구조의 확장은 이 단계의 범위가 아니다.

- 앱 표시명 **바디 프레임**, 현재 Android 패키지, Expo/React Native 구조 유지. 내부 명칭 `Frame Journal`은 스토어/앱 이름 변경이 아니다.
- 하단 탭은 **촬영 / 기록 / 영상 / 설정 4개 고정**. 생성형 시안에 가끔 나타나는 `홈` 탭·독립 대시보드는 개발 대상이 아니다.
- 사진 ID·순서·first/latest 기준·영상(3:4 기본 출력/MP4·음악·재편집)·Health Connect·Google Play 결제/환불·Firebase 백업·AdMob·권한 요청 기능 불변.
- 기존 유료 플랜 제한 및 `100 / Pro 365` 등 실제 앱 소스 기준 우선. 시안의 임의 플랜·사진 수·체중·날짜는 제품 정책/고정 문구가 아니다.
- 앱 런처 아이콘·스토어 대표 이미지 변경과 새 Play 트랙/Firebase 배포는 R0 범위가 아니다.

## 2. 컬러 토큰 (R1 구현 기준)

| 역할 | Light | Dark | 사용 |
| --- | --- | --- | --- |
| `background` | `#F7F8FA` | `#0B0B0C` | 화면 |
| `chrome` | `#F7F8FA` | `#0B0B0C` | 헤더·탭바 |
| `surface` | `#FFFFFF` | `#1A1A1D` | 카드·모달 |
| `panel` | `#ECEEF1` | `#292D31` | 보조 영역 |
| `text` | `#181A1D` | `#F5F5F5` | 제목·본문 |
| `muted` | `#5D6269` | `#A0A0A6` | 보조·메타 |
| `line` | `#DDE1E5` | `#323437` | 구획 |
| `outlineStrong` | `#3D454E` | `#D5D9DE` | 중요한 제어 테두리·초점 |
| `primary` | `#23262B` | `#F5F5F5` | CTA |
| `onPrimary` | `#FFFFFF` | `#111111` | CTA 글자 |
| `brandAccent` | `#C6FF4D` | `#C6FF4D` | **국소적** 촬영 가이드·변화 포인트 |

현행 `constants/app-theme.ts`의 `bodyFrameAccent`는 보존한다. 일반 주요 CTA는 라이트 차콜/다크 화이트로 통일. `success`가 자동으로 `brandAccent`를 따르는 현행 토큰은 R1에서 용도별 정리 대상.

대비 계산: 기본 텍스트/배경 Light **16.41:1**, 보조/배경 **5.78:1**; Dark 기본/배경 **18.05:1**, 보조/배경 **7.56:1**. 하지만 `#C6FF4D`와 화이트는 **1.18:1**로 필수 UI 표시 용도로 부족. 흰 화면 위 라임만으로 글자·작은 아이콘·선택 상태를 표현하지 않는다. 의미 있는 테두리·텍스트·형태를 병행한다. 이미지 위 촬영 가이드는 배경 대비 별도 검사.

## 3. 레이아웃·타이포·아이콘

- 현재 `bodyFrameDesign`의 화면 좌우 16dp, 콘텐츠 최대 750dp, 섹션 28dp, 기본 터치 영역 44×44dp, 주요 CTA 높이 48dp, 카드/버튼 8dp 및 시트 12dp 반경 유지.
- 글자: 기존 사용자 글꼴 설정 및 Noto Sans KR 보존. 페이지/프로젝트/섹션/수치/본문/캡션 6단 위계. 기기 글씨 100/130/150% 검증 전 사용자 설정·줄 간격 강제 변경 금지.
- 기능 아이콘은 기본 Feather 20~24dp, 유사한 획 두께와 공간. `tab-glyph.tsx`는 `camera / image / youtube / settings`; R2에서 `youtube` 서비스 로고 연상 대신 기능 `film / play-circle` 대체 검토.
- 프레임 모티프는 촬영 모서리, 비교 중앙 핸들, 사진 경계 등 **실제 의미가 있는 위치**에 제한. 카드마다 고양이·마법·AI 장식/아이콘 삽입 금지.
- 무의미한 shadow/gradient/animation 금지. 필요한 테두리는 사방 1dp 기반, 기존 Touch·Safe Area·keyboard avoidance 우선.

## 4. 핵심 화면 10종 매핑

| ID | 화면 | 핵심 디자인 | 주요 소스 |
| --- | --- | --- | --- |
| S01 | 온보딩·첫 실행 | 사진 중심 안내, 스킵/진도 유지 | `constants/app-guide-steps.ts`, `hooks/use-app-guide.ts` |
| S02 | 촬영 | 카메라 프리뷰 최대화, 프로젝트·가이드·셔터 정렬 | `features/camera/BodyFrameCameraScreen.tsx` |
| S03 | 기록 목록 | 사진·날짜·장수·진행률 우선, 0/1/다수 | `features/records/BodyFrameRecordsScreen.tsx` |
| S04 | 프로젝트 상세 | 첫/최근 사진·기록/수치/통계, 불필요한 스크롤 축소 | `features/records/BodyFrameProjectDetailScreen.tsx` |
| S05 | 전후 비교 | 사진과 분할선 중심, 25/50/75%·드래그 유지 | `features/records/BodyFrameCompareScreen.tsx` |
| S06 | 수치 기록 | 차트·기간·변화량·기록 목록, 단위 가독성 | `features/records/BodyMeasurementHistoryScreen.tsx` |
| S07 | 영상 홈 | 영상 만들기 CTA·저장 영상 목록 발견성 | `features/trip-clip/BodyFrameVideoHomeScreen.tsx` |
| S08 | 영상 만들기 | 3:4 미리보기 높이와 옵션/하단 CTA 균형 | `features/trip-clip/BodyFrameVideoScreen.tsx` |
| S09 | 새 프로젝트 | 이름·목표·기준사진(first/latest)·생성 순서 명료화 | `features/camera/BodyFrameProjectSwitcher.tsx` |
| S10 | 설정·계정 | 그룹형 설정 행·현재값·권한/결제/백업 상태 가독성 | `features/settings/BodyFrameSettingsScreen.tsx` |

영상 보관함/상세, 사진 상세·편집, 카메라 미리보기, 시트/모달, 프로젝트 설정, 알림, 수치 입력·편집, 빈 상태, 경고/오류·권한 거절도 동일 디자인 토큰을 적용할 보조 화면으로 등록한다. 새 기능/데이터 모델은 추가하지 않는다.

## 5. 소스/시안 증빙 및 채택 기준

### 실제 Android QA 기준 (구버전)

- [Stage14 Light 130% 8화면](https://drive.google.com/file/d/1ykKW3OIdRkLzo8pH1HIzo5lc4DHkjTzv/view) — 과거 커밋의 실제 Android 캡처.
- [Stage17 Dark 10화면](https://drive.google.com/file/d/1FpekAy5HDRDftBSNFh7EeaDhfQv3T5rK/view) — 과거 커밋에서 합성 숫자 카드로 실행한 테스트 캡처, 실제 인물 사진 아님.
- 두 자료 모두 `83f575b`의 최신 UI를 다시 찍은 것이 아니므로 새 R단계 변경 전 정확한 픽셀 기준은 **R1 착수 시 동일 HEAD로 캡처**한다.

### 생성형 콘셉트 이미지 (실제 UI 아님)

- [Light 7화면](https://drive.google.com/file/d/1XoxbuZ1VeaG2adlylt-YyFzFGX9SzlvW/view)
- [Dark 7화면](https://drive.google.com/file/d/1leZw_0vhDudh4lhu9K0VZTeEsnOamlTU/view)
- [디자인 시스템/혼합 모드 참고](https://drive.google.com/file/d/1l9odHF3RW1AnRNjXkTbTz0vddWIxpG0H/view)
- [브랜드 탐색 참고](https://drive.google.com/file/d/1jRQ5292Z5Jkz1zZ0qmCREQHvIY1a_Lde/view)

**중요:** 이미지 속 `홈` 5번째 탭, 커다란 라임 기본 버튼, 임의 구독·사진 장수·날짜·체중·제어·계정 상태는 **비채택**. R1–R4 개발자는 반드시 이 문서와 실제 TSX/서비스 정책을 소스 진실로 사용한다. 생성 이미지의 완성도는 네이티브 사용성·실기기 테스트를 대체하지 않는다. S01/S08/S09의 전용 Light/Dark 1:1 세부 시안은 구현 단계의 Android 캡처를 근거로 후속 확장한다.

## 6. R1–R5 작업 순서

1. **R1 — 디자인 토큰/공통 컴포넌트.** `constants/app-theme.ts`, `lib/app-appearance.ts*`, `components/{screen-shell,app-text,section-block,body-frame-sheet}.tsx`의 일관된 팔레트/버튼/카드/글꼴 적용. 기능 로직 불변.
2. **R2 — 4탭/기능 아이콘·브랜드 일러스트.** `tab-glyph.tsx`, `assets/ui/illustrations`, 기능별 Feather 아이콘 사용처를 인벤토리화하고 통일. Launcher/Store는 별도.
3. **R3 — 촬영·기록·프로젝트·비교·수치.** 사진 비율·기본 기능·선택·삭제·Health Connect·프로젝트 데이터 보존.
4. **R4 — 영상·설정·온보딩·모달.** 3:4 기본 영상 비율·MP4 생성·계정/백업/결제·가이드 정책 보존.
5. **R5 — 최종 통합 QA.** 동일 최종 HEAD에서 Quality, Secret Scan, Android Kotlin/Manifest, Android Native QA 및 **360/412/600/750dp × Light/Dark × 글자 100/130/150%** 24 프로필 기준. 모든 화면을 무조건 24장씩 캡처한다고 확정하지 않고 시나리오마다 실제 캡처 개수/통과율을 증빙한다.

R1–R4는 브랜치/PR별 검증 후 병합. 새 Play 버전(내부·비공개), Firebase 운영 배포와 별도. PR #128 Admin14/Functions7 스테이징/보안 미완료 상태는 R0로 해결된 것으로 표시하지 않는다.

## 7. R0 완료 판정

- [x] 테마·브랜드·아이콘·컴포넌트 개발 기준 정의
- [x] 핵심 화면 10종과 보조 상태 화면 범위 확정
- [x] 생성형 Light/Dark R0 시안 및 이전 Android 캡처를 **서로 다른 출처**로 구분해 Drive 보관
- [x] 모델 이미지의 기능 환각·대비 위험 및 비채택 항목 명시
- [x] R1–R5 대상 파일·검증·제품 정책 비변경 조건 확정
- [ ] R1–R5 구현 및 동일 HEAD 실제 Android 최종 렌더링 — **별도 단계**
- [ ] 실제 ARM64·MP4·TalkBack·Play 테스트·Firebase 서비스 운영 검증 — **별도 게이트**

[Google Drive R0 최종 기준 문서](https://docs.google.com/document/d/1msQm83e0g_YKp7c7LDgs2pX9moSanQc1jgd6wgWUh4M/edit) · [R0 이미지/변경 전 비교 폴더](https://drive.google.com/drive/folders/1npiaItT70Z44SZbj4wfCnrHQYNWWWrub) · [기존 화면별 실제 검토](https://docs.google.com/document/d/1EEPCjSOLidZloCC2v561nW-W-rU0-BjLVXejztWl_Ps/edit)

**결론:** R0는 기술·시각 방향의 설계 기준으로 완료. 이번 단계에서는 앱 소스, 실제 사용자 데이터, Play/Firebase 배포 구성을 변경하지 않는다.

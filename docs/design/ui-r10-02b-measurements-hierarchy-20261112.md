# TravelFrame UI-R10-02B — 수치 기록 요약·그래프 가독성 보정

기준: 2026-11-12 · GitHub main 4a78e8c544d69410f6663634070bbefa8ad38ea3 · Drive v3 기획 디자인/Android 화면 비교

## 원인
기획 v3는 4개 지표·4개 기간 필터 아래 '현재값', '시작 대비 변화량', 그래프, 최근 기록이 명확히 보이는 구조입니다. 실제 PR #153의 최신 화면은 차트 요약 헤더와 4개 수치 카드에 현재/변화량이 중복 표시되어 기록 목록의 진입 위치가 내려가 있습니다.

## 수정
1. 기존 4개 요약 항목('시작','현재','변화','기록')의 데이터 계산은 보존하되, '현재'와 '변화'를 맨 앞에 배치하고 숫자 위계를 24dp까지 높입니다. 값을 건강상 성공/실패 색상으로 표시하지 않습니다.
2. 요약 카드 아래에는 기존 Sparkline의 '차트만' 표시합니다. 화면의 중복된 현재값/변화량 머리말을 생략하여 첫 화면 정보 밀도를 줄입니다. 프로젝트 상세의 공통 차트 카드에는 영향을 주지 않도록 chartOnly 기본값은 false입니다.
3. 실제 Sparkline 데이터 점·선·90° 기준 계산은 유지하면서 차트 영역 왼쪽에 최대·중간·최소 수치 눈금을 추가합니다. 단위는 그래프 문구와 최저·최고 기록에 계속 표시합니다.
4. 시작·최근 날짜, 기간별 원본 필터, 최신순 기록 목록, 사진 연결, 기록 수정/삭제, Health Connect 권한/가져오기 경로는 변경하지 않습니다.

## 중요 기능 보존
- 지표: 몸무게/체지방률/골격근량/허리둘레 × 1/3/6개월/전체 기간 필터.
- 원본 수치 저장/수정/삭제 및 소스, 기록 단위, 측정값 변화 계산, 로컬 저장 안내, Health Connect 동작.
- 프로젝트 상세 화면에서도 사용하는 BodyMeasurementSummaryCard의 기본/비압축 렌더링.
- Play/Firebase/구독·광고·출시 설정 및 개인 데이터에 대한 수정 없음.

## QA 합격 게이트
- 최신 HEAD Quality(Typecheck/Lint/Node 회귀/Firebase Rules·Functions/Android Gradle)·Secret Scan 모두 통과.
- 네이티브 360/412/600/750dp × 라이트/다크 × 100/130/150% 폰트 24환경 PNG/XML/원본 해시와 읽기 순서 확인.
- 0/1/다수 기록, 4×4 지표·기간, 극단값·음수 변화, 날짜 경계(Asia/Seoul), 세로 차트 축/터치 44dp, 360dp 150% 긴 단위 줄바꿈 검증.
- 선행 PR #156/ #160이 아직 미병합이라 충돌/회귀 검증 후에만 병합. Google Play AAB는 모든 기획 작업 완료 후 별도 최종 배포 승인 시 진행.

## 자료
기획 v3: https://drive.google.com/drive/folders/1ElpylZuwTLdPA2VFqnyUO9PxKk8faCcT
v3/실제 Android 비교: https://docs.google.com/document/d/1Mh6-cyEVLhKfHHPP2NxvkeXc7x5Jesu1KiblWk0eeUg/edit

# STORE-03-B — 실제 Android 앱 UI와 QA 전용 데모 사진

- 기준: `main@473a0f5b1a8c4d25788577cdcc9965cba751e972`.
- 목표: 앱 화면은 **실제 에뮬레이터 네이티브 캡처**로만 제작; 앱 화면을 AI 이미지로 대체하지 않음.
- 개인 정보 없는 QA용 가상 인물 이미지 3종(`assets/store-demo/demo-01~03.jpg`)을 사용. 해당 이미지는 이전 AI 콘셉트 이미지의 인물 사진 부분만 추출해 수정한 비실제 사진이며 체형 변화의 진위·광학적 품질을 보장하지 않음.
- 3장 모두 동일 인물·포즈/장소의 미세 밝기 변형. 체중 감량·체형 변화가 실제로 발생했다는 홍보 주장에 사용 금지.
- `BODY_FRAME_STORE_DEMO_FIXTURES=1`가 **QA 전용 캡처 job 안에서만** 설정될 때 `Device.seed`의 앱 내부 테스트 사진과 썸네일로 로딩. 기존 기본 숫자 카드와 MP4 마커 검증은 건드리지 않음.
- 기기 보호: `ro.kernel.qemu=1` 확인 후 새 에뮬레이터 앱 데이터에만 반영, 네트워크 비활성화, 계정·실제 사용자 사진·Firebase·구독·결제·백업 무접근.
- Android phone 412dp / tablet 600dp, dark/light 100%, 대표 화면 9개(촬영, 기준 사진, 기록, 상세, 비교, 수치, 영상 홈, 영상 만들기, 설정), 목표 **36장**. 실제 결과는 Actions artifact의 manifest와 PNG·XML·JSON 검증만 인정.
- 기존 `main` 및 Play 비공개/내부/운영 앱 번들 변경 없음. 검증 완료 후에도 외부 Play 이미지 업로드는 별도 승인·게이트로 진행.
- Drive 데모 사진: https://drive.google.com/drive/folders/16sK2OoHI5hHPJOI0Sf_7NqLWwWf0XbkN

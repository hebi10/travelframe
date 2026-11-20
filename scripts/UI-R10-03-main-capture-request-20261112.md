# UI-R10-03 · main 런타임 화면 캡처 전용

- 기준 main SHA: `4d3de5969b126a5f076e7f9ea0e41f403320da58`
- GitHub Actions: Body Frame native device QA / Stage13 / Android API35 x86_64
- 기기 폭: phone-360dp, phone-412dp, tablet-600dp, tablet-750dp
- 화면 테마: dark/light; 폰트 100/130/150% (24개 환경)
- 실제 화면 + UI hierarchy XML + SHA-256 + 실패 진단을 원본 그대로 보존
- 캡처용 브랜치에서 앱 소스·의존성·서명·Play·Firebase 운영 설정을 수정하지 않음
- PR을 main에 병합하지 않고 검증된 캡처만 Google Drive에 반영
- 참고: 해당 브랜치는 위 main SHA에서 단일 문서만 추가한 것으로 런타임 UI가 동일함.

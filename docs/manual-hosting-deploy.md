# Firebase Hosting 수동 배포

앱 계정·클라우드 데이터·Google Play/AdMob 설정을 건드리지 않고, 현재 `admin/` 웹사이트만 배포하는 **명시적 수동 실행** 절차입니다.

## 배포 전 필수 검증

1. `main` 최신 CI가 성공했는지 확인
2. **이 워크플로는 `app-ads.txt` 한 파일만이 아니라 `admin/` 전체를 게시**하므로 관리자 사이트의 변경 내용도 검토
3. GitHub repository의 `production-hosting` 환경에 승인자 보호 규칙을 설정
4. 환경 시크릿 `FIREBASE_SERVICE_ACCOUNT_TRAVELFRAME`에 Hosting만 배포할 수 있는 최소 권한 서비스 계정 자격증명 연결. 채팅이나 저장소 파일로 값을 전달하지 않음
5. Google Play 개발자 웹사이트/AdMob에서 실제 검증 대상 도메인이 Firebase Hosting 도메인과 일치하는지 확인

## GitHub Actions 실행

`Actions → Manual production Hosting deploy → Run workflow`에서 `main`을 선택하고, 확인 문자열 `DEPLOY_COMPLETE_ADMIN_HOSTING`을 정확히 입력합니다. 확인 문자열 또는 인증이 없으면 배포가 진행되지 않습니다.

배포는 `firebase deploy --only hosting`만 사용합니다. Firestore Rules, Storage Rules, Functions 및 Play Console에는 변경을 가하지 않습니다. 실행 후 공개 개인정보처리방침·계정 삭제 안내·`app-ads.txt`를 HTTP 200, MIME, 본문 기준으로 검사하고 하나라도 불일치하면 워크플로가 실패합니다.

## 추가 확인

AdMob의 실제 앱 소유권 및 판매자 파일 크롤링은 별도 계정 작업입니다. GitHub Actions에서 파일을 확인했다고 AdMob 승인이 자동 완료되는 것은 아닙니다.

이 워크플로 생성/병합만으로 Hosting이 배포되지는 않습니다.

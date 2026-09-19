# Play Console 데이터 보안 입력 참고

바디 프레임은 Firebase 로그인, 클라우드 백업, AdMob 광고를 사용하며, 사용자가 직접 선택한 경우 Android Health Connect의 몸무게 및 체지방률을 읽을 수 있습니다. Play Console의 실제 선택지는 Google 정책과 앱 기능 변경에 따라 달라질 수 있으므로, 제출 전 현재 빌드에 포함된 SDK와 권한을 기준으로 다시 확인합니다.

## 광고 ID

- 광고 ID 사용 여부: 예
- 사용 목적: 광고 또는 마케팅, 분석, 사기 방지/보안
- 사유: Google Mobile Ads SDK가 광고 표시, 광고 성과 측정, 부정 사용 방지를 위해 광고 식별자 또는 기기 식별자를 처리할 수 있습니다.

## 수집 또는 공유될 수 있는 데이터

- 개인 정보: 이메일 주소, 사용자 ID, 표시 이름
- 사진 및 동영상: 사용자가 직접 촬영, 선택, 편집, 백업한 파일
- 오디오 파일: 사용자가 직접 선택해 영상 만들기에 사용하는 음악 파일
- 앱 활동: 앱 상호작용, 구독 상태, 백업 설정, 결제 이벤트 기록
- 앱 정보 및 성능: 진단 정보, 오류 정보
- 기기 또는 기타 ID: 광고 ID, 기기 식별자
- 건강 및 피트니스: 사용자가 Health Connect 연결을 선택하고 권한을 허용한 경우 읽는 몸무게 및 체지방률. 현재 빌드는 최근 30일 값을 사용자 요청 시에만 확인하며 가져온 값은 로컬 수치 기록으로 저장하고 Firebase로 자동 업로드하지 않음

## 데이터 사용 목적

- 앱 기능 제공
- 계정 관리
- 사용자 지원
- 광고 또는 마케팅
- 분석
- 사기 방지, 보안, 규정 준수
- 건강 및 피트니스 기능: 사용자가 자신의 몸무게 및 체지방률을 Body Frame 수치 기록으로 가져와 변화 추이를 확인

## 공개 문구와 맞춰야 할 항목

- 개인정보처리방침 URL: `https://travelframe-4e1fb.web.app/privacy`
- 계정 및 데이터 삭제 안내 URL: `https://travelframe-4e1fb.web.app/privacy/photo-guide-delete-account`
- 앱에 광고 포함 여부: 예
- 카메라 권한 사용 목적: 사용자가 직접 사진을 촬영하고 구도 가이드를 확인하기 위함
- 사진/미디어 접근 목적: 사용자가 선택한 사진, 영상, 음악을 편집, 저장, 백업하기 위함
- Health Connect 사용 여부: 선택 기능 / 사용자 직접 연결 시에만 사용
- Health Connect 읽기 권한: `android.permission.health.READ_WEIGHT`, `android.permission.health.READ_BODY_FAT`
- Health Connect 쓰기 권한: 요청하지 않음
- Health Connect 백그라운드 읽기 / 30일 초과 과거 데이터 권한: 요청하지 않음
- Health Connect 데이터 목적: 몸무게 및 체지방률을 사용자의 로컬 수치 기록으로 가져와 변화 추이를 표시하기 위함
- Health Connect 데이터 서버 전송: 현재 빌드에서 Firebase 및 사진 클라우드 백업으로 자동 업로드하지 않음
- Play Console Health apps / Health Connect 권한 선언은 실제 릴리스 빌드의 권한과 동일하게 제출 전 확인

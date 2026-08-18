# 경익운수 배차 알림

기사님이 당일 배차된 노선과 순번(차번호)을 선택하면, 출발 시간을 미리 알려주는 알림 앱입니다.
공동배차 노선(202/2002번, 704번, 318번, 708번)은 경익 담당 편만 표시됩니다.

## GitHub Pages로 배포하기 (기사님들이 폰에 앱처럼 설치할 수 있게 하는 방법)

아래 순서대로 진행하면 무료로 `https://<사용자이름>.github.io/<저장소이름>/` 주소가 생깁니다.
이 주소를 기사님들 폰 브라우저에서 열고 "홈 화면에 추가"를 누르면 진짜 앱처럼 설치됩니다.

### 1. GitHub 계정 만들기 (이미 있으면 생략)
https://github.com/signup 에서 무료로 가입합니다.

### 2. 새 저장소(repository) 만들기
1. https://github.com/new 접속
2. Repository name: `geongik-schedule` (원하는 이름으로 변경 가능)
3. Public 선택
4. "Create repository" 클릭
5. 생성된 저장소 페이지에 나오는 주소를 복사합니다. (예: `https://github.com/사용자이름/geongik-schedule.git`)

### 3. 이 폴더를 저장소에 올리기
이 폴더는 이미 git 저장소로 준비되어 있고 커밋도 완료된 상태입니다 (branch: `main`).
이 폴더에서 터미널(PowerShell)을 열고 아래 명령만 입력하면 됩니다.
`<저장소주소>` 부분은 2번에서 복사한 주소로 바꿔주세요.

```bash
git remote add origin <저장소주소>
git push -u origin main
```

GitHub 로그인 창이 뜨면 로그인합니다.

### 4. GitHub Pages 켜기
1. 저장소 페이지에서 **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Pages** 클릭
3. "Build and deployment" → Source: **Deploy from a branch** 선택
4. Branch: **main**, 폴더: **/ (root)** 선택 후 **Save**
5. 1~2분 후 페이지 상단에 `https://사용자이름.github.io/geongik-schedule/` 주소가 표시됩니다.

### 5. 기사님들 폰에 설치
1. 위 주소를 폰 브라우저(Chrome 권장, 아이폰은 Safari)로 엽니다.
2. **Android(Chrome)**: 화면에 "📲 앱으로 설치" 버튼이 뜨면 눌러서 설치합니다.
3. **iPhone(Safari)**: 하단 공유 버튼 → "홈 화면에 추가"를 누릅니다.

## 시간표가 바뀌면?

새 시간표 엑셀 파일을 받으면 `schedule-data.js`만 다시 만들어서 교체하고,
아래 명령으로 다시 올리면 자동으로 반영됩니다.

```bash
git add .
git commit -m "시간표 업데이트"
git push
```

## 로컬 테스트

`서버실행.bat`를 더블클릭하면 이 PC에서 바로 테스트할 수 있습니다 (완전한 설치 기능은 HTTPS에서만 동작합니다).

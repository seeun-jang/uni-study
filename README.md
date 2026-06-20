# Uni-Study  
---  

### 대학생을 위한 AI 루틴 

#### 2026 마이크로소프트 입코딩 대회

---  

## 🔗 실행 링크

* Frontend: https://seeun-jang.github.io/uni-study/
* 서버 링크: https://unistudyapi17227.azurewebsites.net/  
---  

## 📌 프로젝트 소개

**Uni-Study**는 대학생이 공부 계획, 집중 시간, 개발 학습 기록, AI 질문 메모를 한 화면에서 관리할 수 있도록 만든 개인 생산성 향상 웹 앱입니다.

대학생은 보통 공부 계획은 Notion에 정리하고, 개발 기록은 GitHub에 남기고, 모르는 내용은 ChatGPT 같은 AI에게 따로 질문합니다.
하지만 이런 기록들이 여러 서비스에 흩어져 있으면 오늘 무엇을 했는지, 다음에 무엇을 해야 하는지 한눈에 확인하기 어렵습니다.

Uni-Study는 이러한 문제를 해결하기 위해 개인 공부 루틴 + 뽀모도로 타이머, Notion 데이터베이스 연동, GitHub 학습 기록, AI 질문 도우미, 퀴즈 생성, 사용자 AI 맞춤 공모전 및 대외활동 추천을 하나의 대시보드로 구성했습니다.

--- 

## 🎯 대상 사용자

* 과제, 시험, 자격증 공부를 동시에 관리해야 하는 대학생
* 개발 공부와 GitHub 커밋 기록을 함께 관리하고 싶은 학생
* 공부 계획과 집중 시간을 한 화면에서 확인하고 싶은 사용자
* AI에게 질문할 내용을 정리해두고 싶은 사용자

---  

## 🧩 주요 기능

### 1. 개인 공부 관리

* 할 일 추가
* 완료 체크
* 할 일 삭제
* 과목/카테고리 선택
* 우선순위 선택
* 브라우저 localStorage 저장  

### 2. 뽀모도로 타이머

* 25분 집중
* 5분 휴식
* 시작 / 일시정지 / 초기화
* 완료한 뽀모도로 횟수 기록
* 총 집중 시간 기록  

### 3. Notion Sync Ready

* Notion 스타일 공부 계획 섹션
* 현재는 localStorage 기반으로 동작
* 향후 Notion API 연동을 고려한 확장 구조
  
### 4. GitHub Study Log

* 레포 이름 입력
* 커밋 메시지 입력
* 학습 기록 추가
* 기록 삭제
* 오늘의 커밋 기록 개수 확인
* 향후 GitHub API 연동 가능  

### 5. AI Study Assistant

* ChatGPT 바로가기
* 질문 메모 작성
* 질문 템플릿 제공  

### 6. 공모전 및 대외활동 맞춤 추천

* AI가 사용자 맞춤 활동들을 추천
* 공모전 및 그 외의 다양한 정보
* 채용 공고 사이트 분석 기능도 추가할 예정

---

## 🛠️ 사용 기술

* React
* Vite
* JavaScript
* CSS
* localStorage
* GitHub Pages

---  

## 📁 프로젝트 구조

```txt
uni-study/
├─ public/
├─ src/
│  ├─ App.jsx
│  ├─ App.css
│  ├─ main.jsx
│  └─ index.css
├─ package.json
├─ vite.config.js
└─ README.md
```

---  

## 🚀 로컬 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 아래 주소로 접속합니다.

```txt
http://localhost:5173/
```

---  

## 📦 빌드 방법

```bash
npm run build
```

---  

## 🌐 배포

이 프로젝트는 GitHub Pages를 통해 배포했습니다.

Vite 프로젝트를 GitHub Pages에서 정상적으로 실행하기 위해 `vite.config.js`에 다음 설정을 추가했습니다.

```js
base: '/uni-study/'
```

---  

## 🔐 개인정보 및 신뢰성 안내

* 입력한 데이터는 현재 브라우저의 localStorage에만 저장됩니다.
* 별도의 서버나 데이터베이스로 전송되지 않습니다.
* AI 분석과 추천 메시지는 참고용이며, 최종 판단은 사용자가 직접 해야 합니다.
* 현재 버전은 MVP이며, 실제 Notion/GitHub/OpenAI API 연동은 향후 확장 계획입니다.

---  

## 🔮 향후 개선 방향

* Notion API를 활용한 실제 공부 계획 동기화
* GitHub API를 활용한 실제 커밋 기록 자동 불러오기
* Azure Functions 기반 `/api/analyze` 분석 API 추가
* OpenAI 또는 Microsoft Foundry 모델을 활용한 AI 학습 코치 기능 강화
* 사용자별 학습 데이터 저장을 위한 DB 연동
* 로그인 기반 개인화 기능 추가

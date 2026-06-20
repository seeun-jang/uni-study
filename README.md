# Uni-Study (AI Study Dashboard)

대학생 학습 루틴을 위한 웹 서비스입니다.
로그인 기반으로 학습 데이터를 관리하고, AI 기능을 통해 질문/복습/학습 계획을 강화할 수 있도록 설계했습니다.

---

## 실행 링크

- Frontend (GitHub Pages): [바로 실행하기](https://seeun-jang.github.io/uni-study/)
- Backend API Health: [서버 상태 확인](https://unistudyapi17227.azurewebsites.net/api/health)
- Backend API Ready: [서버 준비 상태](https://unistudyapi17227.azurewebsites.net/api/ready)

> 참고: 서버 루트(`/`)는 앱 라우트가 없어 오류가 날 수 있어, 정상 동작 엔드포인트 링크만 제공했습니다.

---

## 스크린샷

앱의 메인 화면 예시입니다.

<p align="center">
	<img src="https://raw.githubusercontent.com/seeun-jang/uni-study/main/src/assets/hero.png" alt="Uni-Study 메인 화면" width="900" />
</p>

이미지가 보이지 않을 경우: [스크린샷 직접 열기](https://raw.githubusercontent.com/seeun-jang/uni-study/main/src/assets/hero.png)

---

## 1. 프로젝트 개요

Uni-Study는 "루틴 형성 + 학습 효율 + 복습 자동화"를 목표로 한 학습 대시보드입니다.

- 학습 기록을 한 곳에서 관리
- 인증 기반 개인 데이터 동기화
- AI Copilot 기능으로 학습 질문/가이드 보조

## 2. 사용 기술

- Frontend: React, Vite
- Backend: Node.js, Express
- Auth/Security: JWT, bcrypt, Firebase Auth, helmet, express-rate-limit, zod
- Deployment:
	- Frontend: GitHub Pages (GitHub Actions)
	- Backend: Azure App Service

## 3. 핵심 기능

### 3-1. 인증/계정

- 회원가입/로그인 (ID/PW)
- JWT Access/Refresh 토큰 인증
- Social Login (Firebase)
	- Google
	- GitHub
	- Naver (OIDC)
- 로그인 실패 누적 시 계정 잠금

### 3-2. 학습 대시보드

- To-Do 관리
- 뽀모도로 타이머
- 학습 로그 캘린더
- 퀴즈 생성 및 학습 보조 UI
- 학습 데이터 동기화 API (`/api/study/sync`)

### 3-3. AI Copilot

- 역할 기반 응답 API
- `GET /api/copilot/roles`: 역할 목록 조회
- `POST /api/copilot/chat`: 질문/문맥 기반 응답
- `COPILOT_API_KEY` 미설정 시 로컬 fallback 응답 지원

### 3-4. 안정성/보안

- `helmet` 보안 헤더
- `express-rate-limit` 요청 제한
- `zod` 요청 스키마 검증
- `GET /api/ready`, `GET /api/health` 점검 엔드포인트
- 감사 로그 기록 (`server/audit.log`)

## 4. 로컬 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 파일 생성

```bash
cp .env.example .env
```

3. 개발 서버 실행

```bash
npm run dev
```

프론트+백엔드 동시 실행:

```bash
npm run dev:all
```

## 5. 빌드/배포

빌드:

```bash
npm run build
```

배포:

- `main` 브랜치 푸시 시 GitHub Pages 자동 배포
- 워크플로: `.github/workflows/deploy-pages.yml`

## 6. 환경 변수

### Frontend (Firebase)

필수 변수:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

선택 변수:

- `VITE_FIREBASE_NAVER_PROVIDER_ID` (기본값 `oidc.naver`)

### Backend (Production)

- `NODE_ENV=production`
- `AUTH_JWT_SECRET`
- `AUTH_REFRESH_SECRET`
- `COPILOT_API_KEY`
- `ALLOWED_ORIGINS`

## 7. 향후 개선 방향

- 운영 환경에서 `NODE_ENV=production` + 필수 시크릿 강제
- 데이터 저장소를 파일 기반에서 DB 기반으로 확장
- 학습 추천/퀴즈 품질 향상을 위한 AI 프롬프트 고도화

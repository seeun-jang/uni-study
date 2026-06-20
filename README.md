# Uni-Study

대학생 학습 루틴을 위한 올인원 웹앱입니다. 할 일 관리, 타이머, 학습 기록, 퀴즈, AI 학습 도우미를 한 화면에서 사용할 수 있습니다.

## Live Links

- Frontend (GitHub Pages): https://seeun-jang.github.io/uni-study/
- Backend API (Azure App Service): https://unistudyapi17227.azurewebsites.net
- API Health Check: https://unistudyapi17227.azurewebsites.net/api/health

## 프로젝트 소개

Uni-Study는 "루틴 형성 + 학습 효율 + 복습 자동화"를 목표로 만든 학습 대시보드입니다.
사용자는 로그인 후 개인 학습 데이터를 저장하고, AI 기반 기능으로 학습 계획/질문/복습 흐름을 강화할 수 있습니다.

## 구현된 주요 기능

### 1) 인증 및 계정

- 아이디/비밀번호 회원가입 및 로그인
- JWT Access/Refresh 토큰 기반 인증
- Social Login (Firebase)
	- Google
	- GitHub
	- Naver(OIDC)
- 로그인 실패 누적 시 계정 잠금

### 2) 학습 대시보드 기능

- To-Do 관리
- 뽀모도로 타이머
- 학습 로그 캘린더
- 퀴즈 생성 및 학습 보조 UI
- 개인 학습 데이터 동기화 (`/api/study/sync`)

### 3) AI Copilot 기능

- 역할 기반 Copilot 응답 API
- 사용 가능 역할 조회: `GET /api/copilot/roles`
- 질문/문맥 기반 응답: `POST /api/copilot/chat`
- `COPILOT_API_KEY`가 없을 경우 로컬 fallback 응답 지원

### 4) 보안/운영 안정화

- `helmet` 보안 헤더 적용
- `express-rate-limit` 요청 제한 (전역/인증/Copilot)
- `zod` 요청 스키마 검증
- 준비 상태 점검 엔드포인트: `GET /api/ready`
- 상태 점검 엔드포인트: `GET /api/health`
- 감사 로그 기록: `server/audit.log`

## 기술 스택

- Frontend: React + Vite
- Backend: Node.js + Express
- Auth: JWT, bcrypt, Firebase Auth
- Deployment:
	- Frontend: GitHub Pages (GitHub Actions)
	- Backend: Azure App Service

## 로컬 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 파일 준비

```bash
cp .env.example .env
```

3. 개발 서버 실행

```bash
npm run dev
```

백엔드를 함께 실행하려면:

```bash
npm run dev:all
```

## 빌드 및 배포

### 빌드

```bash
npm run build
```

### GitHub Pages 배포

- `main` 브랜치에 푸시하면 자동 배포
- 워크플로 파일: `.github/workflows/deploy-pages.yml`

## 환경 변수 안내

### Firebase (Frontend)

필수:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

선택:

- `VITE_FIREBASE_NAVER_PROVIDER_ID` (기본값: `oidc.naver`)

### 서버 운영 필수 (Production)

- `NODE_ENV=production`
- `AUTH_JWT_SECRET`
- `AUTH_REFRESH_SECRET`
- `COPILOT_API_KEY`
- `ALLOWED_ORIGINS` (프론트 도메인만 허용)

# Uni-Study

대학생을 위한 학습 대시보드입니다. 투두, 뽀모도로, 로그 캘린더, 퀴즈 생성기, 로그인 화면을 포함합니다.

## Run

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

## Social Login (Firebase)

앱의 Social Login 버튼은 Firebase Authentication `signInWithPopup`으로 동작합니다.

필수 환경 변수:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

선택 환경 변수:

- `VITE_FIREBASE_NAVER_PROVIDER_ID` (기본값: `oidc.naver`)

### Firebase 콘솔 설정

1. Firebase 프로젝트 생성
2. Authentication 활성화
3. Sign-in method에서 다음 제공자 활성화
- Google
- GitHub
- Naver: OIDC 커스텀 제공자로 등록 후 provider ID를 `.env`와 동일하게 설정
4. Authorized domains에 로컬 개발 도메인 추가
- `localhost`
- 배포 도메인 (사용 시)

GitHub/Naver는 각 서비스 개발자 콘솔에서 Client ID/Secret 설정과 Redirect URI 등록이 필요합니다.

## Build

```bash
npm run build
```

## GitHub Pages (Frontend)

이 저장소는 `main` 푸시 시 GitHub Actions로 자동 배포됩니다.

- 배포 워크플로: `.github/workflows/deploy-pages.yml`
- Pages URL: `https://seeun-jang.github.io/uni-study/`
- API URL(빌드 시 주입): `https://unistudyapi17227.azurewebsites.net`

필수 설정(최초 1회):

1. GitHub 저장소 `Settings > Pages` 이동
2. `Build and deployment`의 Source를 `GitHub Actions`로 선택

## Copilot Role SDK (Backend)

로그인된 사용자 토큰으로 Copilot 역할 기반 백엔드를 사용할 수 있습니다.

- `GET /api/copilot/roles`: 사용 가능한 역할 목록
- `POST /api/copilot/chat`: 역할 + 컨텍스트 기반 응답

예시 요청 본문:

```json
{
	"roleId": "backend",
	"message": "로그아웃 처리 API를 더 안전하게 바꾸고 싶어",
	"context": "Express + JWT + refresh token",
	"history": []
}
```

`.env`에 `COPILOT_API_KEY`를 넣으면 외부 LLM으로 응답하고, 없으면 로컬 fallback 응답을 반환합니다.

## Deployment Hardening Checklist

배포 전 아래 항목을 반드시 설정하세요.

1. `NODE_ENV=production`
2. `AUTH_JWT_SECRET`, `AUTH_REFRESH_SECRET` 강력한 값 설정
3. `COPILOT_API_KEY` 설정
4. `ALLOWED_ORIGINS`를 실제 프론트 도메인으로 제한

추가 보안 기능:

- `helmet` 보안 헤더 적용
- `express-rate-limit` 전역/인증/Copilot 요청 제한
- `zod` 요청 스키마 검증
- `GET /api/ready` 준비 상태 점검
- 로그인 실패 누적 시 계정 잠금 (`AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_LOCK_MINUTES`)
- 인증/Copilot 이벤트 감사 로그 (`server/audit.log`)

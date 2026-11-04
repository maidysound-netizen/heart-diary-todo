# Heart Diary To-Do (잔소리 토끼)

클립보드에 꽂힌 To-Do 종이 한 장에 할 일을 적고, 같은 종이 위에 펜으로 그리거나 글을 쓰면, 옆에 앉은 토끼 모모가 마감을 귀엽게 잔소리해 주는 1인용 비공개 Todo 웹앱. 요구사항은 [PRD.md](PRD.md)에 있다. (3D 하트 다이어리 버전은 `main` 브랜치)

- **클립보드 한 판:** To-Do List 속지(`public/templates/06_todo.png`) 칸 위치에 날짜·TOP 3·체크박스 줄·입력칸을 놓는다.
- **같은 종이 위 펜·글:** ✋ 손 = 체크·입력, ✎ 펜(필압) / ▍ 형광펜 / ⌫ 지우개 / T 글상자 / ⤧ 선택. 날짜별로 자동 저장(`page_decor`, `todo:YYYY-MM-DD`).
- **잔소리 토끼 모모:** `/api/chat`이 저장된 Todo를 보고 상태별 대사(비었음·남음·마감 지남·다 끝냄). 처음 열 때, 할 일이 바뀔 때, 2분마다. 누르면 질문 버튼과 목소리 켜기.
- **데이터:** Google OAuth(Auth.js) → Neon PostgreSQL. 모든 API는 세션의 사용자 id로만 조회/수정/삭제한다.

## 구조

```
src/auth.ts                  Auth.js (Google, 로컬 전용 테스트 로그인)
src/lib/db.ts                Neon(serverless) / 로컬 PGlite, 첫 연결 때 스키마 생성
src/lib/schema.ts            users, todos, page_decor, diary_settings (+ v1.1 테이블)
src/app/api/*                todos, pages, chat, me, auth
src/components/DiaryApp      로그인 화면 / 클립보드 + 토끼 배치
src/components/Paper         클립보드에 꽂힌 속지 (템플릿 + 기능 칸 + 낙서 층)
src/components/views/TodoView  Todo CRUD를 속지 칸에 맞춰 배치
src/components/DrawingBoard  펜 드로잉 + 글상자
src/components/ChatBubble    잔소리 토끼 모모 (NagBunny)
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # AUTH_SECRET 채우기: npx auth secret
npm run dev
```

`DATABASE_URL`을 비워 두면 `.pglite/` 폴더의 내장 Postgres에 저장된다. `AUTH_DEV_LOGIN=1`이면 Google 키 없이 "테스트 계정으로 입장"으로 확인할 수 있다(Vercel에서는 자동으로 꺼진다).

## 배포 (Vercel + Neon + Google OAuth)

1. Neon 프로젝트(AWS Singapore)를 만들고 연결 문자열을 Vercel Production 환경변수 `DATABASE_URL`에 등록. 테이블은 첫 요청 때 자동 생성. Vercel 함수 리전은 `sin1`(vercel.json).
2. Google Cloud Console OAuth 클라이언트(웹)에 승인된 리디렉션 URI `https://<배포도메인>/api/auth/callback/google` 추가.
3. Vercel 환경변수: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
4. `vercel --prod`로 배포.

## 알려진 한계

- 필압은 Pointer Events `pressure` 값을 쓰며 실기기(드라이버·브라우저) 확인이 필요하다.
- 토끼는 규칙형이며 외부 AI를 호출하지 않는다. 페이지를 열어 둔 동안에만 잔소리한다.

# Heart Diary (하트 다이어리)

하트 모양 3D 다이어리를 펼쳐 일기·할 일·주간·월간 계획을 기록하는 1인용 비공개 웹 다이어리. 요구사항은 [PRD.md](PRD.md)에 있다.

- **3D 하트 책 (Three.js / React Three Fiber):** 누빔 가죽 하트 표지·링 제본·레이스·리본·금박 제목·체인 참. 표지를 누르면 힌지를 축으로 실제 회전하며 펼쳐지고, 페이지 이동 때는 3D 책장이 넘어간다.
- **하트형 첫 펼침 허브:** 좌·우 하트 내지 위에 Diary / Todo / Weekly / Monthly / Draw / Photo / Chat / Decorate 스티커 버튼.
- **편집 레이어:** 3D 페이지 위치를 화면 좌표로 투영해 HTML 편집 레이어를 정확히 겹치고, SVG `clipPath`로 하트 윤곽을 유지한다. 모바일은 한 장짜리 종이로 바뀐다(허브는 하트 유지).
- **드로잉:** Pointer Events + Canvas. 펜 필압(`pressure`), 형광펜, 지우개(펜 뒤쪽 지우개 포함), 손바닥 무시, 되돌리기/다시 실행, 스티커·사진·글상자 배치/이동/크기/회전/앞뒤 순서. 좌표는 보드 기준 0~1로 저장.
- **데이터:** Google OAuth(Auth.js) → Neon PostgreSQL. 모든 API는 세션의 사용자 id로만 조회/수정/삭제한다.
- **마스코트 모모:** `/api/chat`이 저장된 Todo를 조회해 규칙형 답변. 잔소리 모드·음성 읽기(사용자가 켠 경우만).

## 구조

```
src/auth.ts                  Auth.js (Google, 로컬 전용 테스트 로그인)
src/lib/db.ts                Neon(serverless) / 로컬 PGlite 같은 SQL 사용, 첫 연결 때 스키마 생성
src/lib/schema.ts            users, diary_entries, todos, diary_settings
src/app/api/*                entries, todos, calendar, chat, me, photos/upload, templates
src/components/HeartBook3D   3D 하트 책
src/components/DiaryApp      화면 전환·책장 넘김·하트 패널
src/components/DrawingBoard  펜 드로잉 + 객체 배치
src/components/views/*       Hub, Diary, Todo, Weekly, Monthly, Decorate
public/templates             속지 8종 (Blank, Lined, Grid, Dots, Daily, Todo, Weekly, Monthly)
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # AUTH_SECRET 채우기: npx auth secret
npm run dev
```

`DATABASE_URL`을 비워 두면 프로젝트 안 `.pglite/` 폴더의 내장 Postgres에 저장된다. `AUTH_DEV_LOGIN=1`이면 Google 키 없이 "테스트 계정으로 입장"으로 확인할 수 있다(Vercel 환경에서는 자동으로 꺼진다).

## 배포 (Vercel + Neon + Google OAuth)

1. Vercel 프로젝트에 **Neon** 연동(Storage → Neon) → `DATABASE_URL` 자동 등록. 테이블은 첫 요청 때 자동 생성.
2. Google Cloud Console → OAuth 클라이언트 ID(웹 애플리케이션) 생성
   - 승인된 리디렉션 URI: `https://<배포도메인>/api/auth/callback/google`
3. Vercel 환경변수: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (선택: Vercel Blob 연결 시 `BLOB_READ_WRITE_TOKEN`)
4. 재배포

사진 저장소(Blob)를 연결하지 않으면 사진은 긴 변 720px로 줄인 사본이 페이지 배치 데이터에 함께 저장된다.

## 알려진 한계

- 신티크 필압은 Pointer Events `pressure` 값을 쓰며, 실기기(드라이버·브라우저) 확인이 필요하다.
- 체인·인형 참은 흔들림 애니메이션만 있고 물리 시뮬레이션은 없다. 허브 스티커 위치 이동은 아직 지원하지 않는다.
- 챗봇은 규칙형이며 외부 AI를 호출하지 않는다.

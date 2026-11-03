# Heart Diary (하트 다이어리)

하트 모양 3D 다이어리를 펼쳐 일기·할 일·주간·월간 계획을 기록하는 1인용 비공개 웹 다이어리. 요구사항은 [PRD.md](PRD.md)에 있다.

- **3D 양문형 하트 책 (Three.js / React Three Fiber):** 닫으면 누빔 가죽 하트 표지(레이스·리본·금 하트 자물쇠·금박 제목·체인 참). 열면 표지가 가운데에서 갈라져 양쪽 힌지로 열리고, 안쪽은 가운데 제본선이 있는 큰 하트 한 장. 페이지를 넘기면 반쪽 하트 종이가 제본선을 축으로 3D로 넘어간다.
- **스티커 판 겸 그리기 판(기본 화면):** 책을 열면 나오는 하트 한 장. ✋ 손 도구로 하트 아래 스티커 시트(Todo / Weekly / Monthly / Diary / Picture / Music / Chat / Decorate)의 스티커를 끌어다 붙이고, ✎·형광펜·T·꾸미기 스티커로 그 위에 낙서한다. 오른쪽 아래 Next page로 다음 장(최대 12장). 스티커 위치는 `diary_settings.hub_layout`, 장마다 낙서는 `page_decor(hub:<id>)`.
- **튀어나오는 속지:** 붙인 스티커를 누르면 그 자리에서 해당 속지(To-Do List · Weekly · Monthly · Daily Journal 템플릿 원본)가 튀어나온다. 할 일·주간·달력 데이터는 템플릿의 체크박스 줄·요일 칸·달력 칸 위치에 맞춰 놓이고, 같은 속지 위에 펜 낙서·글상자·스티커·사진을 겹쳐 쓴다(✋로 바꾸면 체크·입력). 속지 낙서는 날짜/주/월별로 자동 저장(`page_decor`).
- **편집 레이어:** 3D 하트 내지 위치를 화면 좌표로 투영해 HTML 편집 레이어를 정확히 겹치고, SVG `clipPath`로 하트 윤곽을 유지한다.
- **일기:** Daily Journal 속지의 DATE·MOOD 칸에 날짜·기분, 줄 위에 T로 바로 글을 쓰고 ✎로 그림을 겹친다. 속지 8종 중 고를 수 있고 좌표는 속지 기준 0~1.
- **Music:** YouTube·Spotify·SoundCloud 링크를 붙이면 공식 임베드 플레이어로 재생(`music_links`).
- **드로잉:** Pointer Events + Canvas. 펜 필압(`pressure`), 형광펜, 지우개(펜 뒤쪽 지우개 포함), 손바닥 무시, 되돌리기/다시 실행, 스티커·사진·글상자 배치/이동/크기/회전/앞뒤 순서. 좌표는 보드 기준 0~1로 저장.
- **데이터:** Google OAuth(Auth.js) → Neon PostgreSQL. 모든 API는 세션의 사용자 id로만 조회/수정/삭제한다.
- **마스코트 모모:** `/api/chat`이 저장된 Todo를 조회해 규칙형 답변. 잔소리 모드·음성 읽기(사용자가 켠 경우만).

## 구조

```
src/auth.ts                  Auth.js (Google, 로컬 전용 테스트 로그인)
src/lib/db.ts                Neon(serverless) / 로컬 PGlite 같은 SQL 사용, 첫 연결 때 스키마 생성
src/lib/schema.ts            users, diary_entries, todos, diary_settings, music_links, page_decor
src/app/api/*                entries, todos, calendar, chat, me, music, pages, photos/upload, templates
src/components/HeartBook3D   3D 하트 책
src/components/DiaryApp      화면 전환·책장 넘김·하트 패널
src/components/DrawingBoard  펜 드로잉 + 객체 배치
src/components/Paper         스티커를 누르면 튀어나오는 속지 (템플릿 + 기능 칸 + 낙서 층)
src/components/views/*       Hub(스티커 판), Diary, Todo, Weekly, Monthly, Music, Decorate
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

1. **Neon** 프로젝트(AWS Singapore, `neon.ts`)에 연결: `npx neon@latest init ... && npx neon@latest deploy`로 `.env.local`에 `DATABASE_URL`을 받은 뒤, 같은 값을 Vercel Production/Preview 환경변수에 등록. 테이블은 첫 요청 때 자동 생성. Vercel 함수 리전도 `sin1`(vercel.json)로 DB와 맞춘다.
2. Google Cloud Console → OAuth 클라이언트 ID(웹 애플리케이션) 생성
   - 승인된 리디렉션 URI: `https://<배포도메인>/api/auth/callback/google`
3. Vercel 환경변수: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (선택: Vercel Blob 연결 시 `BLOB_READ_WRITE_TOKEN`)
4. 재배포

사진 저장소(Blob)를 연결하지 않으면 사진은 긴 변 720px로 줄인 사본이 페이지 배치 데이터에 함께 저장된다.

## 알려진 한계

- 신티크 필압은 Pointer Events `pressure` 값을 쓰며, 실기기(드라이버·브라우저) 확인이 필요하다.
- 체인·인형 참은 흔들림 애니메이션만 있고 물리 시뮬레이션은 없다.
- 챗봇은 규칙형이며 외부 AI를 호출하지 않는다.

import { handle, requireUser, readJson, HttpError } from "@/lib/api";
import { query } from "@/lib/db";
import { tzOffset } from "@/lib/tz";

type Todo = { title: string; due_at: string | null; is_completed: boolean };

const CHEERS = [
  "오늘도 여기까지 온 너, 정말 대단해! 토닥토닥 🐰",
  "천천히 가도 괜찮아. 한 칸씩 채우면 다이어리가 반짝반짝해질 거야 ✨",
  "물 한 잔 마시고, 어깨 한 번 쭉 펴자! 너는 잘하고 있어 💗",
  "작은 체크 하나도 큰 한 걸음이야. 응원할게! 🎀",
];

const EMPTY = [
  "오늘 할 일이 텅 비었어! 하나라도 적어 볼까? ✏️",
  "아무것도 안 적으면 내가 잔소리를 못 하잖아~ 할 일 하나만 써 줘 🐰",
];
const DONE = [
  "잔소리할 게 하나도 없네? 오늘의 너 완벽해! 🏆",
  "다 끝냈다고?! 오늘은 칭찬만 할게 💗",
];
const PENDING = [
  "「{t}」 아직 남았어! 끝내면 내가 스티커 붙여줄게 🎀",
  "음~ 「{t}」 언제 할 거야? 나 계속 보고 있다 👀",
  "「{t}」 지금 시작하면 금방 끝날걸? 같이 하자 🐰",
];
const OVERDUE = [
  "앗! 「{t}」 마감이 {h}였는데 아직이야… 지금 5분만 해볼까? 🐰💦",
  "「{t}」 {h} 지났어!! 토끼 귀가 쫑긋쫑긋 화났다구 😤",
  "「{t}」 기다리다 당근이 다 식었어… 얼른 하자! 🥕",
];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

function hhmm(iso: string, tz: number) {
  const d = new Date(new Date(iso).getTime() - tz * 60_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function md(iso: string, tz: number) {
  const d = new Date(new Date(iso).getTime() - tz * 60_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// POST /api/chat { intent: "today" | "week" | "cheer" | "nag", tz }
// 1차 버전: 저장된 Todo를 조회해서 정해진 말투 템플릿으로 답한다 (외부 AI 호출 없음).
export const POST = handle(async (req: Request) => {
  const uid = await requireUser();
  const b = await readJson(req);
  const tz = tzOffset(String(b.tz ?? "0"));
  const now = new Date();
  const local = new Date(now.getTime() - tz * 60_000);
  const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + tz * 60_000);

  if (b.intent === "cheer") return { reply: CHEERS[Math.floor(Math.random() * CHEERS.length)] };

  if (b.intent === "today" || b.intent === "nag") {
    const end = new Date(dayStart.getTime() + 86_400_000);
    const todos = await query<Todo>(
      `SELECT title, due_at, is_completed FROM todos
       WHERE owner_id = $1 AND (due_at < $2 OR due_at IS NULL) AND (due_at >= $3 OR NOT is_completed OR due_at IS NULL)
       ORDER BY due_at NULLS LAST`,
      [uid, end.toISOString(), dayStart.toISOString()],
    );
    const open = todos.filter((t) => !t.is_completed);
    const done = todos.filter((t) => t.is_completed);
    const overdue = open.filter((t) => t.due_at && new Date(t.due_at) < now);
    if (b.intent === "nag") {
      if (!todos.length) return { reply: pick(EMPTY) };
      if (!open.length) return { reply: pick(DONE) };
      const first = overdue[0] ?? open[0];
      const more = open.length > 1 ? ` (남은 일 ${open.length}개)` : "";
      if (overdue.length) {
        return { reply: pick(OVERDUE).replace("{t}", first.title).replace("{h}", hhmm(first.due_at!, tz)) + more, speak: true };
      }
      return { reply: pick(PENDING).replace("{t}", first.title) + more };
    }
    if (!todos.length) return { reply: "오늘은 어떤 일을 적어볼까? 종이에 할 일을 하나 적어 봐 ✏️" };
    const lines = open.map(
      (t) => `□ ${t.title}${t.due_at ? ` (${hhmm(t.due_at, tz)}${new Date(t.due_at) < now ? " · 지남!" : ""})` : ""}`,
    );
    const praise = done.length ? `벌써 ${done.length}개 완료! 최고야 💗` : "";
    return {
      reply: open.length
        ? `오늘 남은 일은 ${open.length}개야.\n${lines.join("\n")}${praise ? `\n${praise}` : ""}`
        : `오늘 할 일 ${done.length}개를 전부 끝냈어! 오늘은 푹 쉬자 🌙`,
    };
  }

  if (b.intent === "week") {
    const end = new Date(dayStart.getTime() + 7 * 86_400_000);
    const todos = await query<Todo>(
      `SELECT title, due_at, is_completed FROM todos
       WHERE owner_id = $1 AND due_at >= $2 AND due_at < $3 ORDER BY due_at`,
      [uid, dayStart.toISOString(), end.toISOString()],
    );
    if (!todos.length) return { reply: "앞으로 7일 동안 잡힌 일정이 없어. 여유로운 한 주가 되겠다 ☁️" };
    const open = todos.filter((t) => !t.is_completed);
    return {
      reply: `앞으로 7일 일정 ${todos.length}개 (남은 일 ${open.length}개)\n${todos
        .slice(0, 8)
        .map((t) => `${t.is_completed ? "☑" : "□"} ${md(t.due_at!, tz)} ${t.title}`)
        .join("\n")}`,
    };
  }

  throw new HttpError(400, "알 수 없는 질문이에요.");
});

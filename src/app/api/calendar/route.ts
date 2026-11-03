import { handle, requireUser, HttpError } from "@/lib/api";
import { query } from "@/lib/db";
import { tzOffset } from "@/lib/tz";

// GET /api/calendar?month=YYYY-MM&tz=-540 → 날짜별 일기 유무·기분·Todo 개수
export const GET = handle(async (req: Request) => {
  const uid = await requireUser();
  const sp = new URL(req.url).searchParams;
  const month = sp.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, "month 형식은 YYYY-MM 이어야 해요.");
  const tz = tzOffset(sp.get("tz"));
  const start = `${month}-01`;
  const entries = await query<{ d: string; mood: string | null; title: string }>(
    `SELECT entry_date::text AS d, mood, title FROM diary_entries
     WHERE owner_id = $1 AND entry_date >= $2::date AND entry_date < ($2::date + interval '1 month')`,
    [uid, start],
  );
  // 사용자의 현지 날짜 기준으로 묶는다: (UTC 시각 - offset분)
  const todos = await query<{ d: string; total: number; done: number }>(
    `SELECT ((due_at AT TIME ZONE 'UTC') - make_interval(mins => $3))::date::text AS d,
            count(*)::int AS total, count(*) FILTER (WHERE is_completed)::int AS done
     FROM todos
     WHERE owner_id = $1 AND due_at IS NOT NULL
       AND ((due_at AT TIME ZONE 'UTC') - make_interval(mins => $3))::date >= $2::date
       AND ((due_at AT TIME ZONE 'UTC') - make_interval(mins => $3))::date < ($2::date + interval '1 month')
     GROUP BY 1`,
    [uid, start, tz],
  );
  return { month, entries, todos };
});

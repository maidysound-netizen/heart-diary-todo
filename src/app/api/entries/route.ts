import { handle, requireUser, readJson, isoDate, HttpError } from "@/lib/api";
import { query } from "@/lib/db";
import { ENTRY_COLS, entryFields } from "@/lib/entries";

// GET /api/entries?date=YYYY-MM-DD  → 그 날의 일기(없으면 null)
// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD → 기간 요약 목록
export const GET = handle(async (req: Request) => {
  const uid = await requireUser();
  const sp = new URL(req.url).searchParams;
  if (sp.get("date")) {
    const rows = await query(`SELECT ${ENTRY_COLS} FROM diary_entries WHERE owner_id = $1 AND entry_date = $2`, [
      uid,
      isoDate(sp.get("date")),
    ]);
    return { entry: rows[0] ?? null };
  }
  const rows = await query(
    `SELECT id, entry_date::text AS entry_date, title, mood FROM diary_entries
     WHERE owner_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date`,
    [uid, isoDate(sp.get("from"), "from"), isoDate(sp.get("to"), "to")],
  );
  return { entries: rows };
});

export const POST = handle(async (req: Request) => {
  const uid = await requireUser();
  const b = await readJson(req);
  const f = entryFields(b);
  const date = isoDate(b.entry_date);
  const rows = await query(
    `INSERT INTO diary_entries (owner_id, entry_date, title, content_text, mood, drawing_data, template_key, page_layout)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (owner_id, entry_date) DO NOTHING
     RETURNING ${ENTRY_COLS}`,
    [uid, date, f.title, f.content_text, f.mood, f.drawing_data, f.template_key, f.page_layout],
  );
  if (!rows[0]) throw new HttpError(409, "이 날짜에는 이미 일기가 있어요. 새로고침 후 수정해 주세요.");
  return { entry: rows[0] };
});


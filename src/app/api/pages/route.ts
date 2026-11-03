import { handle, requireUser, readJson, jsonValue, HttpError } from "@/lib/api";
import { query } from "@/lib/db";

// 속지·허브 장마다 위에 그린 낙서·글상자·스티커 (todo:2026-11-03, weekly:2026-11-02, monthly:2026-11, photo:…, music, hub:<장 id>)
const KEY = /^((todo|weekly|monthly|draw|photo|music|decorate)(:\d{4}-\d{2}(-\d{2})?)?|hub:[a-z0-9]{1,16})$/;

function pageKey(v: unknown): string {
  if (typeof v !== "string" || !KEY.test(v)) throw new HttpError(400, "알 수 없는 페이지예요.");
  return v;
}

export const GET = handle(async (req: Request) => {
  const uid = await requireUser();
  const key = pageKey(new URL(req.url).searchParams.get("key"));
  const rows = await query(`SELECT drawing_data, page_layout, updated_at FROM page_decor WHERE owner_id = $1 AND page_key = $2`, [uid, key]);
  return { page: rows[0] ?? null };
});

// PUT /api/pages { key, drawing_data, page_layout }
export const PUT = handle(async (req: Request) => {
  const uid = await requireUser();
  const b = await readJson(req);
  const key = pageKey(b.key);
  const rows = await query(
    `INSERT INTO page_decor (owner_id, page_key, drawing_data, page_layout) VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_id, page_key) DO UPDATE SET drawing_data = EXCLUDED.drawing_data, page_layout = EXCLUDED.page_layout, updated_at = now()
     RETURNING updated_at`,
    [uid, key, jsonValue(b.drawing_data, 2_000_000, "드로잉"), jsonValue(b.page_layout, 2_500_000, "페이지 배치")],
  );
  return { updated_at: rows[0].updated_at };
});

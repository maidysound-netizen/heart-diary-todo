import { handle, requireUser, readJson, uuid, HttpError } from "@/lib/api";
import { query } from "@/lib/db";
import { ENTRY_COLS, entryFields } from "@/lib/entries";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const uid = await requireUser();
  const id = uuid((await ctx.params).id);
  const f = entryFields(await readJson(req));
  const rows = await query(
    `UPDATE diary_entries SET title = $3, content_text = $4, mood = $5, drawing_data = $6, template_key = $7,
       page_layout = $8, updated_at = now()
     WHERE id = $1 AND owner_id = $2 RETURNING ${ENTRY_COLS}`,
    [id, uid, f.title, f.content_text, f.mood, f.drawing_data, f.template_key, f.page_layout],
  );
  if (!rows[0]) throw new HttpError(404, "일기를 찾을 수 없어요.");
  return { entry: rows[0] };
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const uid = await requireUser();
  const id = uuid((await ctx.params).id);
  const rows = await query(`DELETE FROM diary_entries WHERE id = $1 AND owner_id = $2 RETURNING id`, [id, uid]);
  if (!rows[0]) throw new HttpError(404, "일기를 찾을 수 없어요.");
  return { ok: true };
});

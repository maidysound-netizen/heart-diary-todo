import { handle, requireUser, readJson, uuid, HttpError } from "@/lib/api";
import { query } from "@/lib/db";
import { TODO_COLS, dueAt, todoText } from "@/lib/todos";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const uid = await requireUser();
  const id = uuid((await ctx.params).id);
  const b = await readJson(req);
  let rows;
  if (Object.keys(b).length === 1 && typeof b.is_completed === "boolean") {
    rows = await query(
      `UPDATE todos SET is_completed = $3, completed_at = CASE WHEN $3 THEN now() END, updated_at = now()
       WHERE id = $1 AND owner_id = $2 RETURNING ${TODO_COLS}`,
      [id, uid, b.is_completed],
    );
  } else {
    const t = todoText(b);
    rows = await query(
      `UPDATE todos SET title = $3, description = $4, due_at = $5, updated_at = now()
       WHERE id = $1 AND owner_id = $2 RETURNING ${TODO_COLS}`,
      [id, uid, t.title, t.description, dueAt(b.due_at)],
    );
  }
  if (!rows[0]) throw new HttpError(404, "할 일을 찾을 수 없어요.");
  return { todo: rows[0] };
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const uid = await requireUser();
  const id = uuid((await ctx.params).id);
  const rows = await query(`DELETE FROM todos WHERE id = $1 AND owner_id = $2 RETURNING id`, [id, uid]);
  if (!rows[0]) throw new HttpError(404, "할 일을 찾을 수 없어요.");
  return { ok: true };
});

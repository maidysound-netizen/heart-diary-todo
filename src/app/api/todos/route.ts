import { handle, requireUser, readJson, HttpError } from "@/lib/api";
import { query } from "@/lib/db";
import { TODO_COLS, dueAt, todoText } from "@/lib/todos";

// GET /api/todos?from=ISO&to=ISO[&undated=1]  (from ≤ due_at < to)
export const GET = handle(async (req: Request) => {
  const uid = await requireUser();
  const sp = new URL(req.url).searchParams;
  const from = dueAt(sp.get("from"));
  const to = dueAt(sp.get("to"));
  if (!from || !to) throw new HttpError(400, "from/to가 필요해요.");
  const undated = sp.get("undated") === "1";
  const rows = await query(
    `SELECT ${TODO_COLS} FROM todos
     WHERE owner_id = $1 AND ((due_at >= $2 AND due_at < $3) OR ($4 AND due_at IS NULL))
     ORDER BY is_completed, due_at NULLS LAST, created_at`,
    [uid, from, to, undated],
  );
  return { todos: rows };
});

export const POST = handle(async (req: Request) => {
  const uid = await requireUser();
  const b = await readJson(req);
  const t = todoText(b);
  const rows = await query(
    `INSERT INTO todos (owner_id, title, description, due_at) VALUES ($1, $2, $3, $4) RETURNING ${TODO_COLS}`,
    [uid, t.title, t.description, dueAt(b.due_at)],
  );
  return { todo: rows[0] };
});

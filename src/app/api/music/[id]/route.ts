import { handle, requireUser, uuid, HttpError } from "@/lib/api";
import { query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const uid = await requireUser();
  const id = uuid((await ctx.params).id);
  const rows = await query(`DELETE FROM music_links WHERE id = $1 AND owner_id = $2 RETURNING id`, [id, uid]);
  if (!rows[0]) throw new HttpError(404, "링크를 찾을 수 없어요.");
  return { ok: true };
});

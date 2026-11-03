import { handle, requireUser, readJson, str, HttpError } from "@/lib/api";
import { query } from "@/lib/db";

const COLS = `id, url, title, created_at`;

export const GET = handle(async () => {
  const uid = await requireUser();
  return { links: await query(`SELECT ${COLS} FROM music_links WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100`, [uid]) };
});

// POST /api/music { url, title? } — 음악 링크(YouTube·Spotify·SoundCloud 등) 저장
export const POST = handle(async (req: Request) => {
  const uid = await requireUser();
  const b = await readJson(req);
  const url = str(b.url, 500, "링크", true).trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, "올바른 링크 주소를 넣어 주세요.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new HttpError(400, "http(s) 링크만 저장할 수 있어요.");
  const rows = await query(
    `INSERT INTO music_links (owner_id, url, title) VALUES ($1, $2, $3) RETURNING ${COLS}`,
    [uid, parsed.toString(), str(b.title, 120, "제목").trim()],
  );
  return { link: rows[0] };
});

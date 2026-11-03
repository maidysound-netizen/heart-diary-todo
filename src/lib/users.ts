import "server-only";
import { query } from "./db";

export async function upsertUser(u: { sub: string; email: string; name: string | null; image: string | null }) {
  const rows = await query<{ id: string }>(
    `INSERT INTO users (google_sub, email, name, image_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET google_sub = EXCLUDED.google_sub, name = EXCLUDED.name, image_url = EXCLUDED.image_url, updated_at = now()
     RETURNING id`,
    [u.sub, u.email, u.name, u.image],
  );
  await query(`INSERT INTO diary_settings (owner_id) VALUES ($1) ON CONFLICT DO NOTHING`, [rows[0].id]);
  return rows[0];
}

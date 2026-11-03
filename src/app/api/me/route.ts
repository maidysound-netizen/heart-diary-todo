import { handle, requireUser, readJson, HttpError } from "@/lib/api";
import { query } from "@/lib/db";

const SETTINGS = `cover_color, ribbon_key, chain_key, charm_key, nagging_mode, voice_enabled, hub_layout`;
const COLORS = /^#[0-9a-f]{6}$/i;
const RIBBONS = ["rose", "cream", "lilac", "cherry"];
const CHAINS = ["gold", "silver", "none"];
const CHARMS = ["heart", "bunny", "bear", "star"];

export const GET = handle(async () => {
  const uid = await requireUser();
  const [user] = await query(`SELECT id, email, name, image_url, created_at FROM users WHERE id = $1`, [uid]);
  if (!user) throw new HttpError(401, "다시 로그인해 주세요.");
  const [settings] = await query(`SELECT ${SETTINGS} FROM diary_settings WHERE owner_id = $1`, [uid]);
  return { user, settings };
});

// PATCH /api/me  { cover_color?, ribbon_key?, chain_key?, charm_key?, nagging_mode?, voice_enabled?, hub_layout? }
export const PATCH = handle(async (req: Request) => {
  const uid = await requireUser();
  const b = await readJson(req);
  const [cur] = await query<Record<string, unknown>>(`SELECT ${SETTINGS} FROM diary_settings WHERE owner_id = $1`, [uid]);
  if (!cur) throw new HttpError(404, "설정을 찾을 수 없어요.");
  const pick = <T,>(k: string, ok: (v: unknown) => boolean): T => {
    if (b[k] === undefined) return cur[k] as T;
    if (!ok(b[k])) throw new HttpError(400, `${k} 값이 올바르지 않아요.`);
    return b[k] as T;
  };
  const hub = pick<unknown>("hub_layout", (v) => v === null || (typeof v === "object" && JSON.stringify(v).length < 5000));
  const [settings] = await query(
    `UPDATE diary_settings SET cover_color = $2, ribbon_key = $3, chain_key = $4, charm_key = $5,
       nagging_mode = $6, voice_enabled = $7, hub_layout = $8, updated_at = now()
     WHERE owner_id = $1 RETURNING ${SETTINGS}`,
    [
      uid,
      pick<string>("cover_color", (v) => typeof v === "string" && COLORS.test(v)),
      pick<string>("ribbon_key", (v) => RIBBONS.includes(v as string)),
      pick<string>("chain_key", (v) => CHAINS.includes(v as string)),
      pick<string>("charm_key", (v) => CHARMS.includes(v as string)),
      pick<boolean>("nagging_mode", (v) => typeof v === "boolean"),
      pick<boolean>("voice_enabled", (v) => typeof v === "boolean"),
      hub == null ? null : JSON.stringify(hub),
    ],
  );
  return { settings };
});

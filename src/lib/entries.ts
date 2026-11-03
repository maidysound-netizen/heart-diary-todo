import "server-only";
import { str, jsonValue, HttpError } from "./api";

export const ENTRY_COLS = `id, entry_date::text AS entry_date, title, content_text, mood, drawing_data, template_key, page_layout, created_at, updated_at`;

const TEMPLATE_KEYS = ["01_blank", "02_lined", "03_grid", "04_dots", "05_daily", "06_todo", "07_weekly", "08_monthly"];
const MOODS = ["", "happy", "calm", "excited", "tired", "sad", "angry"];

export function entryFields(b: Record<string, unknown>) {
  const template_key = str(b.template_key, 40, "속지") || "05_daily";
  if (!TEMPLATE_KEYS.includes(template_key)) throw new HttpError(400, "알 수 없는 속지예요.");
  const mood = str(b.mood, 24, "기분");
  if (!MOODS.includes(mood)) throw new HttpError(400, "알 수 없는 기분 스티커예요.");
  return {
    title: str(b.title, 160, "제목"),
    content_text: str(b.content_text, 20000, "본문"),
    mood: mood || null,
    template_key,
    drawing_data: jsonValue(b.drawing_data, 2_000_000, "드로잉"),
    page_layout: jsonValue(b.page_layout, 2_500_000, "페이지 배치"),
  };
}

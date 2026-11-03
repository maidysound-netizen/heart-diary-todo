import "server-only";
import { str, HttpError } from "./api";

export const TODO_COLS = `id, title, description, due_at, is_completed, completed_at, created_at, updated_at`;

export function dueAt(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || isNaN(Date.parse(v))) throw new HttpError(400, "마감 시각 형식이 올바르지 않아요.");
  return new Date(v).toISOString();
}

export function todoText(b: Record<string, unknown>) {
  const title = str(b.title, 200, "할 일", true).trim();
  if (!title) throw new HttpError(400, "할 일을 입력해 주세요.");
  return { title, description: str(b.description, 2000, "설명") || null };
}

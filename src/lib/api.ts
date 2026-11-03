import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 세션의 사용자 id만 신뢰한다. 요청 본문/쿼리의 owner_id는 절대 쓰지 않는다. */
export async function requireUser(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new HttpError(401, "로그인이 필요해요.");
  return id;
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "잘못된 요청 형식이에요.");
}

export function str(v: unknown, max: number, field: string, required = false): string {
  if (v == null || v === "") {
    if (required) throw new HttpError(400, `${field}을(를) 입력해 주세요.`);
    return "";
  }
  if (typeof v !== "string") throw new HttpError(400, `${field} 형식이 올바르지 않아요.`);
  if (v.length > max) throw new HttpError(400, `${field}은(는) ${max}자 이하로 입력해 주세요.`);
  return v;
}

export function isoDate(v: unknown, field = "날짜"): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) {
    throw new HttpError(400, `${field} 형식은 YYYY-MM-DD 이어야 해요.`);
  }
  return v;
}

export function uuid(v: unknown): string {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new HttpError(404, "찾을 수 없어요.");
  return v;
}

/** JSON 값의 직렬화 크기를 제한한다 (드로잉/레이아웃). */
export function jsonValue(v: unknown, maxBytes: number, field: string): string | null {
  if (v == null) return null;
  const s = JSON.stringify(v);
  if (s.length > maxBytes) throw new HttpError(413, `${field} 데이터가 너무 커요.`);
  return s;
}

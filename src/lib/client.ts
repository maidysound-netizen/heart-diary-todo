"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "네트워크 연결을 확인해 주세요.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "요청에 실패했어요.");
  return data as T;
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const today = () => ymd(new Date());
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
export const prettyDate = (s: string) => {
  const d = parseYmd(s);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEKDAYS[d.getDay()]})`;
};
/** 그 날 00:00 ~ 다음날 00:00 (현지 시각) ISO */
export const dayRange = (s: string, days = 1) => {
  const a = parseYmd(s);
  const b = parseYmd(s);
  b.setDate(b.getDate() + days);
  return { from: a.toISOString(), to: b.toISOString() };
};
/** 월요일 시작 주 */
export const weekStart = (s: string) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
};
export const localYmdOf = (iso: string) => ymd(new Date(iso));
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export type Todo = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  is_completed: boolean;
  completed_at: string | null;
};

export type Entry = {
  id: string;
  entry_date: string;
  title: string;
  content_text: string;
  mood: string | null;
  drawing_data: DrawingData | null;
  template_key: string;
  page_layout: PageLayout | null;
  updated_at: string;
};

export type Stroke = { id: string; tool: "pen" | "hl"; color: string; size: number; pts: [number, number, number][] };
export type DrawingData = { v: 1; strokes: Stroke[] };
export type PageItem = {
  id: string;
  kind: "sticker" | "photo" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  z: number;
  key?: string;
  src?: string;
  text?: string;
  color?: string;
  /** 글상자 글자 크기 (보드 너비 대비 비율) */
  fs?: number;
};
export type PageLayout = { v: 1; items: PageItem[] };

export type Settings = {
  cover_color: string;
  ribbon_key: string;
  chain_key: string;
  charm_key: string;
  nagging_mode: boolean;
  voice_enabled: boolean;
  hub_layout: HubLayout | null;
};

/** 허브(첫 펼침) 스티커 판. 좌표는 하트 바운딩 박스 기준 0~1 */
export type HubSticker = { id: string; kind: string; x: number; y: number; rot: number };
export type HubLayout = { v: 2; pages: { id: string; stickers: HubSticker[] }[] };

export const DEFAULT_HUB: HubLayout = {
  v: 2,
  pages: [
    {
      id: "p1",
      stickers: [
        { id: "s1", kind: "todo", x: 0.27, y: 0.36, rot: -6 },
        { id: "s2", kind: "weekly", x: 0.73, y: 0.36, rot: 5 },
        { id: "s3", kind: "diary", x: 0.34, y: 0.58, rot: 4 },
        { id: "s4", kind: "monthly", x: 0.66, y: 0.58, rot: -4 },
      ],
    },
  ],
};

export type MusicLink = { id: string; url: string; title: string; created_at: string };

export const DEFAULT_SETTINGS: Settings = {
  cover_color: "#E8A6B5",
  ribbon_key: "rose",
  chain_key: "gold",
  charm_key: "heart",
  nagging_mode: false,
  voice_enabled: false,
  hub_layout: null,
};

export const uid = () => Math.random().toString(36).slice(2, 10);

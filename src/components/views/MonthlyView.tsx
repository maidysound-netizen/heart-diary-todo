"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "../DiaryApp";
import { At, Paper } from "../Paper";
import { MoodFace } from "../art";
import { api, dayRange, hhmm, pad, prettyDate, today, type Entry, type Todo } from "@/lib/client";

type Cal = { entries: { d: string; mood: string | null; title: string }[]; todos: { d: string; total: number; done: number }[] };

// 08_monthly.png 달력 칸 (일요일 시작, 6줄)
const GRID_X = 0.1027;
const COL_W = 0.1136;
const GRID_Y = 0.3156;
const ROW_H = 0.0753;

export function MonthlyView({ date }: { date?: string }) {
  const { go } = useApp();
  const init = date ?? today();
  const [ym, setYm] = useState(init.slice(0, 7));
  const [sel, setSel] = useState(init);
  const [cal, setCal] = useState<Cal | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ entry: Entry | null; todos: Todo[] } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setCal(await api<Cal>(`/api/calendar?month=${ym}&tz=${new Date().getTimezoneOffset()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    }
  }, [ym]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDetail(null);
    const { from, to } = dayRange(sel);
    Promise.all([
      api<{ entry: Entry | null }>(`/api/entries?date=${sel}`),
      api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ])
      .then(([a, b]) => setDetail({ entry: a.entry, todos: b.todos }))
      .catch(() => setDetail({ entry: null, todos: [] }));
  }, [sel]);

  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const nDays = new Date(y, m, 0).getDate();
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const tdy = today();
  const done = detail?.todos.filter((t) => t.is_completed).length ?? 0;

  const content = (
    <>
      <At x={0.225} y={0.156} w={0.2} h={0.035} className="fill-in hand center">
        {y}년 {m}월
      </At>
      {error && <At x={0.12} y={0.215} w={0.7} className="error small">{error}</At>}
      {Array.from({ length: nDays }, (_, i) => {
        const day = `${ym}-${pad(i + 1)}`;
        const idx = first + i;
        const r = Math.floor(idx / 7), c = idx % 7;
        const e = cal?.entries.find((x) => x.d === day);
        const t = cal?.todos.find((x) => x.d === day);
        return (
          <At key={day} x={GRID_X + c * COL_W} y={GRID_Y + Math.min(r, 5) * ROW_H} w={COL_W} h={ROW_H}>
            <button
              className={`cal-cell ${day === sel ? "sel" : ""} ${day === tdy ? "is-today" : ""} ${c === 0 ? "sun" : c === 6 ? "sat" : ""}`}
              onClick={() => (day === sel ? go({ name: "diary", date: day }) : setSel(day))}
              aria-label={`${day}${e ? ", 일기 있음" : ""}${t ? `, 할 일 ${t.total}개` : ""}${day === sel ? " — 한 번 더 누르면 일기 열기" : ""}`}
              aria-pressed={day === sel}
            >
              <span className="cal-n">{i + 1}</span>
              {e && <span className="cal-mood">{e.mood ? <MoodFace mood={e.mood} /> : "♥"}</span>}
              {t && <span className={`cal-t ${t.done === t.total ? "all" : ""}`}>{t.done}/{t.total}</span>}
            </button>
          </At>
        );
      })}
      {/* NOTES 줄: 고른 날 요약 */}
      <At x={0.12} y={0.834} w={0.75} h={0.026} className="note-line">
        <b>{prettyDate(sel)}</b>
        {detail?.entry && (
          <span className="ellipsis">
            {" "}
            · ♡ {detail.entry.title || "일기 있음"}
          </span>
        )}
      </At>
      <At x={0.12} y={0.864} w={0.75} h={0.026} className="note-line ellipsis">
        {!detail ? "불러오는 중…" : detail.todos.length ? `할 일 ${done}/${detail.todos.length} · ${detail.todos.map((t) => (t.due_at ? `${hhmm(t.due_at)} ` : "") + t.title).join(", ")}` : "이 날은 일정이 없어요"}
      </At>
      <At x={0.12} y={0.893} w={0.75} h={0.028} className="note-line">
        <button className="link small" onClick={() => go({ name: "diary", date: sel })}>{detail?.entry ? "일기 열기" : "일기 쓰기"}</button>
        <button className="link small" onClick={() => go({ name: "todo", date: sel })}>할 일 열기</button>
      </At>
    </>
  );

  return (
    <Paper
      label="Monthly Planner"
      template="08_monthly"
      decorKey={`monthly:${ym}`}
      content={content}
      pinned={
        <At x={0.44} y={0.159} className="paper-nav">
          <button className="icon-btn sm" onClick={() => shift(-1)} aria-label="지난달">‹</button>
          <button className="icon-btn sm" onClick={() => { setYm(today().slice(0, 7)); setSel(today()); }} aria-label="이번 달로">•</button>
          <button className="icon-btn sm" onClick={() => shift(1)} aria-label="다음달">›</button>
        </At>
      }
    />
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet, useApp } from "../DiaryApp";
import { MoodFace } from "../art";
import { api, dayRange, hhmm, pad, prettyDate, today, WEEKDAYS, type Entry, type Todo } from "@/lib/client";

type Cal = { entries: { d: string; mood: string | null; title: string }[]; todos: { d: string; total: number; done: number }[] };

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
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: nDays }, (_, i) => `${ym}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const tdy = today();

  return (
    <Sheet
      template="08_monthly"
      left={
        <div>
          <div className="date-nav">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="지난달">‹</button>
            <h2 className="hand">{y}년 {m}월</h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="다음달">›</button>
          </div>
          {error && <p className="error center">{error}</p>}
          <div className="cal" role="grid" aria-label={`${y}년 ${m}월 달력`}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`cal-h ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`} role="columnheader">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="cal-c empty" />;
              const e = cal?.entries.find((x) => x.d === d);
              const t = cal?.todos.find((x) => x.d === d);
              return (
                <button
                  key={d}
                  role="gridcell"
                  className={`cal-c ${d === sel ? "sel" : ""} ${d === tdy ? "is-today" : ""}`}
                  onClick={() => setSel(d)}
                  aria-label={`${d}${e ? ", 일기 있음" : ""}${t ? `, 할 일 ${t.total}개` : ""}`}
                  aria-selected={d === sel}
                >
                  <span className="cal-n">{Number(d.slice(8))}</span>
                  {e && <span className="cal-mood">{e.mood ? <MoodFace mood={e.mood} /> : "♥"}</span>}
                  {t && <span className={`cal-t ${t.done === t.total ? "all" : ""}`}>{t.done}/{t.total}</span>}
                </button>
              );
            })}
          </div>
        </div>
      }
      right={
        <div className="month-detail">
          <h2 className="hand center">{prettyDate(sel)}</h2>
          {!detail ? (
            <p className="muted center">불러오는 중…</p>
          ) : (
            <>
              <div className="detail-card">
                <h3>♡ 일기</h3>
                {detail.entry ? (
                  <>
                    <p className="detail-title">
                      {detail.entry.mood && <span className="mini-mood"><MoodFace mood={detail.entry.mood} /></span>}
                      {detail.entry.title || "(제목 없음)"}
                    </p>
                    <p className="detail-text">{detail.entry.content_text.slice(0, 120) || "글 없이 그림·스티커로 남긴 날"}</p>
                  </>
                ) : (
                  <p className="muted">아직 쓰지 않았어요.</p>
                )}
                <button className="btn-primary sm" onClick={() => go({ name: "diary", date: sel })}>
                  {detail.entry ? "일기 열기" : "일기 쓰기"}
                </button>
              </div>
              <div className="detail-card">
                <h3>✓ 할 일</h3>
                {detail.todos.length ? (
                  <ul className="mini-todos">
                    {detail.todos.slice(0, 5).map((t) => (
                      <li key={t.id} className={t.is_completed ? "done" : ""}>
                        {t.is_completed ? "☑" : "□"} {t.due_at && hhmm(t.due_at)} {t.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">일정이 없어요.</p>
                )}
                <button className="btn-ghost sm" onClick={() => go({ name: "todo", date: sel })}>할 일 열기</button>
              </div>
            </>
          )}
        </div>
      }
    />
  );
}

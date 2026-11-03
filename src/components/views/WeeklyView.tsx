"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet, useApp } from "../DiaryApp";
import { MoodFace } from "../art";
import { addDays, api, dayRange, hhmm, localYmdOf, parseYmd, today, weekStart, WEEKDAYS, type Todo } from "@/lib/client";

type EntrySum = { id: string; entry_date: string; title: string; mood: string | null };

export function WeeklyView({ date }: { date?: string }) {
  const { go, toast } = useApp();
  const [start, setStart] = useState(weekStart(date ?? today()));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [entries, setEntries] = useState<EntrySum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = dayRange(start, 7);
      const [a, b] = await Promise.all([
        api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        api<{ entries: EntrySum[] }>(`/api/entries?from=${start}&to=${addDays(start, 6)}`),
      ]);
      setTodos(a.todos);
      setEntries(b.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [start]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (t: Todo) => {
    setTodos((l) => l.map((x) => (x.id === t.id ? { ...x, is_completed: !x.is_completed } : x)));
    try {
      await api(`/api/todos/${t.id}`, { method: "PATCH", json: { is_completed: !t.is_completed } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "바꾸지 못했어요.");
      void load();
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const tdy = today();

  const day = (d: string) => {
    const dt = parseYmd(d);
    const e = entries.find((x) => x.entry_date === d);
    const list = todos.filter((t) => t.due_at && localYmdOf(t.due_at) === d);
    return (
      <div key={d} className={`week-day ${d === tdy ? "is-today" : ""}`}>
        <button className="week-label" onClick={() => go({ name: "diary", date: d })} aria-label={`${d} 일기 열기`}>
          <b>{WEEKDAYS[dt.getDay()]}</b>
          <span>{dt.getMonth() + 1}/{dt.getDate()}</span>
        </button>
        <div className="week-body">
          {e && (
            <button className="week-entry" onClick={() => go({ name: "diary", date: d })}>
              <span className="mini-mood">{e.mood ? <MoodFace mood={e.mood} /> : "♥"}</span>
              {e.title || "일기 있음"}
            </button>
          )}
          {list.slice(0, 3).map((t) => (
            <label key={t.id} className={`week-todo ${t.is_completed ? "done" : ""}`}>
              <input type="checkbox" checked={t.is_completed} onChange={() => toggle(t)} />
              <span>{hhmm(t.due_at!)} {t.title}</span>
            </label>
          ))}
          {list.length > 3 && (
            <button className="link small" onClick={() => go({ name: "todo", date: d })}>+{list.length - 3}개 더</button>
          )}
          {!e && !list.length && (
            <button className="link small faint" onClick={() => go({ name: "todo", date: d })}>+ 할 일</button>
          )}
        </div>
      </div>
    );
  };

  const s = parseYmd(start), en = parseYmd(addDays(start, 6));
  const nav = (
    <div className="date-nav">
      <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="지난주">‹</button>
      <h2 className="hand">{s.getMonth() + 1}/{s.getDate()} – {en.getMonth() + 1}/{en.getDate()}</h2>
      <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="다음주">›</button>
    </div>
  );

  const body = (list: string[]) =>
    loading ? <p className="muted center">불러오는 중…</p> : error ? <p className="error center">{error}</p> : <div className="week-list">{list.map(day)}</div>;

  return (
    <Sheet
      template="07_weekly"
      left={
        <div>
          {nav}
          {body(days.slice(0, 4))}
        </div>
      }
      right={
        <div>
          <h2 className="hand center">Weekly ♡ {entries.length}일 기록 · 할 일 {todos.filter((t) => t.is_completed).length}/{todos.length}</h2>
          {body(days.slice(4))}
          <div className="center">
            <button className="btn-ghost" onClick={() => setStart(weekStart(today()))}>이번 주로</button>
          </div>
        </div>
      }
    />
  );
}

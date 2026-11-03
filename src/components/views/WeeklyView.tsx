"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "../DiaryApp";
import { At, Paper } from "../Paper";
import { MoodFace } from "../art";
import { addDays, api, dayRange, hhmm, localYmdOf, parseYmd, today, weekStart, type Todo } from "@/lib/client";

type EntrySum = { id: string; entry_date: string; title: string; mood: string | null };

// 07_weekly.png: 월~일 7칸
const BOX0 = 0.2214;
const BOX_STEP = 0.0968;

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

  const s = parseYmd(start), en = parseYmd(addDays(start, 6));
  const tdy = today();

  const content = (
    <>
      <At x={0.236} y={0.151} w={0.07} h={0.035} className="fill-in hand center">
        {s.getMonth() + 1}/{s.getDate()}
      </At>
      <At x={0.338} y={0.151} w={0.07} h={0.035} className="fill-in hand center">
        {en.getMonth() + 1}/{en.getDate()}
      </At>
      {error && <At x={0.26} y={0.2} w={0.6} className="error small">{error}</At>}
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const top = BOX0 + i * BOX_STEP;
        const e = entries.find((x) => x.entry_date === d);
        const list = todos.filter((t) => t.due_at && localYmdOf(t.due_at) === d);
        return (
          <div key={d}>
            <At x={0.114} y={top + 0.055} w={0.113} h={0.025} className={`week-date ${d === tdy ? "is-today" : ""}`}>
              <button className="link small" onClick={() => go({ name: "diary", date: d })} aria-label={`${d} 일기 열기`}>
                {parseYmd(d).getDate()}일{e?.mood ? "" : e ? " ♥" : ""}
              </button>
              {e?.mood && (
                <span className="mini-mood">
                  <MoodFace mood={e.mood} />
                </span>
              )}
            </At>
            <At x={0.262} y={top + 0.008} w={0.59} h={0.072} className="week-lines">
              {loading ? null : (
                <>
                  {e && (
                    <button className="week-entry" onClick={() => go({ name: "diary", date: d })}>
                      ♡ {e.title || "일기 있음"}
                    </button>
                  )}
                  {list.slice(0, e ? 2 : 3).map((t) => (
                    <label key={t.id} className={`week-todo ${t.is_completed ? "done" : ""}`}>
                      <input type="checkbox" checked={t.is_completed} onChange={() => toggle(t)} />
                      <span>
                        {hhmm(t.due_at!)} {t.title}
                      </span>
                    </label>
                  ))}
                  {list.length > (e ? 2 : 3) && (
                    <button className="link small" onClick={() => go({ name: "todo", date: d })}>
                      +{list.length - (e ? 2 : 3)}개 더
                    </button>
                  )}
                </>
              )}
            </At>
            <At x={0.86} y={top + 0.01} w={0.05} h={0.03}>
              <button className="icon-btn sm" onClick={() => go({ name: "todo", date: d })} aria-label={`${d} 할 일 열기`}>
                +
              </button>
            </At>
          </div>
        );
      })}
    </>
  );

  return (
    <Paper
      label="Weekly Planner"
      template="07_weekly"
      decorKey={`weekly:${start}`}
      content={content}
      pinned={
        <At x={0.44} y={0.158} className="paper-nav">
          <button className="icon-btn sm" onClick={() => setStart(addDays(start, -7))} aria-label="지난주">‹</button>
          <button className="icon-btn sm" onClick={() => setStart(weekStart(today()))} aria-label="이번 주로">•</button>
          <button className="icon-btn sm" onClick={() => setStart(addDays(start, 7))} aria-label="다음주">›</button>
        </At>
      }
    />
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "../DiaryApp";
import { At, Paper } from "../Paper";
import { addDays, api, dayRange, hhmm, localYmdOf, pad, parseYmd, today, type Todo } from "@/lib/client";

// 06_todo.png 칸 위치 (속지 기준 0~1)
const ROW0 = 0.3396; // 첫 체크박스 중심
const ROW_STEP = 0.0474;
const ROWS = 12;

function dueIso(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "23:59").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

export function TodoView({ date: initDate }: { date?: string }) {
  const { toast, todosChanged } = useApp();
  const [date, setDate] = useState(initDate ?? today());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", time: "" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = dayRange(date);
      const day = await api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&undated=1`);
      let list = day.todos;
      // 오늘 속지에는 마감이 지난 미완료 일도 함께 올린다
      if (date === today()) {
        const past = await api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(new Date(2000, 0, 1).toISOString())}&to=${encodeURIComponent(from)}`);
        list = [...past.todos.filter((t) => !t.is_completed), ...list];
      }
      setTodos(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const title = draft.title.trim();
    if (!title) return;
    try {
      await api("/api/todos", { method: "POST", json: { title, due_at: dueIso(date, draft.time) } });
      setDraft({ title: "", time: "" });
      await load();
      todosChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "추가하지 못했어요.");
    }
  };

  const toggle = async (t: Todo) => {
    setTodos((l) => l.map((x) => (x.id === t.id ? { ...x, is_completed: !t.is_completed } : x)));
    try {
      await api(`/api/todos/${t.id}`, { method: "PATCH", json: { is_completed: !t.is_completed } });
      if (!t.is_completed) toast("완료! 참 잘했어요 💗");
      todosChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "바꾸지 못했어요.");
      void load();
    }
  };

  const save = async (t: Todo, title: string, time: string) => {
    setEditing(null);
    title = title.trim();
    const oldTime = t.due_at ? hhmm(t.due_at) : "";
    if (!title || (title === t.title && time === oldTime)) return;
    try {
      const day = t.due_at ? localYmdOf(t.due_at) : date;
      await api(`/api/todos/${t.id}`, { method: "PATCH", json: { title, description: t.description, due_at: time || t.due_at ? dueIso(day, time || oldTime) : null } });
      await load();
      todosChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "고치지 못했어요.");
    }
  };

  const remove = async (t: Todo) => {
    if (!confirm(`「${t.title}」을(를) 지울까요?`)) return;
    try {
      await api(`/api/todos/${t.id}`, { method: "DELETE" });
      await load();
      todosChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "지우지 못했어요.");
    }
  };

  const d = parseYmd(date);
  const shown = todos.slice(0, ROWS - 1);
  const top3 = todos.filter((t) => !t.is_completed).slice(0, 3);
  const over = (t: Todo) => !t.is_completed && !!t.due_at && new Date(t.due_at).getTime() < now;
  const meta = (t: Todo) => {
    if (!t.due_at) return "언제든";
    const day = localYmdOf(t.due_at);
    return (day !== date ? `${Number(day.slice(5, 7))}/${Number(day.slice(8))} ` : "") + hhmm(t.due_at);
  };

  const content = (
    <>
      <At x={0.195} y={0.158} w={0.24} h={0.036} className="fill-in hand">
        {d.getFullYear()} . {pad(d.getMonth() + 1)} . {pad(d.getDate())}
      </At>
      <At x={0.4} y={0.249} w={0.48} h={0.04} className="fill-in small ellipsis">
        {top3.length ? top3.map((t, i) => `${i + 1}. ${t.title}`).join("   ") : "가장 중요한 일 3개가 여기 보여요"}
      </At>
      {loading ? (
        <At x={0.19} y={ROW0 - 0.015} w={0.6} className="muted">불러오는 중…</At>
      ) : error ? (
        <At x={0.19} y={ROW0 - 0.015} w={0.66} className="error">
          {error} <button className="link" onClick={load}>다시 시도</button>
        </At>
      ) : (
        shown.map((t, i) => {
          const cy = ROW0 + i * ROW_STEP;
          return (
            <div key={t.id}>
              <At x={0.128} y={cy - 0.0125} w={0.036} h={0.025}>
                <button
                  className={`paper-check ${t.is_completed ? "on" : ""}`}
                  onClick={() => toggle(t)}
                  aria-label={`${t.title} ${t.is_completed ? "완료 취소" : "완료"}`}
                  aria-pressed={t.is_completed}
                />
              </At>
              <At x={0.19} y={cy - 0.019} w={0.655} h={0.032} className={`todo-line ${t.is_completed ? "done" : ""} ${over(t) ? "over" : ""}`}>
                {editing === t.id ? (
                  <form
                    className="line-edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void save(t, String(f.get("title")), String(f.get("time") ?? ""));
                    }}
                  >
                    <input name="title" defaultValue={t.title} maxLength={200} autoFocus aria-label="할 일" />
                    <input name="time" type="time" defaultValue={t.due_at ? hhmm(t.due_at) : ""} aria-label="마감 시각" />
                    <button className="link small">확인</button>
                    <button type="button" className="link small" onClick={() => setEditing(null)}>취소</button>
                  </form>
                ) : (
                  <>
                    <button className="line-title" onClick={() => setEditing(t.id)} title="눌러서 고치기">
                      {t.title}
                    </button>
                    <span className="line-meta">
                      {meta(t)}
                      {over(t) && <b className="badge">지남</b>}
                    </span>
                    <button className="line-x" onClick={() => remove(t)} aria-label={`${t.title} 지우기`}>
                      ×
                    </button>
                  </>
                )}
              </At>
            </div>
          );
        })
      )}
      {!loading && !error && shown.length < ROWS && (
        <At x={0.19} y={ROW0 + shown.length * ROW_STEP - 0.019} w={0.655} h={0.032} className="todo-line add">
          <form
            className="line-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="+ 할 일을 쓰고 Enter" maxLength={200} aria-label="새 할 일" />
            <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} aria-label="마감 시각" />
          </form>
        </At>
      )}
      {todos.length > ROWS - 1 && (
        <At x={0.19} y={0.885} w={0.6} className="muted small">
          + {todos.length - (ROWS - 1)}개 더 있어요 (완료하면 자리가 생겨요)
        </At>
      )}
    </>
  );

  return (
    <Paper
      label="To-Do List"
      template="06_todo"
      decorKey={`todo:${date}`}
      content={content}
      pinned={
        <At x={0.44} y={0.168} className="paper-nav">
          <button className="icon-btn sm" onClick={() => setDate(addDays(date, -1))} aria-label="전날">‹</button>
          <button className="icon-btn sm" onClick={() => setDate(today())} aria-label="오늘로">•</button>
          <button className="icon-btn sm" onClick={() => setDate(addDays(date, 1))} aria-label="다음날">›</button>
        </At>
      }
    />
  );
}

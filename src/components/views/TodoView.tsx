"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet, useApp } from "../DiaryApp";
import { addDays, api, dayRange, hhmm, localYmdOf, pad, prettyDate, today, type Todo } from "@/lib/client";

type Form = { id?: string; title: string; description: string; date: string; time: string };

const blank = (date: string): Form => ({ title: "", description: "", date, time: "" });

function toIso(f: Form) {
  if (!f.date) return null;
  const [y, m, d] = f.date.split("-").map(Number);
  const [hh, mm] = (f.time || "23:59").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

export function TodoView({ date: initDate }: { date?: string }) {
  const { toast } = useApp();
  const [date, setDate] = useState(initDate ?? today());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [overdue, setOverdue] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form>(blank(date));
  const [saving, setSaving] = useState(false);
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
      const [a, b] = await Promise.all([
        api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&undated=1`),
        api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(new Date(2000, 0, 1).toISOString())}&to=${encodeURIComponent(dayRange(today()).from)}`),
      ]);
      setTodos(a.todos);
      setOverdue(b.todos.filter((t) => !t.is_completed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveDate = (n: number) => {
    const d = addDays(date, n);
    setDate(d);
    if (!form.id) setForm((f) => ({ ...f, date: d }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast("할 일을 입력해 주세요.");
    setSaving(true);
    try {
      const body = { title: form.title.trim(), description: form.description, due_at: toIso(form) };
      if (form.id) await api(`/api/todos/${form.id}`, { method: "PATCH", json: body });
      else await api(`/api/todos`, { method: "POST", json: body });
      toast(form.id ? "할 일을 고쳤어요." : "할 일을 추가했어요 ✏️");
      setForm(blank(date));
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (t: Todo) => {
    const flip = (list: Todo[]) => list.map((x) => (x.id === t.id ? { ...x, is_completed: !t.is_completed } : x));
    setTodos(flip);
    setOverdue((o) => (t.is_completed ? o : o.filter((x) => x.id !== t.id)));
    try {
      await api(`/api/todos/${t.id}`, { method: "PATCH", json: { is_completed: !t.is_completed } });
      if (!t.is_completed) toast("완료! 참 잘했어요 💗");
    } catch (e) {
      toast(e instanceof Error ? e.message : "바꾸지 못했어요.");
      void load();
    }
  };

  const remove = async (t: Todo) => {
    if (!confirm(`「${t.title}」을(를) 삭제할까요?`)) return;
    try {
      await api(`/api/todos/${t.id}`, { method: "DELETE" });
      if (form.id === t.id) setForm(blank(date));
      toast("삭제했어요.");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "삭제하지 못했어요.");
    }
  };

  const edit = (t: Todo) => {
    const d = t.due_at ? new Date(t.due_at) : null;
    setForm({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      date: d ? localYmdOf(t.due_at!) : "",
      time: d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "",
    });
  };

  const isOver = (t: Todo) => !t.is_completed && !!t.due_at && new Date(t.due_at).getTime() < now;

  const row = (t: Todo, showDate?: boolean) => (
    <li key={t.id}
      className={`todo ${t.is_completed ? "done" : ""} ${isOver(t) ? "over" : ""} ${form.id === t.id ? "editing" : ""}`}>
      <label className="todo-check">
        <input type="checkbox" checked={t.is_completed} onChange={() => toggle(t)} />
        <span className="box" aria-hidden="true" />
        <span className="todo-title">{t.title}</span>
      </label>
      <span className="todo-meta">
        {t.due_at ? (showDate ? `${localYmdOf(t.due_at).slice(5).replace("-", "/")} ` : "") + hhmm(t.due_at) : "언제든"}
        {isOver(t) && <b className="badge">지남</b>}
      </span>
      <button className="icon-btn sm" onClick={() => edit(t)} aria-label={`${t.title} 수정`}>✎</button>
      <button className="icon-btn sm" onClick={() => remove(t)} aria-label={`${t.title} 삭제`}>×</button>
    </li>
  );

  const done = todos.filter((t) => t.is_completed).length;

  return (
    <Sheet
      template="06_todo"
      left={
        <div className="todo-left">
          <div className="date-nav">
            <button className="icon-btn" onClick={() => moveDate(-1)} aria-label="전날">‹</button>
            <h2 className="hand">{prettyDate(date)}</h2>
            <button className="icon-btn" onClick={() => moveDate(1)} aria-label="다음날">›</button>
          </div>
          <p className="muted small">
            {todos.length ? `${todos.length}개 중 ${done}개 완료` : "이 날의 할 일 (마감 없는 일 포함)"}
          </p>
          {loading ? (
            <p className="muted center">불러오는 중…</p>
          ) : error ? (
            <div className="center">
              <p className="error">{error}</p>
              <button className="btn-ghost" onClick={load}>다시 시도</button>
            </div>
          ) : todos.length ? (
            <ul className="todo-list">
              {todos.map((t) => (
                row(t)
              ))}
            </ul>
          ) : (
            <p className="empty hand">아직 비어 있어요. 오른쪽에서 할 일을 적어 봐요 ✏️</p>
          )}
        </div>
      }
      right={
        <div className="todo-right">
          <form className="todo-form" onSubmit={submit}>
            <h3 className="hand">{form.id ? "할 일 고치기" : "새 할 일"}</h3>
            <input value={form.title} maxLength={200} placeholder="무엇을 할까요?" onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="할 일" required />
            <input value={form.description} maxLength={2000} placeholder="메모 (선택)" onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="메모" />
            <div className="row">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="마감 날짜" />
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label="마감 시각" disabled={!form.date} />
            </div>
            <div className="row">
              <button className="btn-primary" disabled={saving}>{saving ? "저장 중…" : form.id ? "고치기" : "추가"}</button>
              {form.id && (
                <button type="button" className="btn-ghost" onClick={() => setForm(blank(date))}>취소</button>
              )}
            </div>
          </form>
          {overdue.length > 0 && (
            <div className="overdue">
              <h3 className="hand">⏰ 마감이 지난 일</h3>
              <ul className="todo-list">
                {overdue.slice(0, 5).map((t) => (
                  row(t, true)
                ))}
              </ul>
            </div>
          )}
        </div>
      }
    />
  );
}

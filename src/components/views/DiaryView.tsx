"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, useApp } from "../DiaryApp";
import { DrawingBoard } from "../DrawingBoard";
import { MOODS, MoodFace } from "../art";
import { addDays, api, prettyDate, today, uid, type Entry, type PageItem, type Stroke } from "@/lib/client";
import catalog from "@/lib/templates.json";

type Draft = { title: string; content_text: string; mood: string; template_key: string; strokes: Stroke[]; items: PageItem[] };

const EMPTY: Draft = { title: "", content_text: "", mood: "", template_key: "05_daily", strokes: [], items: [] };

function toDraft(e: Entry | null): Draft {
  if (!e) return EMPTY;
  const items = [...(e.page_layout?.items ?? [])];
  // 예전 일기(본문이 따로 있던 것)는 본문을 페이지 위 글상자로 옮겨 보여준다
  if (e.content_text && !items.some((i) => i.kind === "text")) {
    items.push({ id: uid(), kind: "text", text: e.content_text, color: "#5B3A45", x: 0.16, y: 0.3, w: 0.42, h: 0.3, rot: 0, z: 301 });
  }
  return {
    title: e.title,
    content_text: e.content_text,
    mood: e.mood ?? "",
    template_key: e.template_key,
    strokes: e.drawing_data?.strokes ?? [],
    items,
  };
}

/** 본문 검색·월간 미리보기용: 페이지 위 글상자를 위→아래, 왼→오 순서로 이어 붙인다 */
const textOf = (items: PageItem[]) =>
  items
    .filter((i) => i.kind === "text" && i.text?.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((i) => i.text!.trim())
    .join("\n");

export function DiaryView({ date: initDate, tool }: { date?: string; tool?: "draw" | "photo" }) {
  const { go, toast, setLeaveGuard } = useApp();
  const [date] = useState(initDate ?? today());
  const [entry, setEntry] = useState<Entry | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<"" | "dirty" | "saving" | "saved" | "error">("");
  const [boardKey, setBoardKey] = useState(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const statusRef = useRef(status);
  statusRef.current = status;
  const entryRef = useRef(entry);
  entryRef.current = entry;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await api<{ entry: Entry | null }>(`/api/entries?date=${date}`);
      setEntry(r.entry);
      setDraft(toDraft(r.entry));
      setBoardKey((k) => k + 1);
      setStatus("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setStatus("dirty");
  };

  const save = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    setStatus("saving");
    const body = {
      entry_date: date,
      title: d.title,
      content_text: textOf(d.items).slice(0, 20000),
      mood: d.mood,
      template_key: d.template_key,
      drawing_data: { v: 1, strokes: d.strokes },
      page_layout: { v: 1, items: d.items },
    };
    try {
      const cur = entryRef.current;
      const r = cur
        ? await api<{ entry: Entry }>(`/api/entries/${cur.id}`, { method: "PATCH", json: body })
        : await api<{ entry: Entry }>(`/api/entries`, { method: "POST", json: body });
      setEntry(r.entry);
      setStatus("saved");
      return true;
    } catch (e) {
      setStatus("error");
      toast(e instanceof Error ? e.message : "저장하지 못했어요.");
      return false;
    }
  }, [date, toast]);

  // 책장을 넘기기 전에 저장을 끝낸다 (저장 실패 시 이동할지 묻는다)
  useEffect(() => {
    setLeaveGuard(async () => {
      if (statusRef.current !== "dirty" && statusRef.current !== "error") return true;
      if (await save()) return true;
      return confirm("저장하지 못했어요. 저장하지 않고 페이지를 넘길까요?");
    });
    return () => setLeaveGuard(null);
  }, [save, setLeaveGuard]);

  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "dirty") e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, []);

  const remove = async () => {
    if (!entry) return;
    if (!confirm(`${prettyDate(date)} 일기를 삭제할까요? 글·그림·사진 배치가 모두 지워져요.`)) return;
    try {
      await api(`/api/entries/${entry.id}`, { method: "DELETE" });
      setEntry(null);
      setDraft(EMPTY);
      setBoardKey((k) => k + 1);
      setStatus("");
      toast("일기를 삭제했어요.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "삭제하지 못했어요.");
    }
  };

  const onBoard = useCallback((s: { strokes: Stroke[]; items: PageItem[] }) => {
    setDraft((d) => ({ ...d, strokes: s.strokes, items: s.items }));
    setStatus("dirty");
  }, []);

  const statusText = {
    "": entry ? "저장된 일기" : "새 일기",
    dirty: "저장 안 됨",
    saving: "저장 중…",
    saved: "저장했어요 ♡",
    error: "저장 실패 — 다시 시도해 주세요",
  }[status];

  const header = (
    <>
      <div className="lobe lobe-l">
        <div className="date-nav">
          <button className="icon-btn" onClick={() => go({ name: "diary", date: addDays(date, -1) })} aria-label="전날">‹</button>
          <h2 className="hand">{prettyDate(date)}</h2>
          <button className="icon-btn" onClick={() => go({ name: "diary", date: addDays(date, 1) })} aria-label="다음날">›</button>
        </div>
        <input
          className="title-input hand"
          value={draft.title}
          maxLength={160}
          placeholder="오늘의 제목"
          onChange={(e) => patch({ title: e.target.value })}
          aria-label="제목"
          disabled={loading || !!loadError}
        />
      </div>
      <div className="lobe lobe-r">
        <div className="mood-row" role="radiogroup" aria-label="오늘의 기분">
          {MOODS.map((m) => (
            <button
              key={m.key}
              role="radio"
              aria-checked={draft.mood === m.key}
              className={`mood ${draft.mood === m.key ? "on" : ""}`}
              onClick={() => patch({ mood: draft.mood === m.key ? "" : m.key })}
              title={m.label}
            >
              <MoodFace mood={m.key} />
              <span className="sr">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  if (loading || loadError) {
    return (
      <Sheet
        template={draft.template_key}
        full={
          <>
            {header}
            <div className="sheet-center">
              {loadError ? (
                <>
                  <p className="error">{loadError}</p>
                  <button className="btn-ghost" onClick={load}>다시 시도</button>
                </>
              ) : (
                <p className="muted">펼치는 중…</p>
              )}
            </div>
          </>
        }
      />
    );
  }

  return (
    <DrawingBoard
      key={boardKey}
      fill
      strokes={draft.strokes}
      items={draft.items}
      onChange={onBoard}
      initialTool={tool === "photo" ? "select" : tool === "draw" ? "pen" : "text"}
      autoPhoto={tool === "photo"}
    >
      {({ toolbar, board, selTools }) => (
        <Sheet
          template={draft.template_key}
          full={
            <>
              {board}
              {header}
              {!draft.items.length && !draft.strokes.length && (
                <p className="board-hint hand" aria-hidden="true">
                  T를 누르고 아무 곳이나 눌러 글을 쓰고, ✎로 그 위에 그림을 그려요
                </p>
              )}
            </>
          }
          below={
            <div className="diary-below">
              {toolbar}
              <div className="diary-below-row">
                <div className="tpl-row" role="radiogroup" aria-label="속지 선택">
                  {catalog.templates.map((t) => (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={draft.template_key === t.id}
                      className={`tpl ${draft.template_key === t.id ? "on" : ""}`}
                      onClick={() => patch({ template_key: t.id })}
                      title={t.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/templates/${t.id}_thumb.webp`} alt="" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                {selTools}
                <div className="foot-actions">
                  <button className="btn-primary" onClick={() => void save()} disabled={status === "saving"}>
                    저장
                  </button>
                  {entry && (
                    <button className="btn-ghost danger" onClick={remove}>
                      삭제
                    </button>
                  )}
                  <span className={`save-state s-${status || "idle"}`} role="status">
                    {statusText}
                  </span>
                </div>
              </div>
            </div>
          }
        />
      )}
    </DrawingBoard>
  );
}

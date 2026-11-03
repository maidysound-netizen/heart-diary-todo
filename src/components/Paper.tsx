"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DrawingBoard, type Tool } from "./DrawingBoard";
import { usePaperOrigin, useApp } from "./DiaryApp";
import { api, type PageItem, type Stroke } from "@/lib/client";

export const PAPER_RATIO = 1100 / 1540; // 속지 원본 비율

type Board = { strokes: Stroke[]; items: PageItem[]; onChange: (s: { strokes: Stroke[]; items: PageItem[] }) => void; key: string | number };

/** 화면에 맞는 속지 크기 (아래 도구 모음 자리를 남긴다) */
function usePaperSize(toolsH: number) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const f = () => {
      const H = window.innerHeight - 64 - toolsH - 16;
      const W = window.innerWidth - 24;
      const h = Math.max(320, Math.min(H, W / PAPER_RATIO));
      setSize({ w: Math.round(h * PAPER_RATIO), h: Math.round(h) });
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [toolsH]);
  return size;
}

/** 속지마다 위에 그린 낙서를 불러오고, 바뀌면 잠시 뒤 자동 저장한다 */
export function useDecor(key: string | undefined, guardLeave = true) {
  const { toast, setLeaveGuard } = useApp();
  const [data, setData] = useState<{ strokes: Stroke[]; items: PageItem[] } | null>(null);
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const pending = useRef<{ strokes: Stroke[]; items: PageItem[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    setData(null);
    api<{ page: { drawing_data: { strokes?: Stroke[] } | null; page_layout: { items?: PageItem[] } | null } | null }>(`/api/pages?key=${key}`)
      .then((r) => alive && setData({ strokes: r.page?.drawing_data?.strokes ?? [], items: r.page?.page_layout?.items ?? [] }))
      .catch(() => alive && setData({ strokes: [], items: [] }));
    return () => {
      alive = false;
    };
  }, [key]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const d = pending.current;
    if (!d || !key) return true;
    pending.current = null;
    setState("saving");
    try {
      await api("/api/pages", { method: "PUT", json: { key, drawing_data: { v: 1, strokes: d.strokes }, page_layout: { v: 1, items: d.items } } });
      setState("saved");
      return true;
    } catch (e) {
      pending.current = d;
      setState("error");
      toast(e instanceof Error ? `낙서를 저장하지 못했어요: ${e.message}` : "낙서를 저장하지 못했어요.");
      return false;
    }
  }, [key, toast]);

  useEffect(() => {
    if (!key) return;
    if (guardLeave) setLeaveGuard(async () => (await flush()) || confirm("낙서를 저장하지 못했어요. 그래도 닫을까요?"));
    return () => {
      void flush();
      if (guardLeave) setLeaveGuard(null);
    };
  }, [key, flush, setLeaveGuard, guardLeave]);

  const onChange = useCallback(
    (s: { strokes: Stroke[]; items: PageItem[] }) => {
      pending.current = s;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1200);
    },
    [flush],
  );

  return { data, onChange, state };
}

/**
 * 스티커를 누르면 튀어나오는 속지 한 장.
 * 아래층: 속지 이미지 + 그 칸에 맞춘 기능(content). 위층: 펜·글·스티커를 겹쳐 쓰는 보드.
 * "손" 도구일 때는 보드가 비켜서 아래 기능 칸(체크박스·입력)을 바로 쓸 수 있다.
 */
export function Paper({
  template,
  content,
  pinned,
  decorKey,
  board,
  defaultTool = "hand",
  footer,
  autoPhoto,
  label,
}: {
  template: string;
  /** 속지 칸 위에 놓는 기능 UI (보드 아래층, 손 도구에서 쓸 수 있음) */
  content?: ReactNode;
  /** 항상 보드보다 위에 있는 작은 조작(날짜 넘기기 등) */
  pinned?: ReactNode;
  /** 이 속지 낙서를 따로 저장할 키 (일기처럼 직접 관리하면 board를 넘긴다) */
  decorKey?: string;
  board?: Board;
  defaultTool?: Tool;
  footer?: ReactNode;
  autoPhoto?: boolean;
  label: string;
}) {
  const { go } = useApp();
  const origin = usePaperOrigin();
  const size = usePaperSize(typeof window !== "undefined" && window.innerWidth < 700 ? 132 : 92);
  const decor = useDecor(board ? undefined : decorKey);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !origin) return;
    setFrom({ x: origin.x - (r.left + r.width / 2), y: origin.y - (r.top + r.height / 2) });
    // 처음 튀어나올 때 위치만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => go({ name: "hub" }), 260);
  };

  const b: Board | null = board ?? (decor.data && decorKey ? { strokes: decor.data.strokes, items: decor.data.items, onChange: decor.onChange, key: decorKey } : null);
  const decorState = { "": "", saving: "저장 중…", saved: "자동 저장됨 ♡", error: "저장 실패" }[decor.state];

  const frame = (boardNode: ReactNode, toolbar: ReactNode, selTools: ReactNode) => (
    <div className="paper-layer" role="dialog" aria-label={label}>
      <div className="paper-backdrop" onClick={close} />
      <div className="paper-stage">
        <div
          ref={ref}
          className={`paper ${closing ? "closing" : ""}`}
          style={{ width: size.w, height: size.h, ["--pw" as string]: `${size.w / 100}px`, ["--fx" as string]: `${from.x}px`, ["--fy" as string]: `${from.y}px` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="paper-bg" src={`/templates/${template}.png`} alt="" draggable={false} />
          <div className="paper-content">{content}</div>
          <div className="paper-board">{boardNode}</div>
          <div className="paper-pinned">{pinned}</div>
          <button className="paper-close" onClick={close} aria-label="속지 닫고 하트로 돌아가기">
            ×
          </button>
        </div>
        <div className="paper-tools" style={{ width: Math.max(size.w, Math.min(720, typeof window !== "undefined" ? window.innerWidth - 16 : 720)) }}>
          {toolbar}
          <div className="paper-tools-row">
            {selTools}
            {footer}
            {decorKey && !board && <span className="save-state">{decorState}</span>}
          </div>
        </div>
      </div>
    </div>
  );

  if (!b) return frame(<p className="paper-loading muted">속지를 펼치는 중…</p>, null, null);

  return (
    <DrawingBoard key={b.key} fill handTool strokes={b.strokes} items={b.items} onChange={b.onChange} initialTool={defaultTool} autoPhoto={autoPhoto}>
      {({ toolbar, board: boardNode, selTools }) => frame(boardNode, toolbar, selTools)}
    </DrawingBoard>
  );
}

/** 속지 좌표(0~1)로 절대 배치 */
export function At({ x, y, w, h, children, className, style }: { x: number; y: number; w?: number; h?: number; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`at ${className ?? ""}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: w !== undefined ? `${w * 100}%` : undefined, height: h !== undefined ? `${h * 100}%` : undefined, ...style }}
    >
      {children}
    </div>
  );
}

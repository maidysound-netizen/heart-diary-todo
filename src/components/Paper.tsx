"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DrawingBoard, type Tool } from "./DrawingBoard";
import { useApp } from "./DiaryApp";
import { api, type PageItem, type Stroke } from "@/lib/client";

export const PAPER_RATIO = 1100 / 1540; // 속지 원본 비율

/** 화면에 맞는 속지 크기와 도구 모음 폭 (창 크기는 브라우저에서만 잰다) */
function usePaperSize() {
  const [size, setSize] = useState({ w: 0, h: 0, tw: 0 });
  useEffect(() => {
    const f = () => {
      const narrow = window.innerWidth < 700;
      // 위: 머리줄 + 클립보드 집게, 아래: 도구 모음, 옆(넓은 화면): 잔소리 토끼 자리
      const H = window.innerHeight - 56 - 46 - (narrow ? 96 : 56) - 34;
      const W = window.innerWidth - (window.innerWidth >= 900 ? 300 : 40);
      const h = Math.max(320, Math.min(H, W / PAPER_RATIO));
      const w = Math.round(h * PAPER_RATIO);
      setSize({ w, h: Math.round(h), tw: Math.max(w + 36, Math.min(640, window.innerWidth - 16)) });
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
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
 * 클립보드에 꽂힌 속지 한 장.
 * 아래층: 속지 이미지 + 그 칸에 맞춘 기능(content). 위층: 펜·글을 겹쳐 쓰는 보드.
 * "손" 도구일 때는 보드가 비켜서 아래 기능 칸(체크박스·입력)을 바로 쓸 수 있다.
 */
export function Paper({
  template,
  content,
  pinned,
  decorKey,
  defaultTool = "hand",
  label,
}: {
  template: string;
  /** 속지 칸 위에 놓는 기능 UI (보드 아래층, 손 도구에서 쓸 수 있음) */
  content?: ReactNode;
  /** 항상 보드보다 위에 있는 작은 조작(날짜 넘기기 등) */
  pinned?: ReactNode;
  /** 이 속지 낙서를 따로 저장할 키 */
  decorKey: string;
  defaultTool?: Tool;
  label: string;
}) {
  const size = usePaperSize();
  const decor = useDecor(decorKey);
  const decorState = { "": "", saving: "저장 중…", saved: "자동 저장됨 ♡", error: "저장 실패" }[decor.state];

  const frame = (boardNode: ReactNode, toolbar: ReactNode) => (
    <section className="paper-stage" aria-label={label}>
      <div className="clipboard">
        <span className="clip" aria-hidden="true" />
        <div className="paper" style={{ width: size.w, height: size.h, ["--pw" as string]: `${size.w / 100}px` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="paper-bg" src={`/templates/${template}.png`} alt="" draggable={false} />
          <div className="paper-content">{content}</div>
          <div className="paper-board">{boardNode}</div>
          <div className="paper-pinned">{pinned}</div>
        </div>
      </div>
      <div className="paper-tools" style={{ width: size.tw || undefined }}>
        <div className="paper-tools-row">
          {toolbar}
          <span className="save-state">{decorState}</span>
        </div>
      </div>
    </section>
  );

  if (!decor.data || !size.w) return frame(<p className="paper-loading muted">속지를 펼치는 중…</p>, null);

  return (
    <DrawingBoard key={decorKey} fill handTool strokes={decor.data.strokes} items={decor.data.items} onChange={decor.onChange} initialTool={defaultTool}>
      {({ toolbar, board: boardNode }) => frame(boardNode, toolbar)}
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

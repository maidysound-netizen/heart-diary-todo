"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { Sticker } from "./art";
import { StickerPicker, type Gif } from "./StickerPicker";
import { api, ApiError, uid, type PageItem, type Stroke } from "@/lib/client";

export type Tool = "hand" | "pen" | "hl" | "eraser" | "text" | "select";
/** 보드 좌표는 0~1 정규화. 하트 페이지 전체를 덮을 때는 하트 바운딩 박스 기준이라 기기와 상관없이 같은 자리 */
const DEFAULT_ASPECT = 1.6;

const COLORS = ["#5B3A45", "#E5485F", "#F49AB2", "#F7C35F", "#7BBF6A", "#6FA8DC", "#A98BD9"];
const SIZES = [0.0028, 0.0055, 0.011];
const Z_BASE = { photo: 100, sticker: 200, text: 300 } as const;

type Snapshot = { strokes: Stroke[]; items: PageItem[] };

function drawStroke(c: CanvasRenderingContext2D, s: Stroke, W: number, H: number) {
  const pts = s.pts;
  if (!pts.length) return;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = s.color;
  if (s.tool === "hl") {
    c.globalAlpha = 0.32;
    c.lineWidth = s.size * W * 3.2;
    c.beginPath();
    c.moveTo(pts[0][0] * W, pts[0][1] * H);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * W, my = ((pts[i][1] + pts[i + 1][1]) / 2) * H;
      c.quadraticCurveTo(pts[i][0] * W, pts[i][1] * H, mx, my);
    }
    const l = pts[pts.length - 1];
    c.lineTo(l[0] * W, l[1] * H);
    c.stroke();
  } else {
    // 필압(0..1)에 따라 구간마다 굵기를 바꾼다
    if (pts.length === 1) {
      c.fillStyle = s.color;
      c.beginPath();
      c.arc(pts[0][0] * W, pts[0][1] * H, (s.size * W * (0.4 + pts[0][2] * 1.2)) / 2, 0, Math.PI * 2);
      c.fill();
    }
    let px = pts[0][0] * W, py = pts[0][1] * H;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1, p] = pts[i];
      const mx = ((x0 + x1) / 2) * W, my = ((y0 + y1) / 2) * H;
      c.lineWidth = s.size * W * (0.4 + p * 1.2);
      c.beginPath();
      c.moveTo(px, py);
      c.quadraticCurveTo(x0 * W, y0 * H, mx, my);
      c.stroke();
      px = mx;
      py = my;
    }
    const l = pts[pts.length - 1];
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(l[0] * W, l[1] * H);
    c.stroke();
  }
  c.restore();
}

async function downscale(file: File, max = 720): Promise<{ src: string; ratio: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * k);
    cv.height = Math.round(img.height * k);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return { src: cv.toDataURL("image/jpeg", 0.82), ratio: img.height / img.width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imageRatio(src: string) {
  return new Promise<number>((res) => {
    const img = new Image();
    img.onload = () => res(img.height / img.width || 1);
    img.onerror = () => res(1);
    img.src = src;
  });
}

export function DrawingBoard({
  strokes: initStrokes,
  items: initItems,
  onChange,
  initialTool = "pen",
  autoPhoto,
  onBusy,
  fill,
  handTool,
  children,
}: {
  strokes: Stroke[];
  items: PageItem[];
  onChange: (s: Snapshot) => void;
  initialTool?: Tool;
  autoPhoto?: boolean;
  onBusy?: (busy: boolean) => void;
  /** 부모(하트 페이지)를 꽉 채운다. 없으면 가로:세로 1.6 */
  fill?: boolean;
  /** "손" 도구: 보드를 투명하게 비켜 아래 속지의 기능(체크박스·입력)을 쓸 수 있게 한다 */
  handTool?: boolean;
  /** 도구 모음과 보드를 서로 다른 곳(하트 아래 / 하트 안)에 놓을 때 */
  children?: (parts: { toolbar: ReactNode; board: ReactNode; selTools: ReactNode }) => ReactNode;
}) {
  const [snap, setSnap] = useState<Snapshot>({ strokes: initStrokes, items: initItems });
  const [tool, setTool] = useState<Tool>(initialTool);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [uploading, setUploading] = useState(false);
  const undo = useRef<Snapshot[]>([]);
  const redo = useRef<Snapshot[]>([]);
  const [, bump] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  /** 지금 긋고 있는 선만 그리는 위 캔버스 (저장된 선 전체를 매번 다시 그리지 않도록) */
  const liveRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const live = useRef<Stroke | null>(null);
  const textAt = useRef<readonly [number, number] | null>(null);
  const editOnUp = useRef<string | null>(null);
  const erased = useRef<Set<string> | null>(null);
  const lastPen = useRef(0);
  const dims = useRef({ w: 1, h: 1, dpr: 1 });
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const commit = useCallback(
    (next: Snapshot) => {
      undo.current.push(snapRef.current);
      if (undo.current.length > 60) undo.current.shift();
      redo.current = [];
      setSnap(next);
      onChange(next);
    },
    [onChange],
  );

  const redraw = useCallback((strokes: Stroke[], skip?: Set<string>) => {
    const cv = cvRef.current;
    if (!cv) return;
    const c = cv.getContext("2d")!;
    const { w, h, dpr } = dims.current;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    for (const s of strokes) if (!skip?.has(s.id)) drawStroke(c, s, w, h);
  }, []);

  // CSS 크기·DPR이 바뀌면 캔버스 해상도를 다시 맞추고 정규화 좌표로 다시 그린다
  useLayoutEffect(() => {
    const box = boxRef.current, cv = cvRef.current, lv = liveRef.current;
    if (!box || !cv || !lv) return;
    const fit = () => {
      // 오래된 태블릿에서도 가볍게: 화면 배율은 최대 2배까지만
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dims.current = { w: box.clientWidth, h: box.clientHeight, dpr };
      for (const c of [cv, lv]) {
        c.width = Math.max(1, Math.round(box.clientWidth * dpr));
        c.height = Math.max(1, Math.round(box.clientHeight * dpr));
      }
      redraw(snapRef.current.strokes);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  // 선을 하나 더한 경우는 이미 그려 두었으니 전체를 다시 그리지 않는다
  const skipRedraw = useRef(false);
  useEffect(() => {
    if (skipRedraw.current) {
      skipRedraw.current = false;
      return;
    }
    redraw(snap.strokes);
  }, [snap.strokes, redraw]);

  useEffect(() => {
    if (autoPhoto) setTimeout(() => fileRef.current?.click(), 300);
  }, [autoPhoto]);

  /** 화면 좌표 → 보드 정규화 좌표. 3D/CSS 확대 배율이 달라도 같은 위치가 되도록 실제 렌더 크기로 나눈다. */
  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as const;
  };

  const aspect = () => (dims.current.h > 1 ? dims.current.w / dims.current.h : DEFAULT_ASPECT);

  /** 그리기는 화면 한 프레임에 한 번만 (펜 신호가 아무리 많이 와도) */
  const schedule = (fn: () => void) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(fn);
  };

  const paintLive = () => {
    const lv = liveRef.current, s = live.current;
    if (!lv) return;
    const c = lv.getContext("2d")!;
    const { w, h, dpr } = dims.current;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    if (s) drawStroke(c, s, w, h);
  };

  const eraseAt = (x: number, y: number) => {
    const rad = 0.025;
    let hit = false;
    for (const s of snapRef.current.strokes) {
      if (erased.current!.has(s.id)) continue;
      if (s.pts.some(([px, py]) => Math.hypot(px - x, (py - y) / aspect()) < rad)) {
        erased.current!.add(s.id);
        hit = true;
      }
    }
    if (hit) {
      const gone = erased.current!;
      schedule(() => redraw(snapRef.current.strokes, gone));
    }
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "select") {
      setSel(null);
      setEditing(null);
      return;
    }
    if (tool === "text") {
      // 글쓰기: 손을 뗄 때 그 자리에 글상자가 생긴다 (아이패드는 손을 뗄 때 포커스해야 키보드가 뜬다)
      e.preventDefault(); // 보드가 포커스를 가져가 새 글상자가 바로 닫히지 않도록
      if (editing) return setEditing(null);
      textAt.current = toLocal(e);
      return;
    }
    if (e.pointerType === "pen") lastPen.current = Date.now();
    else if (e.pointerType === "touch" && Date.now() - lastPen.current < 1500) return; // 손바닥 무시
    if (e.button > 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toLocal(e);
    if (tool === "eraser" || (e.pointerType === "pen" && (e.buttons & 32) !== 0)) {
      erased.current = new Set();
      eraseAt(x, y);
      return;
    }
    const p = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    live.current = { id: uid(), tool: tool === "hl" ? "hl" : "pen", color, size: SIZES[size], pts: [[x, y, p]] };
    onBusy?.(true);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (erased.current) {
      for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) eraseAt(...toLocal(ev));
      return;
    }
    const s = live.current;
    if (!s) return;
    if (e.pointerType === "pen") lastPen.current = Date.now();
    const evs = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evs) {
      const [x, y] = toLocal(ev);
      const last = s.pts[s.pts.length - 1];
      if (Math.abs(last[0] - x) + Math.abs(last[1] - y) < 0.0008) continue;
      s.pts.push([+x.toFixed(4), +y.toFixed(4), +(ev.pointerType === "pen" ? ev.pressure || 0.5 : 0.5).toFixed(2)]);
    }
    schedule(paintLive);
  };

  const onUp = () => {
    const ta = textAt.current;
    if (ta) {
      textAt.current = null;
      const [x, y] = ta;
      let id = "";
      flushSync(() => {
        id = addItem({ kind: "text", text: "", color, x: Math.min(x, 0.8), y: Math.max(0, y - 0.02), w: Math.max(0.15, Math.min(0.32, 0.95 - x)), h: 0.07 }, true).id;
        setEditing(id);
      });
      boxRef.current?.querySelector<HTMLTextAreaElement>(`[data-item="${id}"] textarea`)?.focus();
      return;
    }
    if (erased.current) {
      const gone = erased.current;
      erased.current = null;
      if (gone.size) commit({ ...snapRef.current, strokes: snapRef.current.strokes.filter((s) => !gone.has(s.id)) });
      return;
    }
    const s = live.current;
    live.current = null;
    onBusy?.(false);
    cancelAnimationFrame(raf.current);
    if (s) {
      // 다 그은 선을 아래 캔버스에 한 번 얹고 위 캔버스는 비운다
      const c = cvRef.current?.getContext("2d");
      if (c) {
        const { w, h, dpr } = dims.current;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawStroke(c, s, w, h);
      }
      paintLive();
      skipRedraw.current = true;
      commit({ ...snapRef.current, strokes: [...snapRef.current.strokes, s] });
    }
  };

  const maxZ = (kind: PageItem["kind"]) =>
    Math.max(Z_BASE[kind], ...snapRef.current.items.filter((i) => i.kind === kind).map((i) => i.z)) + 1;

  const addItem = (it: Omit<PageItem, "id" | "z" | "rot"> & { rot?: number }, keepTool = false) => {
    const item: PageItem = { rot: 0, ...it, id: uid(), z: maxZ(it.kind) };
    commit({ ...snapRef.current, items: [...snapRef.current.items, item] });
    if (!keepTool) setTool("select");
    setSel(item.id);
    return item;
  };

  const addSticker = (key: string) => {
    setPalette(false);
    const w = 0.12;
    addItem({ kind: "sticker", key, x: 0.42 + Math.random() * 0.1, y: 0.35 + Math.random() * 0.1, w, h: w * aspect(), rot: Math.round(Math.random() * 20 - 10) });
  };

  /** GIPHY 스티커는 이미지 주소만 저장한다 (파일을 따로 보관하지 않음) */
  const addGif = (g: Gif) => {
    setPalette(false);
    const w = 0.2;
    addItem({ kind: "sticker", src: g.url, x: 0.4 + Math.random() * 0.1, y: 0.35 + Math.random() * 0.1, w, h: w * aspect() * (g.h / g.w), rot: Math.round(Math.random() * 16 - 8) });
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return alert("JPG, PNG, WEBP 사진만 올릴 수 있어요.");
    if (file.size > 4 * 1024 * 1024) return alert("사진은 4MB 이하만 올릴 수 있어요.");
    setUploading(true);
    try {
      let src: string, ratio: number;
      try {
        const fd = new FormData();
        fd.append("file", file);
        src = (await api<{ url: string }>("/api/photos/upload", { method: "POST", body: fd })).url;
        ratio = await imageRatio(src);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 501) throw e;
        // 사진 저장소가 연결되지 않은 환경: 작게 줄인 사본을 페이지에 함께 저장
        ({ src, ratio } = await downscale(file));
      }
      const w = 0.26;
      addItem({ kind: "photo", src, x: 0.18 + Math.random() * 0.1, y: 0.3, w, h: Math.min(0.6, w * aspect() * ratio), rot: -3 });
    } catch (e) {
      alert(e instanceof Error ? e.message : "사진을 올리지 못했어요.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const update = (id: string, patch: Partial<PageItem>, record = true) => {
    const items = snapRef.current.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    if (record) commit({ ...snapRef.current, items });
    else setSnap({ ...snapRef.current, items });
  };

  const remove = (id: string) => {
    commit({ ...snapRef.current, items: snapRef.current.items.filter((i) => i.id !== id) });
    setSel(null);
    setEditing(null);
  };

  const reorder = (id: string, dir: 1 | -1) => {
    const it = snapRef.current.items.find((i) => i.id === id);
    if (!it) return;
    const same = snapRef.current.items.filter((i) => i.kind === it.kind).sort((a, b) => a.z - b.z);
    const idx = same.findIndex((i) => i.id === id);
    const other = same[idx + dir];
    if (!other) return;
    commit({
      ...snapRef.current,
      items: snapRef.current.items.map((i) => (i.id === id ? { ...i, z: other.z } : i.id === other.id ? { ...i, z: it.z } : i)),
    });
  };

  // 개체 끌기/크기·각도 조절 — 선택 도구뿐 아니라 기본 손 도구에서도 바로 된다
  const grab = tool === "select" || tool === "hand";
  const drag = useRef<{
    id: string;
    mode: "move" | "resize" | "rotate" | "box";
    sx: number;
    sy: number;
    start: PageItem;
    before: Snapshot;
    fs0: number;
    cx: number;
    cy: number;
  } | null>(null);
  const onItemDown = (e: React.PointerEvent, it: PageItem, mode0: "move" | "resize" | "rotate" | "box") => {
    // Shift를 누른 채 모서리를 끌면 글자 크기는 그대로 두고 상자만 늘이고 줄인다
    const mode = mode0 === "resize" && e.shiftKey ? "box" : mode0;
    if (tool === "text" && it.kind === "text" && mode === "move") {
      e.stopPropagation();
      editOnUp.current = it.id;
      return;
    }
    if (!grab || editing === it.id) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(it.id);
    const [sx, sy] = toLocal(e);
    const el = boxRef.current?.querySelector<HTMLElement>(`[data-item="${it.id}"]`);
    const r = el?.getBoundingClientRect();
    let fs0 = it.fs ?? 0;
    if (!fs0 && it.kind === "text") {
      const body = el?.querySelector<HTMLElement>(".text-body");
      const bw = boxRef.current?.clientWidth || 1;
      fs0 = body ? parseFloat(getComputedStyle(body).fontSize) / bw : 0.04;
    }
    drag.current = {
      id: it.id, mode, sx, sy, start: it, before: snapRef.current, fs0,
      cx: r ? r.left + r.width / 2 : 0,
      cy: r ? r.top + r.height / 2 : 0,
    };
  };
  const onItemMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "rotate") {
      let deg = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      deg = ((deg + 540) % 360) - 180;
      const snapTo = Math.round(deg / 45) * 45;
      if (Math.abs(deg - snapTo) < 4) deg = snapTo; // 반듯한 각도에 살짝 붙음
      update(d.id, { rot: Math.round(deg) }, false);
      return;
    }
    const [x, y] = toLocal(e);
    const dx = x - d.sx, dy = y - d.sy;
    if (d.mode === "box") {
      update(d.id, { w: Math.min(1.2, Math.max(0.05, d.start.w + dx)), h: Math.min(1.2, Math.max(0.04, d.start.h + dy)) }, false);
      return;
    }
    if (d.mode === "move") {
      update(d.id, { x: Math.min(0.98, Math.max(-0.2, d.start.x + dx)), y: Math.min(0.98, Math.max(-0.2, d.start.y + dy)) }, false);
    } else {
      // 모서리를 끌면 비율 그대로 커지고 작아짐 — 글상자는 글자 크기도 같이
      const w = Math.min(1.2, Math.max(0.05, d.start.w + dx));
      const k = w / d.start.w;
      if (d.start.kind === "text") {
        const fs = Math.min(0.2, Math.max(0.012, d.fs0 * k));
        const kk = fs / d.fs0;
        update(d.id, { w: d.start.w * kk, h: d.start.h * kk, fs }, false);
      } else update(d.id, { w, h: d.start.h * k }, false);
    }
  };
  const onItemUp = () => {
    const eid = editOnUp.current;
    if (eid) {
      editOnUp.current = null;
      flushSync(() => setEditing(eid));
      boxRef.current?.querySelector<HTMLTextAreaElement>(`[data-item="${eid}"] textarea`)?.focus();
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const now = snapRef.current;
    if (now !== d.before) {
      undo.current.push(d.before);
      redo.current = [];
      onChange(now);
      bump((n) => n + 1);
    }
  };

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(snapRef.current);
    setSnap(prev);
    onChange(prev);
  }, [onChange]);
  const doRedo = useCallback(() => {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(snapRef.current);
    setSnap(next);
    onChange(next);
  }, [onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel && boxRef.current?.contains(document.activeElement ?? null)) {
        e.preventDefault();
        remove(sel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, doUndo, doRedo]);

  const selected = snap.items.find((i) => i.id === sel);

  const toolbar = (
      <div className="board-tools" role="toolbar" aria-label="그리기 도구">
        {(
          [
            ...(handTool ? ([["hand", "손 — 속지 칸 쓰기", "✋"]] as const) : []),
            ["pen", "펜", "✎"],
            ["hl", "형광펜", "▍"],
            ["eraser", "지우개", "⌫"],
            ["text", "글쓰기 (누른 자리에 글상자)", "T"],
            ["select", "선택·이동", "⤧"],
          ] as const
        ).map(([k, label, ic]) => (
          <button key={k} className={`tool ${tool === k ? "on" : ""}`} onClick={() => setTool(k)} aria-pressed={tool === k} title={label}>
            <span aria-hidden="true">{ic}</span>
            <span className="sr">{label}</span>
          </button>
        ))}
        <span className="sep" />
        {COLORS.map((c) => (
          <button key={c} className={`swatch ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`색 ${c}`} aria-pressed={color === c} />
        ))}
        <span className="sep" />
        {SIZES.map((_, i) => (
          <button key={i} className={`tool size ${size === i ? "on" : ""}`} onClick={() => setSize(i)} aria-label={`굵기 ${i + 1}`} aria-pressed={size === i}>
            <span style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
          </button>
        ))}
        <span className="sep" />
        <button className="tool" onClick={doUndo} disabled={!undo.current.length} title="되돌리기">↶<span className="sr">되돌리기</span></button>
        <button className="tool" onClick={doRedo} disabled={!redo.current.length} title="다시 실행">↷<span className="sr">다시 실행</span></button>
        <span className="sep" />
        <div className="pop-wrap">
          <button className={`tool ${palette ? "on" : ""}`} onClick={() => setPalette((v) => !v)} aria-expanded={palette} title="스티커">
            ♡<span className="sr">스티커</span>
          </button>
          {palette && <StickerPicker onSticker={addSticker} onGif={addGif} />}
        </div>
        <button className="tool" onClick={() => fileRef.current?.click()} disabled={uploading} title="사진">
          {uploading ? "…" : "▣"}
          <span className="sr">사진</span>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>
  );

  // 스크롤·화면 크기가 바뀌면 바깥 층 손잡이 위치를 다시 계산
  useEffect(() => {
    if (!sel || !grab) return;
    const re = () => bump((n) => n + 1);
    // 개체·손잡이·선택 메뉴 밖을 누르면 선택 해제 (손 도구에서는 빈 곳이 아래 층이라 보드가 못 받음)
    const off = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-item], .handle, .sel-tools, .board-tools")) return;
      setSel(null);
    };
    document.addEventListener("pointerdown", off, true);
    window.addEventListener("scroll", re, true);
    window.addEventListener("resize", re);
    return () => {
      window.removeEventListener("scroll", re, true);
      window.removeEventListener("resize", re);
      document.removeEventListener("pointerdown", off, true);
    };
  }, [sel, grab]);

  // 선택 손잡이는 하트 모양으로 잘리지 않게 화면 맨 위 층(body)에 따로 그린다
  let handles: ReactNode = null;
  const selItem = sel ? snap.items.find((i) => i.id === sel) : undefined;
  const br = boxRef.current?.getBoundingClientRect();
  if (selItem && grab && editing !== selItem.id && br && typeof document !== "undefined") {
    const cx = br.left + (selItem.x + selItem.w / 2) * br.width;
    const cy = br.top + (selItem.y + selItem.h / 2) * br.height;
    const hw = (selItem.w * br.width) / 2, hh = (selItem.h * br.height) / 2;
    const a = (selItem.rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    const at = (dx: number, dy: number) => ({ left: cx + dx * cos - dy * sin, top: cy + dx * sin + dy * cos });
    const pp = { onPointerMove: onItemMove, onPointerUp: onItemUp, onPointerCancel: onItemUp };
    handles = createPortal(
      <>
        <span className="handle rot" style={at(0, -hh - 30)} onPointerDown={(e) => onItemDown(e, selItem, "rotate")} {...pp} title="돌리기">
          ⟳
        </span>
        <span className="handle" style={at(hw, hh)} onPointerDown={(e) => onItemDown(e, selItem, "resize")} {...pp} title="크기" />
        {selItem.kind === "text" && (
          <span className="handle box" style={at(0, hh + 4)} onPointerDown={(e) => onItemDown(e, selItem, "box")} {...pp} title="글상자 넓이만 (Shift+모서리 끌기도 같아요)" />
        )}
      </>,
      document.body,
    );
  }

  const board = (
      <div
        ref={boxRef}
        className={`board tool-${tool} ${fill ? "fill" : ""}`}
        data-hand={tool === "hand" || undefined}
        style={fill ? undefined : { aspectRatio: String(DEFAULT_ASPECT) }}
        tabIndex={0}
        aria-label="그림·스티커·사진을 놓는 페이지"
      >
        <canvas
          ref={cvRef}
          className="board-canvas"
          style={tool === "hand" ? { pointerEvents: "none" } : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <canvas ref={liveRef} className="board-canvas live" aria-hidden="true" />
        {snap.items.map((it) => (
          <div
            key={it.id}
            data-item={it.id}
            className={`item item-${it.kind} ${sel === it.id ? "sel" : ""}`}
            style={{
              left: `${it.x * 100}%`,
              top: `${it.y * 100}%`,
              width: `${it.w * 100}%`,
              height: `${it.h * 100}%`,
              transform: `rotate(${it.rot}deg)`,
              zIndex: it.z,
              pointerEvents: grab || (tool === "text" && it.kind === "text") ? "auto" : "none",
            }}
            onPointerDown={(e) => onItemDown(e, it, "move")}
            onPointerMove={onItemMove}
            onPointerUp={onItemUp}
            onDoubleClick={() => it.kind === "text" && setEditing(it.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.kind === "sticker" && (it.src ? <img src={it.src} alt="GIPHY 스티커" draggable={false} /> : <Sticker k={it.key!} />)}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.kind === "photo" && <img src={it.src} alt="붙인 사진" draggable={false} />}
            {it.kind === "text" &&
              (editing === it.id ? (
                <textarea
                  ref={(el) => {
                    if (el && document.activeElement !== el) requestAnimationFrame(() => el.focus());
                  }}
                  defaultValue={it.text}
                  style={{ color: it.color, fontSize: it.fs ? `${it.fs * 100}cqw` : undefined }}
                  placeholder="글을 써 보세요"
                  maxLength={500}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    setEditing(null);
                    if (!e.target.value.trim()) remove(it.id);
                    else if (e.target.value !== it.text) update(it.id, { text: e.target.value });
                  }}
                />
              ) : (
                <div className="text-body" style={{ color: it.color, fontSize: it.fs ? `${it.fs * 100}cqw` : undefined }}>
                  {it.text}
                </div>
              ))}
          </div>
        ))}
        {handles}
      </div>
  );

  const selTools = selected && grab && (
        <div className="sel-tools">
          <button onClick={() => reorder(selected.id, 1)}>앞으로</button>
          <button onClick={() => reorder(selected.id, -1)}>뒤로</button>
          <button onClick={() => update(selected.id, { rot: ((selected.rot + 15 + 180) % 360) - 180 })}>회전</button>
          {selected.kind === "text" && <button onClick={() => setEditing(selected.id)}>글 수정</button>}
          <button className="danger" onClick={() => remove(selected.id)}>삭제</button>
        </div>
  );

  if (children) return <>{children({ toolbar, board, selTools })}</>;
  return (
    <div className="board-wrap">
      {toolbar}
      {board}
      {selTools}
    </div>
  );
}

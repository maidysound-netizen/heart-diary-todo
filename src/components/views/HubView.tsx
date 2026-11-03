"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, useApp } from "../DiaryApp";
import { FeatureIcon } from "../art";
import { FEATURES, FEATURE_ORDER } from "../features";
import { DrawingBoard } from "../DrawingBoard";
import { useDecor } from "../Paper";
import { insideHeart } from "@/lib/heart";
import { uid, type HubSticker } from "@/lib/client";

const MAX_PAGES = 12;
const MAX_STICKERS = 24;

function StickerFace({ kind }: { kind: string }) {
  const f = FEATURES[kind];
  return (
    <>
      <span className="feat-tape" aria-hidden="true" />
      <span className="feat-icon">
        <FeatureIcon kind={kind} />
      </span>
      <span className="feat-label">{f?.label ?? kind}</span>
    </>
  );
}

/**
 * 첫 펼침 = 기본 화면: 하트 한 장이 스티커 판이자 그리기 판.
 * ✋ 손 도구로 기능 스티커를 붙이고 누르고, ✎·T로 그 위에 낙서·글을 쓴다. 장마다 따로 저장된다.
 */
export function HubView({ inert }: { inert?: boolean }) {
  const { hub, setHub, hubPage, turnHub, go, openChat, toast } = useApp();
  const boardRef = useRef<HTMLDivElement>(null);
  const page = hub.pages[hubPage];
  const decor = useDecor(`hub:${page.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "p1"}`, false);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<{ kind: string; x: number; y: number } | null>(null);
  const press = useRef<{ id?: string; kind?: string; sx: number; sy: number; moved: boolean } | null>(null);

  const toLocal = (cx: number, cy: number) => {
    const r = boardRef.current!.getBoundingClientRect();
    return { u: (cx - r.left) / r.width, v: (cy - r.top) / r.height };
  };

  const updatePage = (stickers: HubSticker[]) =>
    setHub({ ...hub, pages: hub.pages.map((p, i) => (i === hubPage ? { ...p, stickers } : p)) });

  const addSticker = (kind: string, u?: number, v?: number) => {
    if (page.stickers.length >= MAX_STICKERS) return toast("한 장에는 스티커를 24개까지 붙일 수 있어요.");
    // 자리를 안 정했으면 하트 가운데 근처 빈 곳을 찾는다
    let x = u, y = v;
    for (let i = 0; x === undefined && i < 40; i++) {
      const cx = 0.22 + Math.random() * 0.56, cy = 0.3 + Math.random() * 0.4;
      if (insideHeart(cx, cy, 0.08) && page.stickers.every((s) => Math.hypot(s.x - cx, s.y - cy) > 0.12)) {
        x = cx;
        y = cy;
      }
    }
    updatePage([...page.stickers, { id: uid(), kind, x: x ?? 0.5, y: y ?? 0.5, rot: Math.round(Math.random() * 14 - 7) }]);
  };

  const open = (kind: string) => {
    const to = FEATURES[kind]?.to;
    if (!to) return;
    if (to === "chat") openChat();
    else go(to);
  };

  // 붙인 스티커: 누르면 열고, 끌면 옮기고, 하트 밖으로 끌어내면 떼어낸다
  const onStickerDown = (e: React.PointerEvent, s: HubSticker) => {
    if (e.button > 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    press.current = { id: s.id, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onStickerMove = (e: React.PointerEvent, s: HubSticker) => {
    const p = press.current;
    if (!p || p.id !== s.id) return;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return;
    p.moved = true;
    const { u, v } = toLocal(e.clientX, e.clientY);
    setDragPos({ id: s.id, x: u, y: v });
  };
  const onStickerUp = (e: React.PointerEvent, s: HubSticker) => {
    const p = press.current;
    press.current = null;
    setDragPos(null);
    if (!p || p.id !== s.id) return;
    if (!p.moved) return open(s.kind);
    const { u, v } = toLocal(e.clientX, e.clientY);
    if (!insideHeart(u, v, 0.02)) {
      updatePage(page.stickers.filter((x) => x.id !== s.id));
      toast(`${FEATURES[s.kind]?.label ?? "스티커"} 스티커를 떼어냈어요.`);
    } else {
      updatePage(page.stickers.map((x) => (x.id === s.id ? { ...x, x: u, y: v } : x)));
    }
  };

  // 트레이 스티커: 하트 위로 끌어다 놓으면 붙는다 (그냥 누르면 빈 자리에 붙는다)
  const onTrayDown = (e: React.PointerEvent, kind: string) => {
    if (e.button > 0) return;
    e.preventDefault();
    press.current = { kind, sx: e.clientX, sy: e.clientY, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p?.kind) return;
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return;
      p.moved = true;
      setGhost({ kind: p.kind, x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      if (!p?.kind) return;
      press.current = null;
      setGhost(null);
      if (!p.moved) return addSticker(p.kind);
      const { u, v } = toLocal(e.clientX, e.clientY);
      if (insideHeart(u, v, 0.03)) addSticker(p.kind, u, v);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const next = () => {
    if (hubPage < hub.pages.length - 1) return turnHub(hubPage + 1);
    if (hub.pages.length >= MAX_PAGES) return toast("스티커 판은 12장까지 만들 수 있어요.");
    setHub({ ...hub, pages: [...hub.pages, { id: uid(), stickers: [] }] });
    turnHub(hubPage + 1);
  };

  const removePage = () => {
    if (hubPage === 0) return;
    setHub({ ...hub, pages: hub.pages.filter((_, i) => i !== hubPage) });
    turnHub(hubPage - 1);
  };

  if (!decor.data) return null;

  return (
    <DrawingBoard key={page.id} fill handTool strokes={decor.data.strokes} items={decor.data.items} onChange={decor.onChange} initialTool="hand">
      {({ toolbar, board, selTools }) => (
    <div className={inert ? "hub-inert" : undefined} inert={inert || undefined}>
      <Sheet
        full={
          <>
          <div ref={boardRef} className="hub-board">
            {!page.stickers.length && (
              <p className="hub-empty hand">
                빈 페이지예요 ♡<br />
                아래 스티커를 끌어다 붙여 보세요
              </p>
            )}
            {page.stickers.map((s) => {
              const pos = dragPos?.id === s.id ? dragPos : s;
              const f = FEATURES[s.kind];
              return (
                <div
                  key={s.id}
                  className={`placed ${dragPos?.id === s.id ? "dragging" : ""}`}
                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, ["--rot" as string]: `${s.rot}deg`, ["--c" as string]: f?.color }}
                >
                  <button
                    className="feat"
                    onPointerDown={(e) => onStickerDown(e, s)}
                    onPointerMove={(e) => onStickerMove(e, s)}
                    onPointerUp={(e) => onStickerUp(e, s)}
                    onPointerCancel={() => {
                      press.current = null;
                      setDragPos(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(s.kind);
                      } else if (e.key === "Delete" || e.key === "Backspace") {
                        updatePage(page.stickers.filter((x) => x.id !== s.id));
                      }
                    }}
                    aria-label={`${f?.label ?? s.kind} 페이지 열기 (끌어서 옮기기, 하트 밖으로 끌면 떼기)`}
                  >
                    <StickerFace kind={s.kind} />
                  </button>
                  <button className="unstick" onClick={() => updatePage(page.stickers.filter((x) => x.id !== s.id))} aria-label="스티커 떼기">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hub-draw">{board}</div>
          </>
        }
        extras={
          <>
            {hubPage > 0 && (
              <button className="page-arrow prev" onClick={() => turnHub(hubPage - 1)} aria-label="이전 장">
                ↙ <span className="hand">Prev</span>
              </button>
            )}
            <button className="page-arrow next" onClick={next} aria-label={hubPage < hub.pages.length - 1 ? "다음 장" : "새 장 만들기"}>
              <span className="hand">{hubPage < hub.pages.length - 1 ? "Next page" : "New page"}</span> ↘
            </button>
          </>
        }
        below={
          <div className="tray-wrap">
            <div className="hub-tools">
              {toolbar}
              {selTools}
              <span className="save-state">{{ "": "", saving: "저장 중…", saved: "낙서 저장됨 ♡", error: "저장 실패" }[decor.state]}</span>
            </div>
            <div className="tray-head">
              <span className="hand">스티커 시트</span>
              <span className="muted small">✋ 손으로 하트 위에 끌어다 붙이고 누르면 속지가 나와요 · ✎ T로 그 위에 낙서해요</span>
              <span className="page-no">
                {hubPage + 1} / {hub.pages.length}
                {hubPage > 0 && !page.stickers.length && (
                  <button className="link small" onClick={removePage}>
                    이 장 지우기
                  </button>
                )}
              </span>
            </div>
            <div className="tray" role="list" aria-label="붙일 수 있는 스티커">
              {FEATURE_ORDER.map((k) => (
                <button
                  key={k}
                  role="listitem"
                  className="feat tray-item"
                  style={{ ["--c" as string]: FEATURES[k].color, ["--rot" as string]: "0deg" }}
                  onPointerDown={(e) => onTrayDown(e, k)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      addSticker(k);
                    }
                  }}
                  title={`${FEATURES[k].label} — ${FEATURES[k].sub}`}
                  aria-label={`${FEATURES[k].label} 스티커 붙이기`}
                >
                  <StickerFace kind={k} />
                </button>
              ))}
            </div>
          </div>
        }
      />
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y, ["--c" as string]: FEATURES[ghost.kind]?.color }} aria-hidden="true">
          <div className="feat">
            <StickerFace kind={ghost.kind} />
          </div>
        </div>
      )}
    </div>
      )}
    </DrawingBoard>
  );
}

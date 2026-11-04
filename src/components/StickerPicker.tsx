"use client";

import { useEffect, useRef, useState } from "react";
import { STICKERS, Sticker } from "./art";
import { api } from "@/lib/client";

export type Gif = { id: string; url: string; w: number; h: number; title: string };

/** 스티커 고르기: 모모 스티커팩 + GIPHY 스티커 검색 */
export function StickerPicker({ onSticker, onGif }: { onSticker: (key: string) => void; onGif: (g: Gif) => void }) {
  const [tab, setTab] = useState<"momo" | "giphy">("momo");
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [error, setError] = useState("");
  const req = useRef(0);

  useEffect(() => {
    if (tab !== "giphy") return;
    const n = ++req.current;
    const t = setTimeout(
      () => {
        setError("");
        api<{ gifs: Gif[] }>(`/api/giphy?q=${encodeURIComponent(q.trim())}`)
          .then((r) => n === req.current && setGifs(r.gifs))
          .catch((e) => n === req.current && (setGifs([]), setError(e instanceof Error ? e.message : "불러오지 못했어요.")));
      },
      q ? 400 : 0,
    );
    return () => clearTimeout(t);
  }, [tab, q]);

  return (
    <div className="sticker-pop picker" role="dialog" aria-label="스티커 고르기">
      <div className="picker-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "momo"} className={tab === "momo" ? "on" : ""} onClick={() => setTab("momo")}>
          모모 스티커
        </button>
        <button role="tab" aria-selected={tab === "giphy"} className={tab === "giphy" ? "on" : ""} onClick={() => setTab("giphy")}>
          GIPHY
        </button>
      </div>
      {tab === "momo" ? (
        <div className="picker-grid">
          {Object.entries(STICKERS).map(([k, s]) => (
            <button key={k} onClick={() => onSticker(k)} title={s.label} aria-label={s.label}>
              <Sticker k={k} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <input
            className="picker-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="검색 (예: bunny, heart, 화이팅)"
            aria-label="GIPHY 스티커 검색"
            maxLength={50}
          />
          <div className="picker-gifs">
            {gifs === null && <p className="muted small">불러오는 중…</p>}
            {error && <p className="error small">{error}</p>}
            {gifs?.length === 0 && !error && <p className="muted small">찾은 스티커가 없어요</p>}
            {gifs?.map((g) => (
              <button key={g.id} onClick={() => onGif(g)} title={g.title} aria-label={g.title || "GIPHY 스티커"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <p className="giphy-credit">Powered by GIPHY</p>
        </>
      )}
    </div>
  );
}

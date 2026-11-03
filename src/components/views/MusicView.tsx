"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "../DiaryApp";
import { At, Paper } from "../Paper";
import { api, type MusicLink } from "@/lib/client";

/** 알려진 음악 서비스 링크를 공식 임베드 플레이어 주소로 바꾼다. 모르는 주소는 링크로만 보여준다 */
export function embedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  if (host === "youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
    if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    const list = u.searchParams.get("list");
    if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
  }
  if (host === "open.spotify.com") {
    const m = u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|artist)\/(\w+)/);
    if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
  }
  if (host === "soundcloud.com") return `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&color=%23e8a6b5`;
  return null;
}

export function MusicView() {
  const { toast } = useApp();
  const [links, setLinks] = useState<MusicLink[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ links: MusicLink[] }>("/api/music");
      setLinks(r.links);
      setSel((s) => s ?? r.links[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      const r = await api<{ link: MusicLink }>("/api/music", { method: "POST", json: { url: url.trim(), title } });
      setLinks((l) => [r.link, ...l]);
      setSel(r.link.id);
      setUrl("");
      setTitle("");
      toast("음악을 붙였어요 🎵");
    } catch (err) {
      toast(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: MusicLink) => {
    if (!confirm(`「${l.title || l.url}」 링크를 뗄까요?`)) return;
    try {
      await api(`/api/music/${l.id}`, { method: "DELETE" });
      setLinks((x) => x.filter((y) => y.id !== l.id));
      if (sel === l.id) setSel(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "삭제하지 못했어요.");
    }
  };

  const cur = links.find((l) => l.id === sel);
  const embed = cur && embedUrl(cur.url);

  return (
    <Paper
      label="Music"
      template="04_dots"
      decorKey="music"
      content={
        <>
        <At x={0.1} y={0.17} w={0.8} h={0.36} className="music paper-panel">
          <h2 className="hand">♪ Music</h2>
          <form className="todo-form" onSubmit={add}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube · Spotify · SoundCloud 링크" aria-label="음악 링크" type="url" required maxLength={500} />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (선택)" aria-label="제목" maxLength={120} />
            <button className="btn-primary sm" disabled={saving}>{saving ? "붙이는 중…" : "붙이기"}</button>
          </form>
          {loading ? (
            <p className="muted">불러오는 중…</p>
          ) : error ? (
            <p className="error">{error}</p>
          ) : links.length ? (
            <ul className="music-list">
              {links.map((l) => (
                <li key={l.id} className={l.id === sel ? "on" : ""}>
                  <button className="music-item" onClick={() => setSel(l.id)}>
                    ♪ {l.title || new URL(l.url).hostname}
                  </button>
                  <button className="icon-btn sm" onClick={() => remove(l)} aria-label="링크 떼기">×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty hand">좋아하는 노래 링크를 붙여 보세요</p>
          )}
        </At>
        <At x={0.1} y={0.55} w={0.8} h={0.36} className="music paper-panel">
          {cur ? (
            <>
              <h3 className="hand">{cur.title || "지금 듣는 노래"}</h3>
              {embed ? (
                <iframe
                  className="music-player"
                  src={embed}
                  title={cur.title || "음악 플레이어"}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <p className="muted small">이 사이트는 바로 재생할 수 없어서 링크로 열어요.</p>
              )}
              <a className="link small" href={cur.url} target="_blank" rel="noopener noreferrer">
                원래 페이지에서 열기 ↗
              </a>
            </>
          ) : (
            <p className="empty hand">왼쪽에서 노래를 골라요</p>
          )}
        </At>
        </>
      }
    />
  );
}

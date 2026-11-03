"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "./DiaryApp";
import { api } from "@/lib/client";

type Msg = { from: "me" | "momo"; text: string };
const ASK: [string, string][] = [
  ["today", "오늘 할 일은?"],
  ["week", "이번 주 일정"],
  ["cheer", "응원해줘"],
  ["nag", "귀여운 잔소리"],
];

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?「」:()/]/gu, ""));
  u.lang = "ko-KR";
  u.pitch = 1.4;
  speechSynthesis.speak(u);
}

export function ChatBubble({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "momo", text: "안녕! 나는 리본 토끼 모모야 🎀 무엇을 도와줄까?" }]);
  const [busy, setBusy] = useState(false);
  const [nag, setNag] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(async (intent: string, label?: string) => {
    if (label) setMsgs((m) => [...m, { from: "me", text: label }]);
    setBusy(true);
    try {
      const r = await api<{ reply: string; speak?: boolean }>("/api/chat", { method: "POST", json: { intent, tz: new Date().getTimezoneOffset() } });
      return r;
    } catch (e) {
      return { reply: e instanceof Error ? `앗, ${e.message}` : "앗, 지금은 대답하기 어려워…", speak: false };
    } finally {
      setBusy(false);
    }
  }, []);

  const onAsk = async (intent: string, label: string) => {
    const r = await ask(intent, label);
    setMsgs((m) => [...m, { from: "momo", text: r.reply }]);
    if (settings.voice_enabled) speak(r.reply);
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: 1e6, behavior: "smooth" });
  }, [msgs]);

  // 잔소리 모드: 페이지를 열어 둔 동안 10분마다 확인 (사용자가 켠 경우에만)
  useEffect(() => {
    if (!settings.nagging_mode) return;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await api<{ reply: string; speak?: boolean }>("/api/chat", { method: "POST", json: { intent: "nag", tz: new Date().getTimezoneOffset() } });
        if (r.speak) {
          setNag(r.reply);
          if (settings.voice_enabled) speak(r.reply);
        }
      } catch {}
    };
    const first = setTimeout(check, 20_000);
    const t = setInterval(check, 10 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [settings.nagging_mode, settings.voice_enabled]);

  return (
    <>
      {nag && !open && (
        <div className="nag-bubble" role="status">
          {nag}
          <button className="icon-btn sm" onClick={() => setNag("")} aria-label="닫기">×</button>
        </div>
      )}
      {open && (
        <div className="chat" role="dialog" aria-label="마스코트 모모와 대화">
          <div className="chat-head">
            <b className="hand">모모 🐰</b>
            <button className="icon-btn sm" onClick={onClose} aria-label="닫기">×</button>
          </div>
          <div className="chat-list" ref={listRef}>
            {msgs.map((m, i) => (
              <p key={i} className={`msg ${m.from}`}>
                {m.text}
              </p>
            ))}
            {busy && <p className="msg momo typing">…</p>}
          </div>
          <div className="chat-asks">
            {ASK.map(([k, label]) => (
              <button key={k} onClick={() => onAsk(k, label)} disabled={busy}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "./DiaryApp";
import { Mascot } from "./art";
import { api } from "@/lib/client";

type Reply = { reply: string; speak?: boolean };
const ASK: [string, string][] = [
  ["today", "오늘 할 일은?"],
  ["week", "이번 주 일정"],
  ["cheer", "응원해줘"],
  ["nag", "잔소리해줘"],
];

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?「」:()/]/gu, ""));
  u.lang = "ko-KR";
  u.pitch = 1.4;
  speechSynthesis.speak(u);
}

const ask = (intent: string) => api<Reply>("/api/chat", { method: "POST", json: { intent, tz: new Date().getTimezoneOffset() } });

/**
 * Todo 옆에 앉아 있는 잔소리 토끼 모모.
 * 처음 열 때, 할 일이 바뀔 때, 그리고 페이지를 열어 둔 동안 2분마다 저장된 Todo를 보고 한마디 한다.
 * 토끼를 누르면 질문 버튼이 나온다. 목소리는 사용자가 켠 경우에만 읽어준다.
 */
export function NagBunny() {
  const { settings, setSettings, toast, todoVersion } = useApp();
  const [line, setLine] = useState("안녕! 나는 잔소리 토끼 모모야 🐰 오늘 할 일 지켜볼게!");
  const [angry, setAngry] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const voice = useRef(settings.voice_enabled);
  voice.current = settings.voice_enabled;

  const say = useCallback((r: Reply) => {
    setLine(r.reply);
    setAngry(!!r.speak);
    if (voice.current) speak(r.reply);
  }, []);

  // 할 일이 바뀌면 잠깐 기다렸다가 다시 살펴본다
  useEffect(() => {
    const t = setTimeout(() => {
      if (!document.hidden) ask("nag").then(say, () => {});
    }, todoVersion === 0 ? 800 : 1500);
    return () => clearTimeout(t);
  }, [todoVersion, say]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) ask("nag").then(say, () => {});
    }, 2 * 60_000);
    return () => clearInterval(t);
  }, [say]);

  const onAsk = async (intent: string) => {
    setBusy(true);
    try {
      say(await ask(intent));
    } catch (e) {
      setLine(e instanceof Error ? `앗, ${e.message}` : "앗, 지금은 대답하기 어려워…");
    } finally {
      setBusy(false);
    }
  };

  const toggleVoice = async () => {
    const next = !settings.voice_enabled;
    setSettings({ ...settings, voice_enabled: next });
    if (next) speak("이제 소리 내서 잔소리할게!");
    else speechSynthesis?.cancel();
    try {
      await api("/api/me", { method: "PATCH", json: { voice_enabled: next } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "설정을 저장하지 못했어요.");
    }
  };

  return (
    <aside className={`bunny ${angry ? "angry" : ""}`} aria-label="잔소리 토끼 모모">
      <p className="bunny-say" role="status" aria-live="polite">
        {busy ? "음… 잠깐만 생각해 볼게" : line}
      </p>
      {open && (
        <div className="bunny-menu">
          {ASK.map(([k, label]) => (
            <button key={k} onClick={() => onAsk(k)} disabled={busy}>
              {label}
            </button>
          ))}
          <button className={settings.voice_enabled ? "on" : ""} onClick={toggleVoice} aria-pressed={settings.voice_enabled}>
            {settings.voice_enabled ? "🔊 목소리 켜짐" : "🔈 목소리 끔"}
          </button>
        </div>
      )}
      <button className="bunny-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="모모에게 물어보기">
        <Mascot />
      </button>
    </aside>
  );
}

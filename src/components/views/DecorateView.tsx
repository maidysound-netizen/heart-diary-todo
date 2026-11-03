"use client";

import { useState } from "react";
import { useApp } from "../DiaryApp";
import { At, Paper } from "../Paper";
import { api, type Settings } from "@/lib/client";

const COVERS: [string, string][] = [
  ["#E8A6B5", "로즈 핑크"],
  ["#F4C2CF", "연핑크"],
  ["#C9B3E6", "라일락"],
  ["#B5E8D5", "민트"],
  ["#BFDDF5", "베이비 블루"],
  ["#A9D3C4", "세이지"],
  ["#F6D58E", "버터"],
  ["#A94C68", "체리"],
];
const RIBBONS: [string, string, string][] = [["rose", "로즈", "#E58FA5"], ["cream", "크림", "#FFF1E0"], ["lilac", "라일락", "#C9B3E6"], ["cherry", "체리", "#A94C68"]];
const CHAINS: [string, string][] = [["gold", "금색 체인"], ["silver", "은색 체인"], ["none", "체인 없음"]];
const CHARMS: [string, string][] = [["heart", "하트 크리스털"], ["bunny", "토끼 인형"], ["bear", "곰 인형"], ["star", "금별"]];

export function DecorateView() {
  const { settings, setSettings, toast, closeBook } = useApp();
  const [saved, setSaved] = useState(settings);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Settings>) => setSettings({ ...settings, ...p });
  const dirty = JSON.stringify(saved) !== JSON.stringify(settings);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api<{ settings: Settings }>("/api/me", { method: "PATCH", json: settings });
      setSaved(r.settings);
      setSettings(r.settings);
      toast("꾸미기를 저장했어요 🎀");
    } catch (e) {
      toast(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const enableVoice = (on: boolean) => {
    set({ voice_enabled: on });
    if (on && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance("안녕! 모모가 할 일을 읽어줄게.");
      u.lang = "ko-KR";
      speechSynthesis.speak(u);
    }
  };

  const group = <T extends string>(label: string, opts: [T, string, string?][], cur: string, on: (v: T) => void) => (
    <fieldset className="opt-group">
      <legend>{label}</legend>
      {opts.map(([k, name, color]) => (
        <button key={k} className={`opt ${cur === k ? "on" : ""}`} onClick={() => on(k)} aria-pressed={cur === k}>
          {color && <span className="dot" style={{ background: color }} />}
          {name}
        </button>
      ))}
    </fieldset>
  );

  return (
    <Paper
      label="표지 꾸미기"
      template="01_blank"
      decorKey="decorate"
      content={
        <>
          <At x={0.1} y={0.16} w={0.8} h={0.42} className="decorate paper-panel">
          <h2 className="hand center">표지 꾸미기</h2>
          <fieldset className="opt-group">
            <legend>표지 가죽 색</legend>
            {COVERS.map(([c, name]) => (
              <button key={c} className={`swatch lg ${settings.cover_color === c ? "on" : ""}`} style={{ background: c }} onClick={() => set({ cover_color: c })} aria-label={`표지 색 ${name}`} title={name} aria-pressed={settings.cover_color === c} />
            ))}
          </fieldset>
          {group("리본", RIBBONS, settings.ribbon_key, (v) => set({ ribbon_key: v }))}
          {group("체인", CHAINS, settings.chain_key, (v) => set({ chain_key: v }))}
          {group("인형 참", CHARMS, settings.charm_key, (v) => set({ charm_key: v }))}
        </At>
          <At x={0.1} y={0.6} w={0.8} h={0.3} className="decorate paper-panel">
          <h2 className="hand center">모모의 잔소리</h2>
          <label className="switch">
            <input type="checkbox" checked={settings.nagging_mode} onChange={(e) => set({ nagging_mode: e.target.checked })} />
            <span>귀여운 잔소리 모드 — 다이어리를 열어 둔 동안 마감 지난 할 일을 알려줘요</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={settings.voice_enabled} onChange={(e) => enableVoice(e.target.checked)} />
            <span>소리로 읽어주기 (브라우저 음성, 켤 때 한 번 들려줘요)</span>
          </label>
          <p className="muted small">잔소리는 언제든 끌 수 있고, 사이트를 닫으면 울리지 않아요.</p>
          <div className="row center">
            <button className="btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? "저장 중…" : dirty ? "저장" : "저장됨"}</button>
            <button className="btn-ghost" onClick={async () => { if (dirty) await save(); closeBook(); }}>표지 보러 가기</button>
          </div>
        </At>
        </>
      }
    />
  );
}

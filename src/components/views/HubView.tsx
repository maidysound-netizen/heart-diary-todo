"use client";

import { useEffect, useState } from "react";
import { Spread, useApp, type View } from "../DiaryApp";
import { FeatureIcon, Sticker } from "../art";
import { api, dayRange, prettyDate, today, type Todo } from "@/lib/client";

type Feat = { kind: string; label: string; sub: string; color: string; rot: number; to: View | "chat" };

const LEFT: Feat[] = [
  { kind: "diary", label: "Diary", sub: "오늘의 일기", color: "#FBD5DF", rot: -5, to: { name: "diary" } },
  { kind: "todo", label: "Todo", sub: "할 일", color: "#FDE3C8", rot: 4, to: { name: "todo" } },
  { kind: "weekly", label: "Weekly", sub: "주간 계획", color: "#E3D7F5", rot: 3, to: { name: "weekly" } },
  { kind: "monthly", label: "Monthly", sub: "월간 달력", color: "#FFF0B8", rot: -4, to: { name: "monthly" } },
];
const RIGHT: Feat[] = [
  { kind: "draw", label: "Draw", sub: "펜으로 그리기", color: "#D9EEF7", rot: 4, to: { name: "diary", tool: "draw" } },
  { kind: "photo", label: "Photo", sub: "사진 붙이기", color: "#E2F0D9", rot: -3, to: { name: "diary", tool: "photo" } },
  { kind: "chat", label: "Chat", sub: "모모와 대화", color: "#FFE0E8", rot: -5, to: "chat" },
  { kind: "decorate", label: "Decorate", sub: "표지 꾸미기", color: "#F7E1CF", rot: 3, to: { name: "decorate" } },
];

function FeatSticker({ f }: { f: Feat }) {
  const { go, openChat } = useApp();
  return (
    <button
      className="feat"
      style={{ ["--c" as string]: f.color, ["--rot" as string]: `${f.rot}deg` }}
      onClick={() => (f.to === "chat" ? openChat() : go(f.to))}
    >
      <span className="feat-tape" aria-hidden="true" />
      <span className="feat-icon">
        <FeatureIcon kind={f.kind} />
      </span>
      <span className="feat-label">{f.label}</span>
      <span className="feat-sub">{f.sub}</span>
    </button>
  );
}

export function HubView() {
  const { user, closeBook } = useApp();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const { from, to } = dayRange(today());
    api<{ todos: Todo[] }>(`/api/todos?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&undated=1`)
      .then((r) => setLeft(r.todos.filter((t) => !t.is_completed).length))
      .catch(() => setLeft(null));
  }, []);
  return (
    <Spread
      hub
      left={
        <div className="hub">
          <h1 className="hand hub-title">♡ My Heart Diary ♡</h1>
          <p className="hub-date">{prettyDate(today())}</p>
          <div className="feat-grid">
            {LEFT.map((f) => (
              <FeatSticker key={f.kind} f={f} />
            ))}
          </div>
        </div>
      }
      leftFoot={<span className="deco-sticker" aria-hidden="true"><Sticker k="bear" /></span>}
      right={
        <div className="hub">
          <p className="hand hub-greet">
            {user.name ?? "나"}의 하루{left != null && <> · 남은 할 일 <b>{left}</b>개</>}
          </p>
          <div className="feat-grid">
            {RIGHT.map((f) => (
              <FeatSticker key={f.kind} f={f} />
            ))}
          </div>
        </div>
      }
      rightFoot={
        <button className="ribbon-btn" onClick={closeBook}>
          책 덮기
        </button>
      }
    />
  );
}

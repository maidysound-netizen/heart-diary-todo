"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Focus, SpreadRects } from "./HeartBook3D";
import { HEART_SVG_PATH } from "@/lib/heart";
import { api, DEFAULT_SETTINGS, type Settings } from "@/lib/client";
import { HubView } from "./views/HubView";
import { DiaryView } from "./views/DiaryView";
import { TodoView } from "./views/TodoView";
import { WeeklyView } from "./views/WeeklyView";
import { MonthlyView } from "./views/MonthlyView";
import { DecorateView } from "./views/DecorateView";
import { ChatBubble } from "./ChatBubble";
import { Mascot } from "./art";

const HeartBook3D = dynamic(() => import("./HeartBook3D"), { ssr: false });

export type View =
  | { name: "hub" }
  | { name: "diary"; date?: string; tool?: "draw" | "photo" }
  | { name: "todo"; date?: string }
  | { name: "weekly"; date?: string }
  | { name: "monthly"; date?: string }
  | { name: "decorate" };

type User = { id: string; name?: string | null; email?: string | null; image?: string | null };

type Ctx = {
  user: User;
  settings: Settings;
  setSettings: (s: Settings) => void;
  go: (v: View) => void;
  closeBook: () => void;
  openChat: () => void;
  toast: (msg: string) => void;
  mobile: boolean;
  /** 페이지를 떠나기 전에 실행 (예: 일기 자동 저장). false를 돌려주면 이동 취소 */
  setLeaveGuard: (fn: (() => Promise<boolean>) | null) => void;
  logout: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

/** 하트형 내지 한 장. 데스크톱은 3D 페이지 위에 정확히 겹치고, 모바일은 한 장짜리 종이로 바뀐다. */
export function Spread({ left, right, leftFoot, rightFoot, template, hub }: {
  left: ReactNode;
  right: ReactNode;
  leftFoot?: ReactNode;
  rightFoot?: ReactNode;
  template?: string;
  hub?: boolean;
}) {
  const { rects, mobile } = useContext(SpreadCtx);
  if (mobile) {
    return (
      <div className={`m-page ${hub ? "m-hub" : ""}`}>
        <div className="m-scroll">
          <div className="m-sec">{left}</div>
          {leftFoot && <div className="m-foot m-foot-l">{leftFoot}</div>}
          <div className="m-sec m-right" style={template ? { ["--tpl" as string]: `url(/templates/${template}.png)` } : undefined}>
            {right}
          </div>
          {rightFoot && <div className="m-foot">{rightFoot}</div>}
        </div>
      </div>
    );
  }
  if (!rects) return null;
  return (
    <>
      <Panel side="left" rect={rects.left} foot={leftFoot}>
        {left}
      </Panel>
      <Panel side="right" rect={rects.right} foot={rightFoot} template={template}>
        {right}
      </Panel>
    </>
  );
}

function Panel({ side, rect, foot, template, children }: {
  side: "left" | "right";
  rect: { x: number; y: number; w: number; h: number };
  foot?: ReactNode;
  template?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`panel panel-${side}`}
      aria-label={side === "left" ? "왼쪽 페이지" : "오른쪽 페이지"}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, ["--u" as string]: `${rect.w / 100}px` }}
    >
      {template && <div className="panel-tpl" style={{ backgroundImage: `url(/templates/${template}.png)` }} />}
      <div className="panel-body">{children}</div>
      {foot && <div className="panel-foot">{foot}</div>}
    </section>
  );
}

const SpreadCtx = createContext<{ rects: SpreadRects | null; mobile: boolean }>({ rects: null, mobile: false });

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function useMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const f = () => setM(window.innerWidth < 900 || window.innerWidth / Math.max(1, window.innerHeight - 56) < 1.3);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(q.matches);
    const f = () => setR(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return r;
}

const DEPTH: Record<View["name"], number> = { hub: 0, diary: 1, todo: 1, weekly: 1, monthly: 1, decorate: 1 };

export default function DiaryApp({
  user,
  devLogin,
  titleFont,
  loginGoogle,
  loginDev,
  logout,
  authError,
}: {
  user: User | null;
  devLogin: boolean;
  titleFont: string;
  loginGoogle: () => Promise<void>;
  loginDev: (fd: FormData) => Promise<void>;
  logout: () => Promise<void>;
  authError?: string;
}) {
  const mobile = useMobile();
  const reducedMotion = useReducedMotion();
  const [gl, setGl] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: "hub" });
  const [rects, setRects] = useState<SpreadRects | null>(null);
  const [hidden, setHidden] = useState(false);
  const [turning, setTurning] = useState<"" | "out" | "in">("");
  const [flip, setFlip] = useState<{ id: number; dir: 1 | -1 } | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [toastMsg, setToastMsg] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(!!authError);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const busy = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setGl(webglAvailable()), []);

  useEffect(() => {
    if (!user) return;
    api<{ settings: Settings }>("/api/me")
      .then((r) => r.settings && setSettings({ ...DEFAULT_SETTINGS, ...r.settings }))
      .catch(() => {});
  }, [user]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }, []);

  const flipMs = reducedMotion ? 200 : 650;

  const go = useCallback(
    async (next: View) => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (guard.current && !(await guard.current())) return;
        guard.current = null;
        const dir: 1 | -1 = DEPTH[next.name] >= DEPTH[view.name] ? 1 : -1;
        if (mobile) {
          setTurning("out");
          await new Promise((r) => setTimeout(r, flipMs / 2));
          setView(next);
          setTurning("in");
          await new Promise((r) => setTimeout(r, flipMs / 2));
          setTurning("");
        } else {
          setHidden(true);
          setFlip({ id: Date.now(), dir });
          await new Promise((r) => setTimeout(r, flipMs + 40));
          setView(next);
          setHidden(false);
        }
      } finally {
        busy.current = false;
      }
    },
    [view.name, mobile, flipMs],
  );

  const closeBook = useCallback(async () => {
    if (guard.current && !(await guard.current())) return;
    guard.current = null;
    setChatOpen(false);
    setOpen(false);
    setTimeout(() => setView({ name: "hub" }), 400);
  }, []);

  const openBook = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    setOpen(true);
  };

  const onRects = useCallback((r: SpreadRects | null) => setRects(r), []);
  const focus: Focus = "both";

  const ctx = useMemo<Ctx | null>(
    () =>
      user && {
        user,
        settings,
        setSettings,
        go,
        closeBook,
        openChat: () => setChatOpen(true),
        toast,
        mobile,
        setLeaveGuard: (fn) => (guard.current = fn),
        logout: () => void logout(),
      },
    [user, settings, go, closeBook, toast, mobile, logout],
  );

  // 3D가 안 되는 브라우저: 정적 2D 하트 표지와 같은 메뉴 구조로 대체
  const fallback = gl === false;
  const showPages = open && ctx && (mobile || fallback || (rects && !hidden));

  return (
    <div className={`app ${open ? "is-open" : ""}`}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
            <path d={HEART_SVG_PATH} />
          </clipPath>
        </defs>
      </svg>

      <header className="topbar">
        <div className="brand">
          <span className="brand-heart" aria-hidden="true">♥</span> Heart Diary
        </div>
        {user ? (
          <div className="top-actions">
            <span className="hello">{user.name ?? user.email}님의 다이어리</span>
            {open && (
              <button className="chip" onClick={() => go({ name: "hub" })} disabled={view.name === "hub"}>
                ♡ 첫 페이지
              </button>
            )}
            {open ? (
              <button className="chip" onClick={closeBook}>책 덮기</button>
            ) : (
              <button className="chip" onClick={() => void logout()}>로그아웃</button>
            )}
          </div>
        ) : (
          <button className="chip" onClick={() => setShowLogin(true)}>로그인</button>
        )}
      </header>

      <div className="stage">
        {gl && (
          <HeartBook3D
            open={open}
            focus={focus}
            flip={flip}
            settings={settings}
            titleFont={titleFont}
            reducedMotion={reducedMotion}
            topInset={56}
            onRects={onRects}
            onCoverClick={openBook}
          />
        )}
        {fallback && <FallbackCover open={open} color={settings.cover_color} onOpen={openBook} />}

        {!open && (
          <div className="cover-cta">
            {user ? (
              <button className="btn-primary big" onClick={openBook}>
                ♡ 다이어리 열기
              </button>
            ) : (
              <button className="btn-primary big" onClick={() => setShowLogin(true)}>
                Google로 계속하기
              </button>
            )}
            <p className="cover-hint">{user ? "표지를 눌러도 열려요" : "하트 다이어리에 오신 걸 환영해요 — 나만의 비공개 다이어리"}</p>
          </div>
        )}

        {ctx && (
          <AppCtx.Provider value={ctx}>
            <SpreadCtx.Provider value={{ rects, mobile: mobile || fallback }}>
              <div className={`pages ${showPages ? "show" : ""} ${turning ? `turn-${turning}` : ""}`} aria-hidden={!showPages}>
                {showPages && <CurrentView view={view} />}
              </div>
            </SpreadCtx.Provider>
            {open && (
              <button className="mascot-btn" onClick={() => setChatOpen((v) => !v)} aria-label="마스코트 모모와 대화하기">
                <Mascot />
              </button>
            )}
            <ChatBubble open={chatOpen && open} onClose={() => setChatOpen(false)} />
          </AppCtx.Provider>
        )}
      </div>

      {showLogin && !user && (
        <div className="modal-back" onClick={() => setShowLogin(false)}>
          <div className="login-card" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="login-title">하트 다이어리 시작하기</h2>
            <p>Google 계정으로 로그인하면 나만 볼 수 있는 다이어리가 만들어져요. 다시 로그인하면 같은 기록을 불러와요.</p>
            {authError && <p className="error">로그인에 실패했어요. 다시 시도해 주세요. ({authError})</p>}
            <form action={loginGoogle}>
              <button className="btn-google" type="submit">
                <GoogleG /> Google로 계속하기
              </button>
            </form>
            {devLogin && (
              <form action={loginDev} className="dev-login">
                <p className="muted">로컬 개발 전용 테스트 로그인</p>
                <input name="name" placeholder="테스트 이름 (예: alice)" defaultValue="alice" aria-label="테스트 이름" />
                <button className="btn-ghost" type="submit">테스트 계정으로 입장</button>
              </form>
            )}
            <button className="link" onClick={() => setShowLogin(false)}>닫기</button>
          </div>
        </div>
      )}

      <div className={`toast ${toastMsg ? "show" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}

function CurrentView({ view }: { view: View }) {
  switch (view.name) {
    case "hub":
      return <HubView />;
    case "diary":
      return <DiaryView key={`${view.date}-${view.tool}`} date={view.date} tool={view.tool} />;
    case "todo":
      return <TodoView date={view.date} />;
    case "weekly":
      return <WeeklyView date={view.date} />;
    case "monthly":
      return <MonthlyView date={view.date} />;
    case "decorate":
      return <DecorateView />;
  }
}

function FallbackCover({ open, color, onOpen }: { open: boolean; color: string; onOpen: () => void }) {
  if (open) return null;
  return (
    <button className="fallback-cover" style={{ background: color }} onClick={onOpen} aria-label="다이어리 열기">
      <span>Heart Diary</span>
    </button>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

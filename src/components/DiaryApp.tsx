"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Insets, Rect } from "./HeartBook3D";
import { HEART_H, HEART_SVG_PATH, HEART_W } from "@/lib/heart";
import { api, DEFAULT_HUB, DEFAULT_SETTINGS, type HubLayout, type Settings } from "@/lib/client";
import { HubView } from "./views/HubView";
import { DiaryView } from "./views/DiaryView";
import { TodoView } from "./views/TodoView";
import { WeeklyView } from "./views/WeeklyView";
import { MonthlyView } from "./views/MonthlyView";
import { DecorateView } from "./views/DecorateView";
import { MusicView } from "./views/MusicView";
import { ChatBubble } from "./ChatBubble";
import { Mascot } from "./art";

const HeartBook3D = dynamic(() => import("./HeartBook3D"), { ssr: false });

export type View =
  | { name: "hub" }
  | { name: "diary"; date?: string; tool?: "draw" | "photo" }
  | { name: "todo"; date?: string }
  | { name: "weekly"; date?: string }
  | { name: "monthly"; date?: string }
  | { name: "music" }
  | { name: "decorate" };

type User = { id: string; name?: string | null; email?: string | null; image?: string | null };

type Ctx = {
  user: User;
  settings: Settings;
  setSettings: (s: Settings) => void;
  hub: HubLayout;
  setHub: (h: HubLayout) => void;
  hubPage: number;
  /** 허브 페이지를 넘긴다 (가운데 제본선 기준 3D 책장 넘김) */
  turnHub: (to: number) => void;
  go: (v: View) => void;
  closeBook: () => void;
  openChat: () => void;
  toast: (msg: string) => void;
  /** 페이지를 떠나기 전에 실행 (예: 일기 자동 저장). false를 돌려주면 이동 취소 */
  setLeaveGuard: (fn: (() => Promise<boolean>) | null) => void;
  logout: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const SheetCtx = createContext<Rect | null>(null);

/** 속지가 튀어나오기 시작할 화면 좌표 (방금 누른 스티커 자리) */
const OriginCtx = createContext<{ x: number; y: number } | null>(null);
export const usePaperOrigin = () => useContext(OriginCtx);

/**
 * 펼친 하트 한 장. 3D 내지 위에 정확히 겹치고 SVG clipPath로 하트 윤곽을 유지한다.
 * - full: 하트 전체를 덮는 층 (스티커 판, 그림+글 보드)
 * - left/right: 가운데 제본선 양쪽의 글 영역 (좁은 화면에서는 위아래로 쌓인다)
 * - extras: 하트 밖으로 삐져나와도 되는 것 (다음 페이지 화살표)
 * - below: 하트 아래 (스티커 트레이, 도구 모음)
 */
export function Sheet({ template, full, left, right, extras, below }: {
  template?: string;
  full?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  extras?: ReactNode;
  below?: ReactNode;
}) {
  const rect = useContext(SheetCtx);
  if (!rect) return null;
  const narrow = rect.w < 600;
  return (
    <div
      className={`sheet-wrap ${narrow ? "narrow" : ""}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, ["--u" as string]: `${rect.w / 100}px` }}
    >
      <section className="sheet" aria-label="다이어리 페이지">
        {template && <div className="sheet-tpl" style={{ backgroundImage: `url(/templates/${template}.png)` }} />}
        {full && <div className="sheet-full">{full}</div>}
        {(left || right) &&
          (narrow ? (
            <div className="col col-stack">
              {left}
              {right}
            </div>
          ) : (
            <>
              <div className="col col-l">{left}</div>
              <div className="col col-r">{right}</div>
            </>
          ))}
      </section>
      {extras}
      {below && <div className="sheet-below">{below}</div>}
    </div>
  );
}

/** 하트 아래 공간(px): 닫힘 = 열기 버튼, 열림 = 그리기 도구 + 스티커 시트 */
const BOTTOM = { closed: 130, open: 250 };

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
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

/** 3D가 안 될 때: 같은 하트 크기를 화면 크기에서 직접 계산 */
function useFallbackRect(active: boolean, insets: Insets) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!active) return setRect(null);
    const f = () => {
      const W = window.innerWidth, H = window.innerHeight - insets.top - insets.bottom;
      const w = Math.min(W * 0.94, (H * 0.96 * HEART_W) / HEART_H);
      const h = (w * HEART_H) / HEART_W;
      setRect({ x: (W - w) / 2, y: insets.top + (H - h) / 2, w, h });
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [active, insets.top, insets.bottom]);
  return rect;
}

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
  const reducedMotion = useReducedMotion();
  const [gl, setGl] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: "hub" });
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [rect3d, setRect3d] = useState<Rect | null>(null);
  const [hidden, setHidden] = useState(false);
  const [flip, setFlip] = useState<{ id: number; dir: 1 | -1 } | null>(null);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [hubPage, setHubPage] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(!!authError);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const busy = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveHubTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setGl(webglAvailable()), []);

  // 입력칸이 아닌 곳에서 시작한 글자 선택·길게 누르기 메뉴는 막는다 (아이패드 펜 그리기 중 파란 선택 영역)
  useEffect(() => {
    const editable = (t: EventTarget | null) => t instanceof Element && !!t.closest("input, textarea, [contenteditable=true]");
    const block = (e: Event) => {
      if (!editable(e.target)) e.preventDefault();
    };
    document.addEventListener("selectstart", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.removeEventListener("selectstart", block);
      document.removeEventListener("contextmenu", block);
    };
  }, []);

  useEffect(() => {
    const f = (e: PointerEvent) => (lastPointer.current = { x: e.clientX, y: e.clientY });
    window.addEventListener("pointerdown", f, true);
    return () => window.removeEventListener("pointerdown", f, true);
  }, []);

  useEffect(() => {
    if (!user) return;
    api<{ settings: Settings }>("/api/me")
      .then((r) => r.settings && setSettingsState({ ...DEFAULT_SETTINGS, ...r.settings }))
      .catch(() => {});
  }, [user]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }, []);

  const hub = settings.hub_layout?.v === 2 && settings.hub_layout.pages?.length ? settings.hub_layout : DEFAULT_HUB;

  const setHub = useCallback(
    (h: HubLayout) => {
      setSettingsState((s) => ({ ...s, hub_layout: h }));
      clearTimeout(saveHubTimer.current);
      saveHubTimer.current = setTimeout(() => {
        api("/api/me", { method: "PATCH", json: { hub_layout: h } }).catch((e) =>
          toast(e instanceof Error ? `스티커 위치를 저장하지 못했어요: ${e.message}` : "스티커 위치를 저장하지 못했어요."),
        );
      }, 500);
    },
    [toast],
  );

  const flipMs = reducedMotion ? 200 : 650;

  /** 레이어를 잠시 숨기고 3D 책장을 넘긴 뒤 apply()로 다음 화면을 보여준다 */
  const turn = useCallback(
    async (dir: 1 | -1, apply: () => void) => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (guard.current && !(await guard.current())) return;
        guard.current = null;
        setHidden(true);
        setFlip({ id: Date.now(), dir });
        await new Promise((r) => setTimeout(r, flipMs + 40));
        apply();
        setHidden(false);
      } finally {
        busy.current = false;
      }
    },
    [flipMs],
  );

  /** 스티커를 누르면 그 자리에서 속지가 튀어나온다 (허브로 돌아가면 속지가 다시 들어간다) */
  const go = useCallback(async (next: View) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (guard.current && !(await guard.current())) return;
      guard.current = null;
      setOrigin(lastPointer.current);
      setView(next);
    } finally {
      busy.current = false;
    }
  }, []);

  const turnHub = useCallback(
    (to: number) => {
      void turn(to > hubPage ? 1 : -1, () => setHubPage(to));
    },
    [hubPage, turn],
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

  const insets: Insets = useMemo(() => ({ top: 60, bottom: open ? BOTTOM.open : BOTTOM.closed }), [open]);
  const onRect = useCallback((r: Rect | null) => setRect3d(r), []);

  const ctx = useMemo<Ctx | null>(
    () =>
      user && {
        user,
        settings,
        setSettings: setSettingsState,
        hub,
        setHub,
        hubPage: Math.min(hubPage, hub.pages.length - 1),
        turnHub,
        go: (v) => void go(v),
        closeBook,
        openChat: () => setChatOpen(true),
        toast,
        setLeaveGuard: (fn) => (guard.current = fn),
        logout: () => void logout(),
      },
    [user, settings, hub, setHub, hubPage, turnHub, go, closeBook, toast, logout],
  );

  // 3D가 안 되는 브라우저: 정적 2D 하트와 같은 메뉴 구조로 대체
  const fallback = gl === false;
  const fallbackRect = useFallbackRect(fallback && open, insets);
  const rect = fallback ? fallbackRect : rect3d;
  const showPages = open && ctx && rect && !hidden;

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
                ♡ 스티커 판
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
            flip={flip}
            settings={settings}
            titleFont={titleFont}
            reducedMotion={reducedMotion}
            insets={insets}
            onRect={onRect}
            onCoverClick={openBook}
          />
        )}
        {fallback && !open && <FallbackCover color={settings.cover_color} onOpen={openBook} />}

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
            <SheetCtx.Provider value={rect}>
              <OriginCtx.Provider value={origin}>
                <div className={`pages ${showPages ? "show" : ""} ${fallback ? "flat" : ""}`} aria-hidden={!showPages}>
                  {showPages && <HubView inert={view.name !== "hub"} />}
                </div>
                {open && view.name !== "hub" && <CurrentView view={view} />}
              </OriginCtx.Provider>
            </SheetCtx.Provider>
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
      return null;
    case "diary":
      return <DiaryView key={`${view.date}-${view.tool}`} date={view.date} tool={view.tool} />;
    case "todo":
      return <TodoView date={view.date} />;
    case "weekly":
      return <WeeklyView date={view.date} />;
    case "monthly":
      return <MonthlyView date={view.date} />;
    case "music":
      return <MusicView />;
    case "decorate":
      return <DecorateView />;
  }
}

function FallbackCover({ color, onOpen }: { color: string; onOpen: () => void }) {
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

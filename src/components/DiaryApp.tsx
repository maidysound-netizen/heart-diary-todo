"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, DEFAULT_SETTINGS, type Settings } from "@/lib/client";
import { TodoView } from "./views/TodoView";
import { NagBunny } from "./ChatBubble";

type User = { id: string; name?: string | null; email?: string | null; image?: string | null };

type Ctx = {
  user: User;
  settings: Settings;
  setSettings: (s: Settings) => void;
  toast: (msg: string) => void;
  /** 페이지를 떠나기 전에 실행 (예: 낙서 자동 저장). false를 돌려주면 이동 취소 */
  setLeaveGuard: (fn: (() => Promise<boolean>) | null) => void;
  /** Todo가 바뀌면 토끼가 다시 살펴본다 */
  todosChanged: () => void;
  todoVersion: number;
  logout: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

export default function DiaryApp({
  user,
  devLogin,
  loginGoogle,
  loginDev,
  logout,
  authError,
}: {
  user: User | null;
  devLogin: boolean;
  loginGoogle: () => Promise<void>;
  loginDev: (fd: FormData) => Promise<void>;
  logout: () => Promise<void>;
  authError?: string;
}) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [toastMsg, setToastMsg] = useState("");
  const [todoVersion, setTodoVersion] = useState(0);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const doLogout = useCallback(async () => {
    if (guard.current && !(await guard.current())) return;
    await logout();
  }, [logout]);

  const ctx = useMemo<Ctx | null>(
    () =>
      user && {
        user,
        settings,
        setSettings: setSettingsState,
        toast,
        setLeaveGuard: (fn) => (guard.current = fn),
        todosChanged: () => setTodoVersion((v) => v + 1),
        todoVersion,
        logout: () => void doLogout(),
      },
    [user, settings, toast, todoVersion, doLogout],
  );

  return (
    <div className="app todo-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-heart" aria-hidden="true">♥</span> Heart Diary
          <span className="brand-sub">To-Do</span>
        </div>
        {user ? (
          <div className="top-actions">
            <span className="hello">{user.name ?? user.email}님의 할 일</span>
            <button className="chip" onClick={() => void doLogout()}>로그아웃</button>
          </div>
        ) : null}
      </header>

      <main className="desk">
        {ctx ? (
          <AppCtx.Provider value={ctx}>
            <TodoView />
            <NagBunny />
          </AppCtx.Provider>
        ) : (
          <div className="welcome">
            <div className="clipboard preview" aria-hidden="true">
              <span className="clip" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="preview-paper" src="/templates/06_todo.png" alt="" />
            </div>
            <div className="login-card">
              <h1 className="hand">오늘 할 일, 토끼가 지켜볼게요 🐰</h1>
              <p>
                Todo 한 장에 할 일을 적고, 그 위에 펜으로 그리거나 글을 써요. 마감이 지나면 옆에 있는 토끼 모모가 귀엽게 잔소리해요.
                Google로 로그인하면 나만 볼 수 있는 Todo가 만들어지고, 다시 로그인하면 그대로 불러와요.
              </p>
              {authError === "AccessDenied" ? (
                <p className="error">초대받은 분만 쓸 수 있어요 🐰 초대받은 구글 계정으로 로그인해 주세요.</p>
              ) : (
                authError && <p className="error">로그인에 실패했어요. 다시 시도해 주세요. ({authError})</p>
              )}
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
              <p className="legal-links">
                <a href="/privacy">개인정보처리방침</a> · <a href="/terms">서비스 약관</a>
              </p>
            </div>
          </div>
        )}
      </main>

      <div className={`toast ${toastMsg ? "show" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
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

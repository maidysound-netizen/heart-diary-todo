import type { Metadata, Viewport } from "next";
import { body, hand, script } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heart Diary To-Do — 잔소리 토끼",
  description: "Todo 한 장에 할 일을 적고 펜으로 꾸미면, 옆에서 토끼가 마감을 잔소리해 주는 나만의 비공개 Todo 다이어리",
  robots: { index: false, follow: false },
  // 아이폰·아이패드 홈 화면 앱: 주소창 없이 열리고, 홈 화면 이름은 짧게
  appleWebApp: { capable: true, title: "Heart To-Do", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#F6DCE3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${body.variable} ${hand.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}

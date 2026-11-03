import type { Metadata, Viewport } from "next";
import { body, hand, script } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heart Diary — 하트 다이어리",
  description: "하트 모양 3D 다이어리를 펼쳐 일기·할 일·주간·월간 계획을 기록하는 나만의 비공개 다이어리",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#F6DCE3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${body.variable} ${hand.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}

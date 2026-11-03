import type { View } from "./DiaryApp";

/** 허브에 붙이는 기능 스티커 종류. 누르면 to 화면으로 책장이 넘어간다 */
export const FEATURES: Record<string, { label: string; sub: string; color: string; to: View | "chat" }> = {
  todo: { label: "Todo", sub: "할 일", color: "#FDE3C8", to: { name: "todo" } },
  weekly: { label: "Weekly", sub: "주간 계획", color: "#E3D7F5", to: { name: "weekly" } },
  monthly: { label: "Monthly", sub: "월간 달력", color: "#FFF0B8", to: { name: "monthly" } },
  diary: { label: "Diary", sub: "오늘의 일기", color: "#FBD5DF", to: { name: "diary" } },
  draw: { label: "Draw", sub: "그림 그리기", color: "#D9EEF7", to: { name: "diary", tool: "draw" } },
  photo: { label: "Picture", sub: "사진 붙이기", color: "#E2F0D9", to: { name: "diary", tool: "photo" } },
  music: { label: "Music", sub: "음악 링크", color: "#F3DDF7", to: { name: "music" } },
  chat: { label: "Chat", sub: "모모와 대화", color: "#FFE0E8", to: "chat" },
  decorate: { label: "Decorate", sub: "표지 꾸미기", color: "#F7E1CF", to: { name: "decorate" } },
};

export const FEATURE_ORDER = ["todo", "weekly", "monthly", "diary", "draw", "photo", "music", "chat", "decorate"];

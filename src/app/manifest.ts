import type { MetadataRoute } from "next";

// 앱으로 설치(PWA): 크롬 "앱 설치", 아이폰·아이패드 사파리 "홈 화면에 추가"
// Next.js가 /manifest.webmanifest 로 내보내고 <head>에 자동으로 연결한다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Heart Diary To-Do",
    short_name: "Heart To-Do",
    description: "Todo 한 장에 할 일을 적고 펜으로 꾸미면, 옆에서 토끼 모모가 마감을 잔소리해 주는 나만의 Todo 다이어리",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFF5F7",
    theme_color: "#F6DCE3",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

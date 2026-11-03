import { Dancing_Script, Gaegu, Gowun_Dodum } from "next/font/google";

export const body = Gowun_Dodum({ weight: "400", subsets: ["latin"], variable: "--font-body", display: "swap" });
export const hand = Gaegu({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-hand", display: "swap" });
export const script = Dancing_Script({ weight: "700", subsets: ["latin"], variable: "--font-script", display: "swap" });

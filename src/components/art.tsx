// 직접 그린 SVG 스티커·아이콘 (외부 에셋 없음)
import type { ReactElement } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function FeatureIcon({ kind }: { kind: string }) {
  const body: Record<string, ReactElement> = {
    diary: (
      <>
        <path {...S} d="M12 10h20a4 4 0 0 1 4 4v24H16a4 4 0 0 1-4-4z" />
        <path {...S} d="M12 34a4 4 0 0 1 4-4h20" />
        <path {...S} fill="currentColor" d="M24 16.5c-1-2-4-1.6-4 .6 0 2 4 4.4 4 4.4s4-2.4 4-4.4c0-2.2-3-2.6-4-.6z" />
      </>
    ),
    todo: (
      <>
        <rect {...S} x="11" y="9" width="26" height="30" rx="4" />
        <path {...S} d="M16 18l2.5 2.5L23 16M16 28l2.5 2.5L23 26M27 18h5M27 28h5" />
      </>
    ),
    weekly: (
      <>
        <rect {...S} x="9" y="12" width="30" height="26" rx="4" />
        <path {...S} d="M9 19h30M17 9v6M31 9v6M14 25h4M22 25h4M30 25h4M14 31h4M22 31h4" />
      </>
    ),
    monthly: (
      <>
        <rect {...S} x="9" y="12" width="30" height="26" rx="4" />
        <path {...S} d="M9 19h30M17 9v6M31 9v6M19 19v19M29 19v19M9 25.5h30M9 32h30" />
      </>
    ),
    draw: (
      <>
        <path {...S} d="M30 10l8 8-18 18-9 1 1-9z" />
        <path {...S} d="M27 13l8 8M10 40c6-2 10 2 16-1" />
      </>
    ),
    photo: (
      <>
        <rect {...S} x="10" y="9" width="28" height="31" rx="2" transform="rotate(-6 24 24)" />
        <path {...S} d="M15 30l6-7 5 5 3-3 5 5" transform="rotate(-6 24 24)" />
        <circle {...S} cx="28" cy="17" r="2.5" />
      </>
    ),
    chat: (
      <>
        <path {...S} d="M10 14a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H21l-7 6v-6a5 5 0 0 1-4-5z" />
        <circle cx="19" cy="20" r="1.8" fill="currentColor" />
        <circle cx="29" cy="20" r="1.8" fill="currentColor" />
        <path {...S} d="M22 24.5c1.2 1.2 2.8 1.2 4 0" />
      </>
    ),
    decorate: (
      <>
        <path {...S} d="M24 22c-6-8-14-8-14-2s8 5 14 2zM24 22c6-8 14-8 14-2s-8 5-14 2z" />
        <path {...S} d="M22 24l-5 13 4-2 3 3 1-14M26 24l5 13-4-2" />
        <circle {...S} cx="24" cy="22" r="2.5" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      {body[kind]}
    </svg>
  );
}

/** 페이지에 붙이는 꾸미기 스티커 */
export const STICKERS: Record<string, { label: string; svg: ReactElement }> = {
  heart: {
    label: "하트",
    svg: (
      <path
        d="M50 30C42 12 12 14 12 38c0 20 24 34 38 46 14-12 38-26 38-46 0-24-30-26-38-8z"
        fill="#F4A7BE"
        stroke="#fff"
        strokeWidth="6"
      />
    ),
  },
  gingham: {
    label: "체크 하트",
    svg: (
      <>
        <defs>
          <pattern id="gg" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#FBD5DF" />
            <rect width="6" height="12" fill="#F4A7BE" opacity=".6" />
            <rect width="12" height="6" fill="#F4A7BE" opacity=".6" />
          </pattern>
        </defs>
        <path d="M50 30C42 12 12 14 12 38c0 20 24 34 38 46 14-12 38-26 38-46 0-24-30-26-38-8z" fill="url(#gg)" stroke="#fff" strokeWidth="6" />
      </>
    ),
  },
  ribbon: {
    label: "리본",
    svg: (
      <g stroke="#fff" strokeWidth="4" strokeLinejoin="round">
        <path d="M50 46C36 24 12 22 14 40s24 14 36 6zM50 46c14-22 38-24 36-6s-24 14-36 6z" fill="#E58FA5" />
        <path d="M46 50L32 84l10-4 6 8 2-36M54 50l14 34-10-4" fill="#E58FA5" />
        <circle cx="50" cy="47" r="8" fill="#D9768F" />
      </g>
    ),
  },
  star: {
    label: "별",
    svg: <path d="M50 10l11 25 27 3-20 18 6 27-24-14-24 14 6-27-20-18 27-3z" fill="#FFE08A" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />,
  },
  sparkle: {
    label: "반짝",
    svg: (
      <g fill="#F7C35F" stroke="#fff" strokeWidth="4" strokeLinejoin="round">
        <path d="M44 14c3 18 8 23 26 26-18 3-23 8-26 26-3-18-8-23-26-26 18-3 23-8 26-26z" />
        <path d="M74 56c2 9 4 11 12 13-8 2-10 4-12 13-2-9-4-11-12-13 8-2 10-4 12-13z" />
      </g>
    ),
  },
  bunny: {
    label: "토끼",
    svg: (
      <g stroke="#E9B6C4" strokeWidth="3">
        <ellipse cx="36" cy="28" rx="9" ry="22" fill="#fff" />
        <ellipse cx="64" cy="28" rx="9" ry="22" fill="#fff" />
        <ellipse cx="36" cy="30" rx="4" ry="14" fill="#F9CFDA" stroke="none" />
        <ellipse cx="64" cy="30" rx="4" ry="14" fill="#F9CFDA" stroke="none" />
        <ellipse cx="50" cy="62" rx="30" ry="26" fill="#fff" />
        <circle cx="39" cy="60" r="3.5" fill="#6B4450" stroke="none" />
        <circle cx="61" cy="60" r="3.5" fill="#6B4450" stroke="none" />
        <ellipse cx="32" cy="70" rx="6" ry="3.5" fill="#F9CFDA" stroke="none" />
        <ellipse cx="68" cy="70" rx="6" ry="3.5" fill="#F9CFDA" stroke="none" />
        <path d="M46 68q4 4 8 0" fill="none" stroke="#6B4450" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    ),
  },
  bear: {
    label: "곰",
    svg: (
      <g stroke="#fff" strokeWidth="4">
        <circle cx="26" cy="30" r="13" fill="#C99670" />
        <circle cx="74" cy="30" r="13" fill="#C99670" />
        <circle cx="50" cy="56" r="32" fill="#D8A780" />
        <ellipse cx="50" cy="66" rx="14" ry="10" fill="#F3DCC7" stroke="none" />
        <circle cx="39" cy="52" r="3.5" fill="#4E342E" stroke="none" />
        <circle cx="61" cy="52" r="3.5" fill="#4E342E" stroke="none" />
        <ellipse cx="50" cy="62" rx="4.5" ry="3.5" fill="#4E342E" stroke="none" />
        <path d="M50 80c-4-6-12-4-12 1s12 9 12 9 12-4 12-9-8-7-12-1z" fill="#F4A7BE" strokeWidth="3" />
      </g>
    ),
  },
  cake: {
    label: "케이크",
    svg: (
      <g stroke="#fff" strokeWidth="4" strokeLinejoin="round">
        <path d="M14 56L82 40v38H14z" fill="#FFF3E6" />
        <path d="M14 56L82 40v12L14 68z" fill="#F7B7C7" />
        <path d="M14 68h68v10H14z" fill="#F7B7C7" />
        <circle cx="64" cy="32" r="10" fill="#E5485F" />
        <path d="M64 22c2-6 8-7 10-6-3 3-6 5-10 6z" fill="#7BBF6A" strokeWidth="2" />
      </g>
    ),
  },
  cloud: {
    label: "구름",
    svg: <path d="M26 74a16 16 0 0 1 2-32 22 22 0 0 1 42-4 18 18 0 0 1 4 36z" fill="#EAF2FF" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />,
  },
  flower: {
    label: "튤립",
    svg: (
      <g stroke="#fff" strokeWidth="4" strokeLinejoin="round">
        <path d="M50 52v36" stroke="#7BBF6A" strokeWidth="6" />
        <path d="M50 76c-10-12-24-10-24-10s6 16 24 12zM50 72c10-12 24-10 24-10s-6 16-24 12z" fill="#93CF7E" />
        <path d="M30 22c6 4 12 10 20 10s14-6 20-10c2 20-4 32-20 32S28 42 30 22z" fill="#F49AB2" />
        <path d="M50 32c-4-8-4-16 0-22 4 6 4 14 0 22z" fill="#F7B7C7" />
      </g>
    ),
  },
  tape: {
    label: "마스킹테이프",
    svg: (
      <g transform="rotate(-8 50 50)">
        <path d="M6 38h88l-3 6 3 6-3 6 3 6H6l3-6-3-6 3-6z" fill="#F9CFDA" opacity=".85" />
        <path d="M6 38h88M6 62h88" stroke="#fff" strokeWidth="2" strokeDasharray="4 4" />
      </g>
    ),
  },
  letter: {
    label: "편지",
    svg: (
      <g stroke="#E9A3B5" strokeWidth="4" strokeLinejoin="round">
        <rect x="12" y="26" width="76" height="50" rx="6" fill="#FFF8F0" />
        <path d="M12 30l38 26 38-26" fill="none" />
        <path d="M50 52c-3-6-10-5-10 0 0 4 10 9 10 9s10-5 10-9c0-5-7-6-10 0z" fill="#E5485F" stroke="none" />
      </g>
    ),
  },
};

export function Sticker({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-label={STICKERS[k]?.label ?? k} role="img">
      {STICKERS[k]?.svg}
    </svg>
  );
}

export const MOODS: { key: string; label: string; color: string; mouth: string; eyes?: "line" | "dot" | "star" | "x" }[] = [
  { key: "happy", label: "행복해", color: "#FFD3DE", mouth: "M38 60q12 12 24 0" },
  { key: "calm", label: "평온해", color: "#E2F0D9", mouth: "M40 62q10 5 20 0", eyes: "line" },
  { key: "excited", label: "신나", color: "#FFE7A8", mouth: "M38 58q12 16 24 0z", eyes: "star" },
  { key: "tired", label: "피곤해", color: "#E6E0F5", mouth: "M42 64h16", eyes: "line" },
  { key: "sad", label: "슬퍼", color: "#DCEBFA", mouth: "M40 66q10-8 20 0" },
  { key: "angry", label: "화나", color: "#FCD0C4", mouth: "M40 66q10-6 20 0", eyes: "x" },
];

export function MoodFace({ mood }: { mood: string }) {
  const m = MOODS.find((x) => x.key === mood) ?? MOODS[0];
  const eye = (cx: number) =>
    m.eyes === "line" ? (
      <path d={`M${cx - 5} 46q5 4 10 0`} stroke="#6B4450" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    ) : m.eyes === "star" ? (
      <path d={`M${cx} 39l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z`} fill="#6B4450" />
    ) : m.eyes === "x" ? (
      <path d={`M${cx - 5} 40l10 6M${cx + 5} 40l-10 6`} stroke="#6B4450" strokeWidth="3.5" strokeLinecap="round" />
    ) : (
      <circle cx={cx} cy={45} r={4} fill="#6B4450" />
    );
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <circle cx="50" cy="52" r="40" fill={m.color} stroke="#fff" strokeWidth="5" />
      {eye(36)}
      {eye(64)}
      <ellipse cx="26" cy="60" rx="6" ry="3.5" fill="#F7A6BA" opacity=".8" />
      <ellipse cx="74" cy="60" rx="6" ry="3.5" fill="#F7A6BA" opacity=".8" />
      <path d={m.mouth} stroke="#6B4450" strokeWidth="3.5" fill={m.mouth.endsWith("z") ? "#E5485F" : "none"} strokeLinecap="round" />
    </svg>
  );
}

/** 마스코트: 리본 토끼 '모모' */
export function Mascot() {
  return (
    <svg viewBox="0 0 100 110" width="100%" height="100%" aria-hidden="true">
      <g stroke="#E9B6C4" strokeWidth="3">
        <ellipse cx="34" cy="30" rx="10" ry="26" fill="#fff" transform="rotate(-10 34 30)" />
        <ellipse cx="66" cy="30" rx="10" ry="26" fill="#fff" transform="rotate(10 66 30)" />
        <ellipse cx="34" cy="32" rx="4.5" ry="17" fill="#F9CFDA" stroke="none" transform="rotate(-10 34 32)" />
        <ellipse cx="66" cy="32" rx="4.5" ry="17" fill="#F9CFDA" stroke="none" transform="rotate(10 66 32)" />
        <ellipse cx="50" cy="94" rx="24" ry="14" fill="#FFF3F6" />
        <ellipse cx="50" cy="66" rx="34" ry="29" fill="#fff" />
      </g>
      <path d="M58 30c-6-8-16-6-14 1s12 3 14-1zm0 0c6-8 16-6 14 1s-12 3-14-1z" fill="#E58FA5" stroke="#fff" strokeWidth="2" />
      <circle cx="58" cy="31" r="3.5" fill="#D9768F" />
      <circle cx="38" cy="64" r="4.5" fill="#5B3A45" />
      <circle cx="62" cy="64" r="4.5" fill="#5B3A45" />
      <circle cx="39.5" cy="62.5" r="1.5" fill="#fff" />
      <circle cx="63.5" cy="62.5" r="1.5" fill="#fff" />
      <ellipse cx="28" cy="74" rx="7" ry="4" fill="#F7A6BA" />
      <ellipse cx="72" cy="74" rx="7" ry="4" fill="#F7A6BA" />
      <path d="M45 72q5 5 10 0" stroke="#5B3A45" strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

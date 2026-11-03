// 하트 외곽선 하나를 3D 메시(Three.js)와 HTML 클립(SVG clipPath) 양쪽에서 같이 쓴다.
// 좌표: 0..1 정규화, y는 위→아래. 시작점은 위쪽 가운데 오목한 곳.
export const HEART_SEGMENTS: [number, number, number, number, number, number][] = [
  [0.4, 0.03, 0.17, 0.0, 0.07, 0.13],
  [0.0, 0.24, 0.02, 0.48, 0.16, 0.63],
  [0.28, 0.76, 0.42, 0.87, 0.5, 0.98],
  [0.58, 0.87, 0.72, 0.76, 0.84, 0.63],
  [0.98, 0.48, 1.0, 0.24, 0.93, 0.13],
  [0.83, 0.0, 0.6, 0.03, 0.5, 0.19],
];
export const HEART_START: [number, number] = [0.5, 0.19];

export const HEART_SVG_PATH =
  `M${HEART_START.join(",")} ` + HEART_SEGMENTS.map((s) => `C${s[0]},${s[1]} ${s[2]},${s[3]} ${s[4]},${s[5]}`).join(" ") + " Z";

/** 펼친 하트(양문형 표지 안쪽 내지) 크기(3D 단위). 중심이 원점, 가운데 세로선이 제본선 */
export const HEART_W = 3.4;
export const HEART_H = 3.16;

/** 정규화 좌표 → 3D 좌표 (scale은 하트 중심 기준) */
export function heartTo3D(u: number, v: number, scale = 1): [number, number] {
  return [(u - 0.5) * HEART_W * scale, (0.5 - v) * HEART_H * scale];
}

/** 하트 왼쪽/오른쪽 반쪽 외곽선 (가운데 세로선으로 닫힘) */
export function halfHeartPath(side: "left" | "right"): { start: [number, number]; segs: typeof HEART_SEGMENTS; close: [number, number] } {
  if (side === "left") return { start: HEART_START, segs: HEART_SEGMENTS.slice(0, 3), close: HEART_START };
  return { start: [0.5, 0.98], segs: HEART_SEGMENTS.slice(3), close: [0.5, 0.98] };
}

/** 정규화 좌표 점이 하트 안에 있는지 */
let hitCtx: CanvasRenderingContext2D | null = null;
let hitPath: Path2D | null = null;
export function insideHeart(u: number, v: number, inset = 0): boolean {
  if (typeof document === "undefined") return true;
  if (!hitCtx) {
    hitCtx = document.createElement("canvas").getContext("2d");
    const p = new Path2D();
    p.addPath(new Path2D(HEART_SVG_PATH), new DOMMatrix().scale(1000, 1000));
    hitPath = p;
  }
  const k = 1 - inset * 2;
  return hitCtx!.isPointInPath(hitPath!, (0.5 + (u - 0.5) / k) * 1000, (0.5 + (v - 0.5) / k) * 1000);
}

/** 하트 곡선 위 점들 (레이스/테두리용) */
export function sampleHeart(n: number): [number, number][] {
  const pts: [number, number][] = [];
  const per = Math.ceil(n / HEART_SEGMENTS.length);
  let p0 = HEART_START;
  for (const s of HEART_SEGMENTS) {
    const p1: [number, number] = [s[0], s[1]], p2: [number, number] = [s[2], s[3]], p3: [number, number] = [s[4], s[5]];
    for (let i = 0; i < per; i++) {
      const t = i / per, m = 1 - t;
      pts.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    p0 = p3;
  }
  return pts;
}

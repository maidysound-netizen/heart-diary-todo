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

/** 하트 페이지 크기(3D 단위). 펼치면 좌·우 하트가 가운데 링 제본에서 조금 겹친다. */
export const PAGE_W = 2.0;
export const PAGE_H = 1.86;
/** 힌지(x=0)에서 하트 왼쪽 끝이 넘어가는 정도 */
export const HINGE_OVERLAP = 0.1;

/** 정규화 좌표 → 오른쪽 페이지 기준 3D 좌표 (힌지 x=0, 하트 위쪽 y=PAGE_H/2) */
export function heartTo3D(u: number, v: number, scale = 1): [number, number] {
  const cx = PAGE_W / 2 - HINGE_OVERLAP;
  return [cx + (u - 0.5) * PAGE_W * scale, (0.5 - v) * PAGE_H * scale];
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

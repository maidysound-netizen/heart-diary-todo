/** 클라이언트의 Date#getTimezoneOffset() 값(분). 한국은 -540. */
export function tzOffset(v: string | null): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && Math.abs(n) <= 840 ? Math.round(n) : 0;
}
